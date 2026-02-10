import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { LayoutChangeEvent, StyleSheet, ViewStyle } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  interpolate,
  interpolateColor,
  Extrapolation,
  useAnimatedReaction,
  runOnJS
} from 'react-native-reanimated';
import { AniviewProps } from './useAniviewContext';
import { useAniview } from './useAniview';

/**
 * HELPER: Strips mapping styles and provides transform array for reconstruction.
 */
function stripLayoutProps(style: ViewStyle) {
  const flattened = StyleSheet.flatten(style) || {};
  const { 
    transform, position, left, top, right, bottom, 
    marginLeft, marginTop, marginRight, marginBottom,
    ...rest 
  } = flattened;
  return { rest, transform: Array.isArray(transform) ? transform : [] };
}

/**
 * HELPER: Flattens transform array into O(1) property map for interpolation.
 */
function flattenTransform(transform: any[]) {
    const props: any = {};
    transform.forEach(t => {
        const key = Object.keys(t)[0];
        let val = t[key];
        // Handle rotation strings
        if (typeof val === 'string' && val.endsWith('deg')) val = parseFloat(val);
        props[`_tr_${key}`] = val;
    });
    return props;
}

/**
 * HELPER: Normalizes any color string to RGBA for consistent interpolation.
 */
function normalizeColorToRgba(c: string): string {
  if (!c || c === 'transparent') return 'rgba(0,0,0,0)';
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    let r=0, g=0, b=0, a=1;
    if (hex.length === 3) {
      r = parseInt(hex[0]+hex[0], 16); g = parseInt(hex[1]+hex[1], 16); b = parseInt(hex[2]+hex[2], 16);
    } else {
      r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16);
      if (hex.length === 8) a = parseInt(hex.slice(6, 8), 16) / 255;
    }
    return `rgba(${r},${g},${b},${a})`;
  }
  const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) return `rgba(${match[1]},${match[2]},${match[3]},${match[4] || 1})`;
  
  const hMatch = c.match(/hsla?\((\d+),\s*([\d.]+)%?,\s*([\d.]+)%?(?:,\s*([\d.]+))?\)/);
  if (hMatch) {
    const h = parseInt(hMatch[1]), s = parseFloat(hMatch[2]) / 100, l = parseFloat(hMatch[3]) / 100, a = hMatch[4] ? parseFloat(hMatch[4]) : 1;
    const k = (n: number) => (n + h / 30) % 12;
    const arc = s * Math.min(l, 1 - l);
    const f = (n: number) => l - arc * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return `rgba(${Math.round(255 * f(0))},${Math.round(255 * f(8))},${Math.round(255 * f(4))},${a})`;
  }
  return 'rgba(0,0,0,0)'; 
}

/**
 * PURE JS COLOR INTERPOLATOR
 */
function jsInterpolateColor(val: number, start: number, end: number, startColor: string, endColor: string) {
  'worklet';
  if (!startColor || !endColor || startColor === endColor) return startColor || 'rgba(0,0,0,0)';
  const range = (end - start) || 1;
  const progress = Math.max(0, Math.min(1, (val - start) / range));
  
  const parse = (c: string) => {
    if (!c || c === 'transparent') return [0, 0, 0, 0];
    if (c.startsWith('#')) {
      const hex = c.slice(1);
      if (hex.length === 3) return [parseInt(hex[0]+hex[0], 16), parseInt(hex[1]+hex[1], 16), parseInt(hex[2]+hex[2], 16), 1];
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1];
    }
    const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), match[4] ? parseFloat(match[4]) : 1];
    
    const hMatch = c.match(/hsla?\((\d+),\s*([\d.]+)%?,\s*([\d.]+)%?(?:,\s*([\d.]+))?\)/);
    if (hMatch) {
      const h = parseInt(hMatch[1]), s = parseFloat(hMatch[2]) / 100, l = parseFloat(hMatch[3]) / 100, a = hMatch[4] ? parseFloat(hMatch[4]) : 1;
      const k = (n: number) => (n + h / 30) % 12;
      const arc = s * Math.min(l, 1 - l);
      const f = (n: number) => l - arc * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4)), a];
    }
    return [0, 0, 0, 0];
  };

  const s = parse(startColor), e = parse(endColor);
  const r = Math.round(s[0] + (e[0] - s[0]) * progress);
  const g = Math.round(s[1] + (e[1] - s[1]) * progress);
  const b = Math.round(s[2] + (e[2] - s[2]) * progress);
  const a = s[3] + (e[3] - s[3]) * progress;
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * SMART INTERPOLATE COLOR
 * Handles "transparent" interpolation by adopting the RGB of the non-transparent color
 * to avoid darkening/graying artifacts.
 */
