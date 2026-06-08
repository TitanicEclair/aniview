/**
 * AniviewBake — The "Bake" pipeline: pre-computes interpolation grids
 * from user-defined keyframes for fast per-frame lookup on the UI thread.
 *
 * This module is pure logic with no React dependency. It runs on the JS
 * thread during `useMemo` and produces a {@link BakedResult} that the
 * `useAnimatedStyle` worklet consumes every frame.
 */

import { StyleSheet, ViewStyle } from 'react-native';
import {
  AniviewFrame,
  BakedFrame,
  BakedLane,
  BakedResult,
  IAniviewConfig,
  AniviewContextType,
} from '../useAniviewContext';
import {
  normalizeColorToRgba,
  isColorProp,
  jsInterpolateColor,
} from './AniviewColor';
import { flattenTransform, stripLayoutProps } from './AniviewStyleUtils';

/**
 * Pre-computes all interpolation data for an Aniview component.
 *
 * This is the "bake" — a one-time JS-thread computation that:
 * 1. Extracts home props from the base style
 * 2. Scans all frames to register active property keys
 * 3. Builds a 2D spatial grid indexed by world coordinates
 * 4. Builds 1D event lanes sorted by driver value
 * 5. Finalizes lane tables with per-key output ranges and const flags
 *
 * The resulting {@link BakedResult} is consumed on every frame by
 * the UI-thread style worklet via O(1) segment lookups.
 *
 * @param localLayout - Measured local position of the component.
 * @param config - The Aniview configuration engine.
 * @param pageId - The page this component belongs to.
 * @param dimensions - Current viewport/page dimensions.
 * @param frames - User-defined keyframes (object or array form).
 * @param baseStyle - Flattened base style with `position: 'absolute'`.
 * @param rawStyle - Original style prop (for initial state extraction).
 * @returns Fully baked interpolation data, or `null` on error.
 */
