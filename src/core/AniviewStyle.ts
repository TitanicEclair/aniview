/**
 * AniviewStyle — UI-thread animation worklet.
 *
 * This module runs on the Reanimated UI thread every frame via
 * `useAnimatedStyle`. It consumes a pre-baked {@link BakedResult}
 * and produces the final animated `ViewStyle` by:
 *
 * 1. Native virtualization — hiding components far from the camera
 * 2. Presence calculation — proximity factor modulating event effects
 * 3. Spatial interpolation — 2D bilinear blend across H+V lanes
 * 4. Event interpolation — 1D lane interpolation per event driver
 * 5. Composition — combining spatial baseline with event offsets
 */

import {
  interpolate,
  interpolateColor,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { ViewStyle } from 'react-native';
import { BakedLane, BakedResult, IAniviewConfig, AniviewContextType } from '../useAniviewContext';
import { smartInterpolateColor, getSegmentInfo } from './AniviewColor';

/**
 * Computes the complete animated style for an Aniview component.
 *
 * Called from within `useAnimatedStyle` on the UI thread every frame.
 * Reads camera position SharedValues and produces the interpolated
 * style object including `translateX`/`translateY` for world positioning.
 *
 * @param baked - Pre-computed bake data from {@link bakeKeyframes}.
 * @param cameraX_SV - Camera X position SharedValue.
 * @param cameraY_SV - Camera Y position SharedValue.
 * @param events - All event SharedValues including camera x/y.
 * @param config - The Aniview configuration engine.
 * @param dimensions - Current viewport/page dimensions.
 * @param isSingleRow - Whether the layout has only one row.
 * @returns Complete animated `ViewStyle` for the current frame.
 */
export function computeAnimatedStyle(
  baked: BakedResult,
  cameraX_SV: SharedValue<number>,
  cameraY_SV: SharedValue<number>,
  events: AniviewContextType['events'],
  config: IAniviewConfig,
  dimensions: AniviewContextType['dimensions'],
  isSingleRow: boolean,
): ViewStyle {
  'worklet';
  const cameraX = cameraX_SV.value;
  const cameraY = cameraY_SV.value;

  // ── NATIVE VIRTUALIZATION CHECK ──
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
  if (
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    isNaN(dimensions.width) ||
    isNaN(dimensions.height)
  ) {
    return { opacity: 0 };
  }

  // ── PRESENCE CALCULATION ──
  const windowX = dimensions.width * 0.4;
  const windowY = dimensions.height * 0.4;

  let pX = 1 - Math.min(1, Math.max(0, Math.abs(cameraX - baked.homeX) / windowX));
  let pY = isSingleRow
    ? 1
    : 1 - Math.min(1, Math.max(0, Math.abs(cameraY - baked.homeY) / windowY));

  if (!pX || isNaN(pX)) pX = 0;
  if (!pY || isNaN(pY)) pY = 0;

  const presenceX = Math.pow(pX, 2);
  const presenceY = isSingleRow ? 1 : Math.pow(pY, 2);
  const presence = presenceX * presenceY;

  // ── LANE LOOKUP ──
  const getLaneInfo = (lanes: any[], pos: number) => {
    if (!lanes || lanes.length === 0) return null;
    let i = 0;
    while (i < lanes.length - 1 && pos > lanes[i].fixed) i++;
    const l1idx = Math.max(0, i - 1),
      l2idx = i;
    const l1 = lanes[l1idx],
      l2 = lanes[l2idx];
    if (!l1 || !l2) return null;
    const gap = l2.fixed - l1.fixed;
    const mix = Math.max(0, Math.min(1, gap > 0.1 ? (pos - l1.fixed) / gap : 0));
    return {
      l1: { ...l1, idx: l1idx },
      l2: { ...l2, idx: l2idx },
      mix,
      dist: Math.min(Math.abs(pos - l1.fixed), Math.abs(pos - l2.fixed)),
    };
  };

  const laneH = getLaneInfo(baked.bakedH, cameraY);
  const laneV = getLaneInfo(baked.bakedV, cameraX);
  if (!laneH || !laneV) return { opacity: 0 };

  const viewportSize = dimensions.width;
  const isNearH = laneH.dist < viewportSize;
  const isNearV = laneV.dist < viewportSize;
  if (!isNearH && !isNearV) return { opacity: 0 };

  const props: any = {
    ...baked.baseProps.rest,
    position: 'absolute',
    width: baked.baseProps.rest.width ?? dimensions.width,
    height: baked.baseProps.rest.height ?? dimensions.height,
  };
  props.left = 0;
  props.top = 0;
  const hWeight = isNearV
    ? isNearH
      ? laneV.dist / (laneH.dist + laneV.dist + 0.001)
      : 0
    : 1;

  // ── SEGMENT LOOKUP (once per frame) ──
  const segX = getSegmentInfo(cameraX, baked.uniqueX);
  const segY = getSegmentInfo(cameraY, baked.uniqueY);

  let finalX = 0,
    finalY = 0,
    finalOp = 1;

  const spatialVals: Record<string, any> = { ...baked.homeProps };

  // ── SPATIAL INTERPOLATION ──
  const runSpatial = (
    keys: string[],
    baked_H: any[],
    baked_V: any[],
    isColor: boolean,
  ) => {
    const laneH_L = baked_H[laneH.l1.idx || 0],
      laneH_R = baked_H[laneH.l2.idx || 0];
    const laneV_L = baked_V[laneV.l1.idx || 0],
      laneV_R = baked_V[laneV.l2.idx || 0];

    keys.forEach((k, i) => {
      let vH: any = baked.homeProps[k],
        vV: any = baked.homeProps[k];
      if (isNearH && laneH_L && laneH_R) {
        const o1 = laneH_L.values[i],
          o2 = laneH_R.values[i];
        if (o1 && o2) {
          const r1 =
            laneH_L.constFlags[i] || segX.constant
              ? o1[segX.i]
              : isColor
                ? smartInterpolateColor(cameraX, baked.uniqueX, o1)
                : o1[segX.i] + segX.p * (o1[segX.i + 1] - o1[segX.i]);
          const r2 =
            laneH_R.constFlags[i] || segX.constant
              ? o2[segX.i]
              : isColor
                ? smartInterpolateColor(cameraX, baked.uniqueX, o2)
                : o2[segX.i] + segX.p * (o2[segX.i + 1] - o2[segX.i]);
          vH = isColor
            ? smartInterpolateColor(laneH.mix, [0, 1], [r1, r2])
            : (r1 as number) + laneH.mix * ((r2 as number) - (r1 as number));
        }
      }
      if (isNearV && laneV_L && laneV_R) {
        const o1 = laneV_L.values[i],
          o2 = laneV_R.values[i];
        if (o1 && o2) {
          const r1 =
            laneV_L.constFlags[i] || segY.constant
              ? o1[segY.i]
              : isColor
                ? smartInterpolateColor(cameraY, baked.uniqueY, o1)
                : o1[segY.i] + segY.p * (o1[segY.i + 1] - o1[segY.i]);
          const r2 =
            laneV_R.constFlags[i] || segY.constant
              ? o2[segY.i]
              : isColor
                ? smartInterpolateColor(cameraY, baked.uniqueY, o2)
                : o2[segY.i] + segY.p * (o2[segY.i + 1] - o2[segY.i]);
          vV = isColor
            ? smartInterpolateColor(laneV.mix, [0, 1], [r1, r2])
            : (r1 as number) + laneV.mix * ((r2 as number) - (r1 as number));
        }
      }
      if (!isColor) {
        if (typeof vH !== 'number' || isNaN(vH)) vH = baked.homeProps[k] || 0;
        if (typeof vV !== 'number' || isNaN(vV)) vV = baked.homeProps[k] || 0;
      }
      spatialVals[k] =
        isNearH && isNearV
          ? isColor
            ? smartInterpolateColor(hWeight, [0, 1], [vV, vH])
            : vH * hWeight + vV * (1 - hWeight)
          : isNearH
            ? vH
            : vV;
    });
  };

  runSpatial(baked.numericKeys, baked.bakedH, baked.bakedV, false);
  if (baked.colorKeys.length > 0)
    runSpatial(baked.colorKeys, baked.bakedCH, baked.bakedCV, true);

  // ── EVENT PHASE ──
  const eventResults: Record<string, any> = {};
  const eventColorResults: Record<string, string> = {};

  (Object.entries(baked.eventLanes) as [string, BakedLane][]).forEach(
    ([eName, lane]) => {
      const driver = (events as any)[eName];
      if (!driver) return;
      const val = driver.value;
      const laneLen = lane.values.length;
      const laneWeight = lane.eventPersistent ? 1 : presence;

      lane.keys.forEach((k: string, i: number) => {
        const isColor = baked.colorKeys.includes(k);
        if (isColor) {
          const range = lane.outputRanges[i] as string[];
          let result: string;
          if (laneLen < 2) {
            result = range[0];
          } else {
            result = interpolateColor(val, lane.values, range) as string;
          }

          if (laneWeight < 0.99) {
            eventColorResults[k] = smartInterpolateColor(
              laneWeight,
              [0, 1],
              [baked.homeProps[k] as string, result],
            );
          } else {
            eventColorResults[k] = result;
          }
        } else {
          const range = lane.outputRanges[i] as number[];
          let result = baked.homeProps[k] ?? 0;

          if (laneLen === 1) {
            const v1 = lane.values[0];
            if (Math.abs(v1) > 0.001) {
              result = interpolate(
                val,
                [0, v1],
                [baked.homeProps[k] ?? 0, range[0]],
                Extrapolation.CLAMP,
              );
            } else {
              result = val > 0 ? range[0] : (baked.homeProps[k] ?? 0);
            }
          } else if (laneLen >= 2) {
            let hasDuplicate = false;
            for (let j = 0; j < laneLen - 1; j++)
              if (Math.abs(lane.values[j + 1] - lane.values[j]) < 0.0001)
                hasDuplicate = true;
            if (!hasDuplicate) {
              result = interpolate(val, lane.values, range, Extrapolation.CLAMP);
            } else {
              result = range[0];
            }
          }

          const diff = (result - (baked.homeProps[k] ?? 0)) * laneWeight;
          if (!eventResults[k])
            eventResults[k] = (baked.homeProps[k] ?? 0) + diff;
          else eventResults[k] += diff;
        }
      });
    },
  );

  // ── COMPOSITION PHASE ──
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
  finalOp = Math.max(
    0,
    Math.min(1, compositeNumeric('opacity', spatialVals.opacity ?? 1)),
  );

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

    // Redirect layout props to final transform to avoid double-dipping
    if (!isColor) {
      if (layoutXKeys.includes(k)) {
        finalX += res - (baked.homeProps[k] ?? 0);
        return;
      }
      if (layoutYKeys.includes(k)) {
        finalY += res - (baked.homeProps[k] ?? 0);
        return;
      }
    }

    if (k.startsWith('_tr_')) {
      if (!props.transform) props.transform = [];
      const tName = k.slice(4);
      let tVal = res;
      if (
        tName === 'rotate' ||
        tName === 'rotateX' ||
        tName === 'rotateY' ||
        tName === 'rotateZ'
      )
        tVal = `${res}deg`;
      props.transform.push({ [tName]: tVal });
    } else if (
      k === 'shadowOffsetWidth' ||
      k === 'shadowOffsetHeight' ||
      k === 'textShadowOffsetWidth' ||
      k === 'textShadowOffsetHeight'
    ) {
      const b = k.startsWith('shadowOffset')
        ? 'shadowOffset'
        : 'textShadowOffset';
      props[b] = {
        ...props[b],
        [k.endsWith('Width') ? 'width' : 'height']: res,
      };
    } else props[k] = res;
  });

  props.opacity = finalOp;
  const sx = cameraX || 0,
    sy = cameraY || 0;
  const tx = finalX - sx,
    ty = finalY - sy;
  const baseTransform = baked.baseProps.transform || [];
  props.transform = [
    { translateX: isNaN(tx) ? 0 : tx },
    { translateY: isNaN(ty) ? 0 : ty },
    ...(props.transform || []),
    ...baseTransform,
  ];

  return props;
}