function smartInterpolateColor(val: number, input: number[], output: string[]) {
    'worklet';
    if (output.length === 0) return 'rgba(0,0,0,0)';
    if (output.length === 1) return output[0];
    
    // Bounds check
    if (val <= input[0]) return output[0];
    if (val >= input[input.length - 1]) return output[output.length - 1];

    // Find segment
    let i = 0;
    // Iterate to find the correct segment
    while (i < input.length - 2 && val >= input[i+1]) {
        i++;
    }
    
    // Safety check
    if (input[i+1] === undefined) return output[output.length-1];

    const c1 = output[i];
    const c2 = output[i+1];
    
    let useC1 = c1;
    let useC2 = c2;
    
    const fix = (transp: string, source: string) => {
        'worklet';
        // We target normalized 'rgba(0,0,0,0)'
        if (transp !== 'rgba(0,0,0,0)') return transp;
        if (!source || !source.startsWith('rgba')) return transp;
        
        const lastComma = source.lastIndexOf(',');
        if (lastComma === -1) return transp;
        // Construct: source RGB + alpha 0
        return source.substring(0, lastComma + 1) + '0)';
    };

    useC1 = fix(c1, c2);
    useC2 = fix(c2, c1);
    
    return interpolateColor(val, [input[i], input[i+1]], [useC1, useC2]);
}

/**
 * OPTIMIZATION: One-time Segment Data Search
 * Finds the segment index and progress percentage once per frame so we
 * don't have to perform a search for every single style property.
 */
function getSegmentInfo(val: number, input: number[]) {
    'worklet';
    const len = input.length;
    if (len === 0) return { i: 0, p: 0, constant: true };
    if (len === 1 || val <= input[0]) return { i: 0, p: 0, constant: true };
    if (val >= input[len - 1]) return { i: len - 1, p: 0, constant: true };

    let i = 0;
    while (i < len - 1 && val >= input[i + 1]) {
        i++;
    }
    const gap = input[i + 1] - input[i];
    const p = gap > 0.001 ? (val - input[i]) / gap : 0;
    return { i, p, constant: false };
}

interface BakedLane {
    values: number[];
    outputRanges: any[][];
    keys: string[];
    persistent: boolean;
}

interface BakedResult {
    homeX: number;
    homeY: number;
    localX: number;
    localY: number;
    bakedH: any[];
    bakedV: any[];
    bakedCH: any[];
    bakedCV: any[];
    eventLanes: Record<string, BakedLane>;
    uniqueX: number[];
    uniqueY: number[];
    numericKeys: string[];
    colorKeys: string[];
    baseProps: any;
    homeProps: any;
}