export function bakeKeyframes(
  localLayout: { x: number; y: number },
  config: IAniviewConfig,
  pageId: number | string,
  dimensions: AniviewContextType['dimensions'],
  frames: AniviewFrame[] | Record<string, AniviewFrame> | undefined,
  baseStyle: ViewStyle,
  rawStyle: ViewStyle | ViewStyle[] | undefined,
): BakedResult | null {
  try {
    const bakeInfo = config.register(pageId, dimensions, frames, localLayout);
    const { homeOffset } = bakeInfo;
    const homeX = homeOffset.x + localLayout.x;
    const homeY = homeOffset.y + localLayout.y;
    const baseOpacity = (baseStyle as any).opacity ?? 1;

    // 1. Initial State Extraction
    const homeProps: any = { worldX: homeX, worldY: homeY, opacity: baseOpacity };
    const flatBase = StyleSheet.flatten(rawStyle as any) || {};

    for (const k in flatBase) {
      const v = (flatBase as any)[k];
      if (typeof v === 'number' || (typeof v === 'string' && isColorProp(k))) {
        homeProps[k] = (typeof v === 'string' && isColorProp(k)) ? normalizeColorToRgba(v) : v;
      } else if (k === 'transform' && Array.isArray(v)) {
        Object.assign(homeProps, flattenTransform(v));
      } else if (k === 'shadowOffset' || k === 'textShadowOffset') {
        homeProps[k + 'Width'] = v?.width ?? 0;
        homeProps[k + 'Height'] = v?.height ?? 0;
      }
    }

    // 2. Pre-scan all frames to find ALL active keys and update homeProps
    if (frames) {
      const registration = bakeInfo;

      const scanFrame = (frame: any) => {
        if (frame.style) {
          const fStyles = Array.isArray(frame.style) ? frame.style : [frame.style];
          fStyles.forEach((s: any) => {
            const fFlat = StyleSheet.flatten(s) || {};
            for (const k in fFlat) {
              const v = (fFlat as any)[k];
              if (k === 'transform' && Array.isArray(v)) {
                const flatTr = flattenTransform(v);
                Object.keys(flatTr).forEach(tk => {
                  if (homeProps[tk] === undefined) {
                    homeProps[tk] = tk.includes('scale') ? 1 : 0;
                  }
                });
              } else if (k === 'shadowOffset' || k === 'textShadowOffset') {
                if (homeProps[k + 'Width'] === undefined) {
                  homeProps[k + 'Width'] = 0;
                  homeProps[k + 'Height'] = 0;
                }
              } else if (homeProps[k] === undefined && (typeof v === 'number' || (typeof v === 'string' && isColorProp(k)))) {
                homeProps[k] = (k === 'opacity' || k.includes('scale')) ? 1 : (isColorProp(k) ? 'rgba(0,0,0,0)' : 0);
              }
            }
          });
        }
        if (frame.opacity !== undefined && homeProps.opacity === undefined) homeProps.opacity = 1;
        if (frame.scale !== undefined && homeProps._tr_scale === undefined) homeProps._tr_scale = 1;
        if (frame.rotate !== undefined && homeProps._tr_rotate === undefined) homeProps._tr_rotate = 0;
      };

      for (const frameKey in registration.bakedFrames) {
        scanFrame(registration.bakedFrames[frameKey]);
      }

      for (const laneKey in registration.eventLanes) {
        registration.eventLanes[laneKey].forEach(scanFrame);
      }
    }

    // 3. Spatial Grid Construction (2D)
    const grid: Record<string, any> = { [`${homeOffset.x}_${homeOffset.y}`]: homeProps };
    const uniqueX = new Set<number>([homeOffset.x]);
    const uniqueY = new Set<number>([homeOffset.y]);
    const activeKeys = new Set<string>();

    // 4. Event Lane Construction (1D)
    const eventLanes: Record<string, BakedLane> = {};

    if (frames) {
      const registration = bakeInfo;

      // Process Spatial Frames
      for (const frameKey in registration.bakedFrames) {
        const frame = registration.bakedFrames[frameKey];
        const targetX = frame.worldX + homeOffset.x;
        const targetY = frame.worldY + homeOffset.y;
        uniqueX.add(targetX); uniqueY.add(targetY);

        const frameProps: any = { ...homeProps, worldX: targetX + localLayout.x, worldY: targetY + localLayout.y };
        if (frame.style) {
          const fStyles = Array.isArray(frame.style) ? frame.style : [frame.style];
          fStyles.forEach(s => {
            const fFlat = StyleSheet.flatten(s) || {};
            for (const k in fFlat) {
              const v = (fFlat as any)[k];
              if (k === 'transform' && Array.isArray(v)) {
                Object.assign(frameProps, flattenTransform(v));
              } else if (k === 'shadowOffset' || k === 'textShadowOffset') {
                frameProps[k + 'Width'] = v?.width ?? 0;
                frameProps[k + 'Height'] = v?.height ?? 0;
              } else if (typeof v === 'number' || (typeof v === 'string' && isColorProp(k))) {
                let finalV = v;
                if (typeof v === 'string' && isColorProp(k)) finalV = normalizeColorToRgba(v);

                if (k === 'left' || k === 'marginLeft') frameProps.worldX = targetX + Number(v) + (dimensions.offsetX || 0);
                else if (k === 'top' || k === 'marginTop') frameProps.worldY = targetY + Number(v) + (dimensions.offsetY || 0);
                else frameProps[k] = finalV;

                if (homeProps[k] === undefined) {
                  homeProps[k] = (k === 'opacity' || k.includes('scale')) ? 1 : (isColorProp(k) ? 'rgba(0,0,0,0)' : 0);
                }
              }
            }
          });
        }
        // Add shortcuts
        if (frame.opacity !== undefined) frameProps.opacity = frame.opacity;
        if (frame.scale !== undefined) frameProps._tr_scale = frame.scale;
        if (frame.rotate !== undefined) frameProps._tr_rotate = frame.rotate;

        for (const p in frameProps) {
          if (frameProps[p] !== homeProps[p]) activeKeys.add(p);
        }
        grid[`${targetX}_${targetY}`] = frameProps;
      }

      // Process Event Lanes
      for (const eventName in registration.eventLanes) {
        const framesInLane = registration.eventLanes[eventName];
        const inputValues = framesInLane.map(f => f.value || 0);
        const keysInLane = new Set<string>();

        framesInLane.forEach(f => {
          const fStyles = Array.isArray(f.style) ? f.style : (f.style ? [f.style] : []);
          fStyles.forEach(s => {
            const flat = StyleSheet.flatten(s) || {};
            Object.keys(flat).forEach(k => {
              if (k === 'transform') {
                const tr = flattenTransform((flat as any).transform);
                Object.keys(tr).forEach(tk => keysInLane.add(tk));
              } else if (k === 'shadowOffset' || k === 'textShadowOffset') {
                keysInLane.add(k + 'Width');
                keysInLane.add(k + 'Height');
              } else {
                keysInLane.add(k);
              }
            });
          });
          if (f.opacity !== undefined) keysInLane.add('opacity');
          if (f.scale !== undefined) keysInLane.add('_tr_scale');
          if (f.rotate !== undefined) keysInLane.add('_tr_rotate');
        });

        const keysArr = Array.from(keysInLane);
        const outputRanges: any[][] = keysArr.map(k => {
          return framesInLane.map(f => {
            const fStyles = Array.isArray(f.style) ? f.style : (f.style ? [f.style] : []);
            let val = homeProps[k];
            fStyles.forEach(s => {
              const flat = StyleSheet.flatten(s) || {};
              if (k.startsWith('_tr_')) {
                const tr = flattenTransform((flat as any).transform || []);
                if (tr[k] !== undefined) val = tr[k];
              } else if (
                k === 'shadowOffsetWidth' ||
                k === 'shadowOffsetHeight' ||
                k === 'textShadowOffsetWidth' ||
                k === 'textShadowOffsetHeight'
              ) {
                const base = k.startsWith('shadowOffset') ? 'shadowOffset' : 'textShadowOffset';
                const axis = k.endsWith('Width') ? 'width' : 'height';
                if ((flat as any)[base]?.[axis] !== undefined) {
                  val = (flat as any)[base][axis];
                }
              } else {
                if ((flat as any)[k] !== undefined) val = (flat as any)[k];
              }
            });
            if (k === 'opacity' && f.opacity !== undefined) val = f.opacity;
            if (k === '_tr_scale' && f.scale !== undefined) val = f.scale;
            if (k === '_tr_rotate' && f.rotate !== undefined) val = f.rotate;
            return val;
          });
        });

        const isEventPersistent = framesInLane.some(
          f => f.eventPersistent === true || f.persistent === true
        );
        eventLanes[eventName] = {
          values: inputValues,
          outputRanges,
          keys: keysArr,
          eventPersistent: isEventPersistent
        };
        keysArr.forEach(k => activeKeys.add(k));
      }
    }

    const sortedX = Array.from(uniqueX).sort((a, b) => a - b);
    const sortedY = Array.from(uniqueY).sort((a, b) => a - b);

    const numericKeys: string[] = ['worldX', 'worldY', 'opacity'];
    const colorKeys: string[] = [];

    Array.from(activeKeys).forEach(k => {
      if (k === 'worldX' || k === 'worldY' || k === 'opacity') return;
      if (isColorProp(k)) colorKeys.push(k); else numericKeys.push(k);
    });

    /**
     * Builds lane tables for fast worklet-time interpolation.
     */
    const finalize = (tAxis: number[], fAxis: number[], isH: boolean, keys: string[], isColor: boolean) => {
      return fAxis.map(fVal => {
        const values: any[][] = [];
        const constFlags: boolean[] = [];
        keys.forEach(k => {
          const outputs: any[] = [];
          let isConst = true;
          const anchors = tAxis.filter(t => grid[isH ? `${t}_${fVal}` : `${fVal}_${t}`]).map(t => ({ t, v: grid[isH ? `${t}_${fVal}` : `${fVal}_${t}`][k] ?? homeProps[k] }));
          tAxis.forEach((t, i) => {
            let calc = homeProps[k];
            if (anchors.length > 0) {
              let l = anchors[0], r = anchors[anchors.length - 1];
              for (let j = 0; j < anchors.length - 1; j++) if (t >= anchors[j].t && t <= anchors[j + 1].t) { l = anchors[j]; r = anchors[j + 1]; break; }
              if (t <= l.t) calc = l.v; else if (t >= r.t) calc = r.v;
              else {
                if (isColor) calc = jsInterpolateColor(t, l.t, r.t, l.v, r.v);
                else calc = l.v + ((t - l.t) / ((r.t - l.t) || 1)) * (r.v - l.v);
              }
            }
            outputs.push(calc);
            if (i > 0 && calc !== outputs[0]) isConst = false;
          });
          values.push(outputs); constFlags.push(isConst);
        });
        return { fixed: fVal, values, constFlags };
      });
    };

    return {
      homeX: homeOffset.x, homeY: homeOffset.y, localX: localLayout.x, localY: localLayout.y,
      bakedH: finalize(sortedX, sortedY, true, numericKeys, false),
      bakedV: finalize(sortedY, sortedX, false, numericKeys, false),
      bakedCH: finalize(sortedX, sortedY, true, colorKeys, true),
      bakedCV: finalize(sortedY, sortedX, false, colorKeys, true),
      eventLanes,
      uniqueX: sortedX, uniqueY: sortedY,
      numericKeys, colorKeys,
      baseProps: stripLayoutProps(baseStyle),
      homeProps
    };
  } catch (e) {
    console.error('[Aniview] Bake Failed', e);
    return null;
  }
}