/**
 * **Aniview** — Absolute World Coordinate Animation Engine Component
 *
 * The core animated view that interpolates its style properties based on
 * the camera's position in a virtual 2D world coordinate system. Each
 * `Aniview` belongs to a specific `pageId` (its "home page") and defines
 * `frames` — keyframes that describe how the component should look when
 * the camera is at a different page or when a custom event reaches a
 * certain value.
 *
 * ### How it works (the "Baking" pipeline)
 *
 * 1. On mount (or when `frames`/`style`/`dimensions` change), Aniview
 *    runs a one-time **bake** on the JS thread. This pre-computes a
 *    lookup grid of style values indexed by world coordinates.
 * 2. On every frame, `useAnimatedStyle` reads the camera SharedValues
 *    (`events.x`, `events.y`) and performs O(1) segment lookups +
 *    linear/color interpolation — no searching, no string parsing.
 * 3. The baked data also powers **native virtualization**: components
 *    farther than 1.5× screen width from the camera are hidden via
 *    `opacity: 0`, keeping the render tree lightweight.
 *
 * ### Key design choices
 *
 * - **Absolute positioning**: All Aniview children are rendered with
 *   `position: 'absolute'` and placed via `translateX`/`translateY`
 *   relative to the camera. This decouples layout from animation.
 * - **Smart color interpolation**: When transitioning to/from
 *   `transparent`, the RGB of the non-transparent color is preserved
 *   to avoid grey flash artifacts.
 * - **Selective unmounting**: Non-persistent components unmount when
 *   offscreen (after snapping completes) to reclaim memory. Set
 *   `persistent={true}` for 3D/GL content that must stay mounted.
 *
 * @param props Standard `ViewProps` plus:
 * @param props.pageId - The page this component belongs to (numeric index or semantic name from `pageMap`)
 * @param props.frames - Keyframe definitions. Object keys are frame names, values are {@link AniviewFrame}
 * @param props.persistent - If `true`, stays mounted even when far offscreen. Required for WebGL/Three.js canvases. Default: `false`
 * @param props.style - Base styles applied when at home position. Numeric and color props here become the interpolation baseline.
 * @param props.pointerEvents - Standard RN pointer events. Useful for overlay pages that shouldn't block touches.
 *
 * @example
 * ```tsx
 * <Aniview
 *   pageId="HOME"
 *   style={{ width: '100%', height: '100%', backgroundColor: '#fff' }}
 *   frames={{
 *     away: { page: 'SETTINGS', opacity: 0 },
 *     scrolled: { event: 'scrollY', value: 100, style: { transform: [{ translateY: -50 }] } },
 *   }}
 * >
 *   <HomeContent />
 * </Aniview>
 * ```
 *
 * @see {@link AniviewProvider} for setting up the coordinate system
 * @see {@link AniviewConfig} for layout and gesture configuration
 * @see {@link useAniview} for accessing context from child components
 */
export default function Aniview(props: AniviewProps) {
  const { style, children, pageId, frames, ...rest } = props;
  
  const context = useAniview(props);
  const { events, config, dimensions, isMoving } = context;

  const persistent = props.persistent ?? false;
  const [shouldRender, setShouldRender] = useState(true);

  // Pre-calculate target X on the JS thread to avoid UI thread crash (calling class methods)
  const homeX = useMemo(() => {
    if (!config || !dimensions.width) return 0;
    const homeId = config.resolvePageId(pageId);
    return config.getPageOffset(homeId, dimensions).x;
  }, [config, pageId, dimensions.width, dimensions.height]);

  // SELECTIVE UNMOUNTING: If not persistent, monitor visibility natively.
  useAnimatedReaction(
    () => {
      if (persistent || !isMoving || isMoving.value) return null;
      const cameraX = events.x.value;
      const isFar = Math.abs(cameraX - homeX) > dimensions.width * 1.5;
      return isFar;
    },
    (isFar) => {
      if (isFar === null) return null;
      if (isFar && shouldRender) runOnJS(setShouldRender)(false);
      if (!isFar && !shouldRender) runOnJS(setShouldRender)(true);
    },
    [persistent, dimensions.width, homeX, shouldRender, isMoving]
  );

  const hasNoDims = dimensions.width <= 0 || dimensions.height <= 0;
  const cached = useMemo(() => (config as any)?.getLayout(pageId.toString()), [config, pageId]);
  const [localLayout, setLocalLayout] = useState<{ x: number; y: number } | null>(cached || null);

  useEffect(() => {
    if (localLayout && !cached) {
      (config as any)?.registerLayout(pageId.toString(), localLayout);
    }
  }, [localLayout, cached, config, pageId]);

  // FIX: Sync localLayout with controlled style changes
  useEffect(() => {
    const flat = StyleSheet.flatten(style || {}) as ViewStyle;
    const x = (flat.left as number) ?? (flat.marginLeft as number) ?? 0;
    const y = (flat.top as number) ?? (flat.marginTop as number) ?? 0;
    
    if (!localLayout || Math.abs(localLayout.x - x) > 0.1 || Math.abs(localLayout.y - y) > 0.1) {
      setLocalLayout({ x, y });
    }
  }, [style, localLayout]);

  const onLayout = useCallback((e: any) => {
    let { x, y, width, height } = e.nativeEvent.layout;
    const flattened = StyleSheet.flatten(props.style || {}) as ViewStyle;
    if (x === 0 && typeof flattened?.marginLeft === 'number') x = flattened.marginLeft;
    if (y === 0 && typeof flattened?.marginTop === 'number') y = flattened.marginTop;

    if (!localLayout || Math.abs(localLayout.x - x) > 1 || Math.abs(localLayout.y - y) > 1) {
      if (width > 0 || height > 0) {
        setLocalLayout({ x, y });
      }
    }
  }, [localLayout, props.style]);


  const baseStyle = useMemo(() => {
    const flattened = StyleSheet.flatten(style as any) || {};
    return { ...flattened, position: 'absolute' } as ViewStyle;
  }, [style]);

  // --- THE BAKE ---
  const baked = useMemo((): BakedResult | null => {
    if (!localLayout || !config) return null;
    const isColorProp = (k: string) => k.toLowerCase().includes('color') || k === 'tintColor';

    try {
      const bakeInfo = config.register(pageId, dimensions, frames, localLayout);
      const { homeOffset } = bakeInfo;
      const homeX = homeOffset.x + localLayout.x;
      const homeY = homeOffset.y + localLayout.y;
      const baseOpacity = (baseStyle as any).opacity ?? 1;

      // 1. Initial State Extraction
      const homeProps: any = { worldX: homeX, worldY: homeY, opacity: baseOpacity };
      const flatBase = StyleSheet.flatten(style as any) || {};
      
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
                        let key = k;
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

            // Start with a full copy of COMPLETE homeProps
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

                            // If this is a NEW key not in homeProps, add it to homeProps with a default
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

            const isPersistent = framesInLane.some(f => f.persistent === true);
            eventLanes[eventName] = { values: inputValues, outputRanges, keys: keysArr, persistent: isPersistent };
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
                          let l = anchors[0], r = anchors[anchors.length-1];
                          for (let j=0; j<anchors.length-1; j++) if (t >= anchors[j].t && t <= anchors[j+1].t) { l=anchors[j]; r=anchors[j+1]; break; }
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

      if (pageId === 'ROOM' && frames) {
          // Keep minimal or no logging here
      }

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
    } catch (e) { console.error('[Aniview] Bake Failed', e); return null; }
  }, [localLayout, config, pageId, frames, style, baseStyle, dimensions.offsetX, dimensions.offsetY, dimensions.width, dimensions.height]);

  const cameraX_SV = (events as any)?.x;
  const cameraY_SV = (events as any)?.y;

  const isSingleRowVal = (config as any).layout?.length === 1;

  const animatedStyle = useAnimatedStyle(() => {
    if (!baked || !cameraX_SV || !cameraY_SV || !config) return { opacity: 0 };
    const cameraX = cameraX_SV.value, cameraY = cameraY_SV.value;
    
    // NATIVE VIRTUALIZATION CHECK (Spatial)
    // We hide components that are more than 1.5 screen-widths away from the camera.
    // This is 100% UI-thread safe and replaces the problematic JS Set check.
    const thresholdX = dimensions.width * 1.5;
    const thresholdY = dimensions.height * 1.5;

    const distX = Math.abs(cameraX - baked.homeX);
    const distY = Math.abs(cameraY - baked.homeY);

    let isVisibleX = distX <= thresholdX;
    if (!isVisibleX) {
      for (let i = 0; i < baked.uniqueX.length; i++) {
        if (Math.abs(cameraX - baked.uniqueX[i]) < thresholdX) {
          isVisibleX = true;
          break;
        }
      }
    }

    let isVisibleY = distY <= thresholdY;
    if (!isVisibleY) {
      for (let i = 0; i < baked.uniqueY.length; i++) {
        if (Math.abs(cameraY - baked.uniqueY[i]) < thresholdY) {
          isVisibleY = true; 
          break;
        }
      }
    }

    if (!isVisibleX || !isVisibleY) return { opacity: 0 };
    
    // Safety: If dimensions are 0 (startup), skip calculation
    if (dimensions.width <= 0 || dimensions.height <= 0 || isNaN(dimensions.width) || isNaN(dimensions.height)) {
      return { opacity: 0 };
    }

    const windowX = dimensions.width * 0.4;
    const windowY = dimensions.height * 0.4;
    
    let pX = 1 - Math.min(1, Math.max(0, Math.abs(cameraX - baked.homeX) / windowX));
    let pY = isSingleRowVal ? 1 : (1 - Math.min(1, Math.max(0, Math.abs(cameraY - baked.homeY) / windowY)));
    
    // Sharpen the curve so events are exclusive and don't 'leak' visual offsets.
    if (!pX || isNaN(pX)) pX = 0;
    if (!pY || isNaN(pY)) pY = 0;

    // Softened power-2 curve for smoother transitions and better responsiveness
    const presenceX = Math.pow(pX, 2);
    const presenceY = isSingleRowVal ? 1 : Math.pow(pY, 2);
    const presence = presenceX * presenceY;

    const getLaneInfo = (lanes: any[], pos: number) => {
        if (!lanes || lanes.length === 0) return null;
        let i = 0; while (i < lanes.length - 1 && pos > lanes[i].fixed) i++;
        const l1idx = Math.max(0, i-1), l2idx = i;
        const l1 = lanes[l1idx], l2 = lanes[l2idx];
        if (!l1 || !l2) return null;
        const gap = l2.fixed - l1.fixed;
        const mix = Math.max(0, Math.min(1, gap > 0.1 ? (pos - l1.fixed) / gap : 0));
        return { l1: { ...l1, idx: l1idx }, l2: { ...l2, idx: l2idx }, mix, dist: Math.min(Math.abs(pos-l1.fixed), Math.abs(pos-l2.fixed)) };
    };

    const laneH = getLaneInfo(baked.bakedH, cameraY), laneV = getLaneInfo(baked.bakedV, cameraX);
    if (!laneH || !laneV) return { opacity: 0 };

    const viewportSize = dimensions.width;
    const isNearH = laneH.dist < viewportSize, isNearV = laneV.dist < viewportSize;
    if (!isNearH && !isNearV) return { opacity: 0 };

    const props: any = { 
      ...baked.baseProps.rest, 
      position: 'absolute', 
      width: baked.baseProps.rest.width ?? dimensions.width,
      height: baked.baseProps.rest.height ?? dimensions.height,
    };
    // If user provided left/top in style, we should probably ignore them in the final composite 
    // because they are already in localLayout and baked.localX/Y.
    props.left = 0;
    props.top = 0;
    const hWeight = isNearV ? (isNearH ? laneV.dist / (laneH.dist + laneV.dist + 0.001) : 0) : 1;
    
    // ONE-TIME OPTIMIZATION: Search for segment indices ONCE per frame
    const segX = getSegmentInfo(cameraX, baked.uniqueX);
    const segY = getSegmentInfo(cameraY, baked.uniqueY);

    let finalX = 0, finalY = 0, finalOp = 1;

    const spatialVals: Record<string, any> = { ...baked.homeProps };

    const runSpatial = (keys: string[], baked_H: any[], baked_V: any[], isColor: boolean) => {
        const laneH_L = baked_H[laneH.l1.idx || 0], laneH_R = baked_H[laneH.l2.idx || 0];
        const laneV_L = baked_V[laneV.l1.idx || 0], laneV_R = baked_V[laneV.l2.idx || 0];

        keys.forEach((k, i) => {
            let vH: any = baked.homeProps[k], vV: any = baked.homeProps[k];
            if (isNearH && laneH_L && laneH_R) {
                const o1 = laneH_L.values[i], o2 = laneH_R.values[i];
                if (o1 && o2) {
                   const r1 = (laneH_L.constFlags[i] || segX.constant) ? o1[segX.i] : (isColor ? smartInterpolateColor(cameraX, baked.uniqueX, o1) : o1[segX.i] + segX.p * (o1[segX.i+1] - o1[segX.i]));
                   const r2 = (laneH_R.constFlags[i] || segX.constant) ? o2[segX.i] : (isColor ? smartInterpolateColor(cameraX, baked.uniqueX, o2) : o2[segX.i] + segX.p * (o2[segX.i+1] - o2[segX.i]));
                   vH = isColor ? smartInterpolateColor(laneH.mix, [0, 1], [r1, r2]) : (r1 as number) + laneH.mix * ((r2 as number) - (r1 as number));
                }
            }
            if (isNearV && laneV_L && laneV_R) {
                const o1 = laneV_L.values[i], o2 = laneV_R.values[i];
                if (o1 && o2) {
                   const r1 = (laneV_L.constFlags[i] || segY.constant) ? o1[segY.i] : (isColor ? smartInterpolateColor(cameraY, baked.uniqueY, o1) : o1[segY.i] + segY.p * (o1[segY.i+1] - o1[segY.i]));
                   const r2 = (laneV_R.constFlags[i] || segY.constant) ? o2[segY.i] : (isColor ? smartInterpolateColor(cameraY, baked.uniqueY, o2) : o2[segY.i] + segY.p * (o2[segY.i+1] - o2[segY.i]));
                   vV = isColor ? smartInterpolateColor(laneV.mix, [0, 1], [r1, r2]) : (r1 as number) + laneV.mix * ((r2 as number) - (r1 as number));
                }
            }
            if (!isColor) {
                if (typeof vH !== 'number' || isNaN(vH)) vH = baked.homeProps[k] || 0;
                if (typeof vV !== 'number' || isNaN(vV)) vV = baked.homeProps[k] || 0;
            }
            spatialVals[k] = (isNearH && isNearV) ? (isColor ? smartInterpolateColor(hWeight, [0, 1], [vV, vH]) : vH * hWeight + vV * (1-hWeight)) : (isNearH ? vH : vV);
        });
    };

    runSpatial(baked.numericKeys, baked.bakedH, baked.bakedV, false);
    if (baked.colorKeys.length > 0) runSpatial(baked.colorKeys, baked.bakedCH, baked.bakedCV, true);

    // 2. Event Phase
    const eventResults: Record<string, any> = {};
    const eventColorResults: Record<string, string> = {};

    (Object.entries(baked.eventLanes) as [string, BakedLane][]).forEach(([eName, lane]) => {
        const driver = (events as any)[eName];
        if (!driver) return;
        const val = driver.value;
        const laneLen = lane.values.length;
        const laneWeight = lane.persistent ? 1 : presence; // presence is ~1 on home page
        
        // Debug Log
        if (eName === 'pullDown') {
             // console.log(`[Aniview Worklet] pullDown val: ${val} (Presence: ${presence.toFixed(2)})`);
        }

        lane.keys.forEach((k: string, i: number) => {
            const isColor = baked.colorKeys.includes(k);
            if (isColor) {
                const range = lane.outputRanges[i] as string[];
                let result: string;
                // Safety: interpolateColor needs at least 2 points
                if (laneLen < 2) {
                    result = range[0];
                } else {
                    result = interpolateColor(val, lane.values, range) as string;
                }
                
                // Modulate color towards homeProps[k]
                if (laneWeight < 0.99) {
                    eventColorResults[k] = smartInterpolateColor(laneWeight, [0, 1], [baked.homeProps[k] as string, result]);
                } else {
                    eventColorResults[k] = result;
                }
            } else {
                const range = lane.outputRanges[i] as number[];
                let result = baked.homeProps[k] ?? 0;

                if (laneLen === 1) {
                    const v1 = lane.values[0];
                    if (Math.abs(v1) > 0.001) {
                        result = interpolate(val, [0, v1], [baked.homeProps[k] ?? 0, range[0]], Extrapolation.CLAMP);
                    } else {
                        result = val > 0 ? range[0] : (baked.homeProps[k] ?? 0);
                    }
                } else if (laneLen >= 2) {
                    let hasDuplicate = false;
                    for(let j=0; j<laneLen-1; j++) if(Math.abs(lane.values[j+1] - lane.values[j]) < 0.0001) hasDuplicate = true;
                    if (!hasDuplicate) {
                        result = interpolate(val, lane.values, range, Extrapolation.CLAMP);
                    } else {
                        result = range[0];
                    }
                }

                const diff = (result - (baked.homeProps[k] ?? 0)) * laneWeight;
                if (!eventResults[k]) eventResults[k] = (baked.homeProps[k] ?? 0) + diff;
                else eventResults[k] += diff;
            }
        });
    });

    // 3. Composition Phase
    const compositeNumeric = (k: string, base: number) => {
        const evVal = eventResults[k];
        if (evVal === undefined) return base ?? 0;
        const homeVal = baked.homeProps[k] ?? 0;
        const evDiff = evVal - homeVal;
        
        if (k === 'opacity' || k === '_tr_scale') {
          return (base ?? 0) * (evVal / (homeVal || 1));
        }
        return (base ?? 0) + evDiff;
    };

    finalX = compositeNumeric('worldX', spatialVals.worldX ?? 0);
    finalY = compositeNumeric('worldY', spatialVals.worldY ?? 0);
    finalOp = Math.max(0, Math.min(1, compositeNumeric('opacity', spatialVals.opacity ?? 1)));

    const layoutXKeys = ['left', 'marginLeft'];
    const layoutYKeys = ['top', 'marginTop'];

    // Build final props
    const allKeys = new Set([...baked.numericKeys, ...baked.colorKeys]);
    allKeys.forEach(k => {
        if (k === 'worldX' || k === 'worldY' || k === 'opacity') return;
        const spatialVal = spatialVals[k];
        const isColor = baked.colorKeys.includes(k);
        
        let res: any;
        if (isColor) {
            res = eventColorResults[k] ?? spatialVal ?? baked.homeProps[k];
        } else {
            res = compositeNumeric(k, spatialVal);
        }
        
        if (!isColor && isNaN(res as any)) res = baked.homeProps[k];

        // Redirect layout props to final transform to avoid double-dipping results.
        // This ensures that animating 'marginTop' actually moves the component via translateY.
        if (!isColor) {
            if (layoutXKeys.includes(k)) {
                finalX += (res - (baked.homeProps[k] ?? 0));
                return;
            }
            if (layoutYKeys.includes(k)) {
                finalY += (res - (baked.homeProps[k] ?? 0));
                return;
            }
        }

        if (k.startsWith('_tr_')) {
            if (!props.transform) props.transform = [];
            const tName = k.slice(4);
            let tVal = res; if (tName === 'rotate' || tName === 'rotateX' || tName === 'rotateY' || tName === 'rotateZ') tVal = `${res}deg`;
            props.transform.push({ [tName]: tVal });
        } else if (
            k === 'shadowOffsetWidth' || 
            k === 'shadowOffsetHeight' || 
            k === 'textShadowOffsetWidth' || 
            k === 'textShadowOffsetHeight'
        ) {
            const b = k.startsWith('shadowOffset') ? 'shadowOffset' : 'textShadowOffset';
            props[b] = { ...props[b], [k.endsWith('Width') ? 'width' : 'height']: res };
        } else props[k] = res;
    });

    props.opacity = finalOp;
    const sx = cameraX || 0, sy = cameraY || 0;
    const tx = (finalX - sx), ty = (finalY - sy);
    const baseTransform = baked.baseProps.transform || [];
    props.transform = [{ translateX: isNaN(tx) ? 0 : tx }, { translateY: isNaN(ty) ? 0 : ty }, ...(props.transform || []), ...baseTransform];

    return props;
  }, [baked, dimensions.width, dimensions.height, cameraX_SV, cameraY_SV, events]);

  // Final safety: If no layout yet, show placeholder at opacity 0
  if (!localLayout || hasNoDims) {
    return (
      <Animated.View 
        onLayout={onLayout} 
        style={[
          baseStyle, 
          { 
            opacity: 0,
            width: baseStyle.width ?? dimensions.width,
            height: baseStyle.height ?? dimensions.height
          }
        ]} 
        pointerEvents="none"
      >
        {children}
      </Animated.View>
    );
  }

  if (!shouldRender && !persistent) return null;

  return (
    <Animated.View style={animatedStyle as any} {...rest}>
      {children}
    </Animated.View>
  );
}
