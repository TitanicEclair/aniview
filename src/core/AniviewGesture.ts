/**
 * AniviewGesture — Pan gesture factory for the world-coordinate camera.
 *
 * Extracted from `AniviewConfig.generateGesture()` so that gesture
 * orchestration lives in its own module, separate from layout math.
 */

import { Gesture, GestureType } from 'react-native-gesture-handler';
import {
  SharedValue,
  withSpring,
  makeMutable,
  runOnJS,
  WithSpringConfig,
} from 'react-native-reanimated';
import type { RefObject } from 'react';
import { AniviewContextType } from '../useAniviewContext';
import * as AniviewMath from './AniviewMath';

// ── Types ────────────────────────────────────────────

/** Config-derived values pre-computed before gesture creation. */
export interface GestureInput {
  layout: number[][];
  defaultPage: number;
  rowOverlaps: number[];
  colOverlaps: number[];
  pageMap: Record<string, number>;
  springConfig: WithSpringConfig;
  pages: number[];
  contextDims: AniviewContextType['dimensions'];
}

/** Runtime SharedValues passed in from the provider. */
export interface GestureSharedValues {
  x: SharedValue<number>;
  y: SharedValue<number>;
  onPageChange?: (pageId: number | string) => void;
  lockMask?: SharedValue<number>;
  simultaneousHandlers?: RefObject<GestureType> | RefObject<GestureType>[];
  gestureEnabled?: SharedValue<boolean>;
  dims?: AniviewContextType['dimensions'];
  isSnapping?: SharedValue<boolean>;
  lastTargetId?: SharedValue<number | string>;
}

// ── Gesture tuning constants ─────────────────────────

const GESTURE_TUNING = {
  MIN_DISTANCE: 10,
  RESISTANCE: 0.08,
  AXIS_TRANSLATION_THRESHOLD: 3,
  MAX_SWIPE_PAGES: 1.2,
  LOCAL_OVERSCROLL_MULTIPLIER: 1.5,
  VELOCITY_THRESHOLD: 200,
  DISTANCE_THRESHOLD_RATIO: 0.08,
  START_FOUND_RATIO: 0.3,
  BOUNDARY_VELOCITY_DAMPING: 0.5,
  LOCK_LEFT_BIT: 1,
  LOCK_RIGHT_BIT: 2,
  LOCK_UP_BIT: 4,
  LOCK_DOWN_BIT: 8,
} as const;

// ── Factory ───────────────────────────────────────────

/**
 * Creates the core Pan gesture that drives the Aniview camera.
 *
 * All config-derived values are pre-computed and passed via `input`.
 * Runtime SharedValues are passed via `sv`. The returned gesture is
 * ready to be used with RNGH's `GestureDetector`.
 *
 * @param input - Pre-computed config values (layout, pages, bounds, etc.).
 * @param sv - Runtime SharedValues (camera x/y, lock mask, etc.).
 * @returns Configured RNGH Pan gesture.
 */
export function createPanGesture(
  input: GestureInput,
  sv: GestureSharedValues,
) {
  const {
    layout,
    defaultPage,
    rowOverlaps,
    colOverlaps,
    pageMap,
    springConfig,
    pages,
    contextDims,
  } = input;

  const {
    x,
    y,
    onPageChange,
    lockMask,
    simultaneousHandlers,
    gestureEnabled,
    isSnapping,
    lastTargetId,
  } = sv;

  const bounds = AniviewMath.getWorldBounds(
    pages, layout, contextDims, defaultPage, rowOverlaps, colOverlaps,
  );
  const isSingleRow = layout.length <= 1;
  const screenWidth = contextDims.width;
  const screenHeight = contextDims.height;
  const rowLength = Math.max(1, layout[0]?.length || 0);

  const resolveId = (pid: number | string) => {
    'worklet';
    if (typeof pid === 'number') return pid;
    if (pageMap && pageMap[pid] !== undefined) return pageMap[pid];
    return 0;
  };

  // Pre-calculate snap points
  const snapPointsProcessed = pages.map(pageId => {
    const offset = AniviewMath.getPageOffset(
      pageId, layout, contextDims, defaultPage, rowOverlaps, colOverlaps,
    );
    return {
      id: pageId,
      x: offset.x,
      y: offset.y,
      row: Math.floor(pageId / rowLength),
      col: pageId % rowLength,
    };
  });

  const triggerPageChange = (pageId: number) => {
    'worklet';
    if (onPageChange) {
      runOnJS(onPageChange)(pageId);
    }
  };

  const startX = makeMutable(0);
  const startY = makeMutable(0);
  const internalIsSnapping = makeMutable(false);
  const isSnappingVal = isSnapping || internalIsSnapping;
  const activeAxis = makeMutable(0);
  const wasDisabled = makeMutable(false);

  let pan = Gesture.Pan();
  if (simultaneousHandlers) {
    if (Array.isArray(simultaneousHandlers)) {
      pan = pan.simultaneousWithExternalGesture(...simultaneousHandlers);
    } else {
      pan = pan.simultaneousWithExternalGesture(simultaneousHandlers);
    }
  }

  return pan
    .minDistance(GESTURE_TUNING.MIN_DISTANCE)
    .onBegin(() => {
      'worklet';
      isSnappingVal.value = false;
      activeAxis.value = 0;
      wasDisabled.value = false;

      if (isNaN(x.value)) x.value = 0;
      if (isNaN(y.value)) y.value = 0;

      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((gestureEvent) => {
      'worklet';
      const currentResyncX = x.value + gestureEvent.translationX;
      const currentResyncY = y.value + gestureEvent.translationY;

      if (gestureEnabled && gestureEnabled.value === false) {
        startX.value = currentResyncX;
        startY.value = currentResyncY;
        wasDisabled.value = true;
        return;
      }

      if (wasDisabled.value) {
        startX.value = currentResyncX;
        startY.value = currentResyncY;
        wasDisabled.value = false;
      }

      isSnappingVal.value = true;

      const dx = Math.abs(gestureEvent.translationX);
      const dy = Math.abs(gestureEvent.translationY);
      const isHBlocked = lockMask && (
        lockMask.value & (GESTURE_TUNING.LOCK_LEFT_BIT | GESTURE_TUNING.LOCK_RIGHT_BIT)
      );
      const isVBlocked = lockMask && (
        lockMask.value & (GESTURE_TUNING.LOCK_UP_BIT | GESTURE_TUNING.LOCK_DOWN_BIT)
      );

      if (activeAxis.value === 0 && (dx > GESTURE_TUNING.AXIS_TRANSLATION_THRESHOLD || dy > GESTURE_TUNING.AXIS_TRANSLATION_THRESHOLD)) {
        activeAxis.value = dx > dy ? 1 : 2;
      }

      let newX = startX.value;
      let newY = startY.value;

      if (activeAxis.value === 1 || activeAxis.value === 0) {
        if (isHBlocked) {
          startX.value = x.value + gestureEvent.translationX;
        } else {
          newX = startX.value - gestureEvent.translationX;
        }
      }

      if (!isSingleRow && (activeAxis.value === 2 || activeAxis.value === 0)) {
        if (isVBlocked) {
          startY.value = y.value + gestureEvent.translationY;
        } else {
          newY = startY.value - gestureEvent.translationY;
        }
      }

      if (activeAxis.value === 2) {
        newX = startX.value;
      }
      if (activeAxis.value === 1) {
        newY = startY.value;
      }

      if (isNaN(newX)) newX = startX.value;
      if (isNaN(newY)) newY = startY.value;

      const maxSwipeDistance = screenWidth * GESTURE_TUNING.MAX_SWIPE_PAGES;
      const deltaX = newX - startX.value;
      if (Math.abs(deltaX) > maxSwipeDistance) {
        newX = startX.value + (deltaX > 0 ? maxSwipeDistance : -maxSwipeDistance);
      }

      const localLimitX = screenWidth * GESTURE_TUNING.LOCAL_OVERSCROLL_MULTIPLIER;
      const localLimitY = screenHeight * GESTURE_TUNING.LOCAL_OVERSCROLL_MULTIPLIER;
      const lowX = startX.value - localLimitX;
      const highX = startX.value + localLimitX;

      if (newX < bounds.minX) newX = bounds.minX + (newX - bounds.minX) * GESTURE_TUNING.RESISTANCE;
      else if (newX > bounds.maxX) newX = bounds.maxX + (newX - bounds.maxX) * GESTURE_TUNING.RESISTANCE;

      if (newX < lowX) newX = lowX + (newX - lowX) * GESTURE_TUNING.RESISTANCE;
      else if (newX > highX) newX = highX + (newX - highX) * GESTURE_TUNING.RESISTANCE;

      if (!isSingleRow) {
        const lowY = startY.value - localLimitY;
        const highY = startY.value + localLimitY;

        if (newY < bounds.minY) newY = bounds.minY + (newY - bounds.minY) * GESTURE_TUNING.RESISTANCE;
        else if (newY > bounds.maxY) newY = bounds.maxY + (newY - bounds.maxY) * GESTURE_TUNING.RESISTANCE;

        if (newY < lowY) newY = lowY + (newY - lowY) * GESTURE_TUNING.RESISTANCE;
        else if (newY > highY) newY = highY + (newY - highY) * GESTURE_TUNING.RESISTANCE;
      }

      x.value = newX;
      y.value = newY;
    })
    .onEnd((gestureEvent) => {
      'worklet';
      if (gestureEnabled && gestureEnabled.value === false) return;
      if (snapPointsProcessed.length === 0) return;

      const distanceThresholdX = screenWidth * GESTURE_TUNING.DISTANCE_THRESHOLD_RATIO;
      const distanceThresholdY = screenHeight * GESTURE_TUNING.DISTANCE_THRESHOLD_RATIO;

      const stageStartX = startX.value;
      const stageStartY = startY.value;

      let anchorRow = 0, anchorCol = 0, anchorId = -1;
      let minStartDist = Infinity;
      for (let index = 0; index < snapPointsProcessed.length; index++) {
        const snapPoint = snapPointsProcessed[index];
        const dist = Math.sqrt(Math.pow(stageStartX - snapPoint.x, 2) + Math.pow(stageStartY - snapPoint.y, 2));
        if (dist < minStartDist) {
          minStartDist = dist;
          anchorRow = snapPoint.row;
          anchorCol = snapPoint.col;
          anchorId = snapPoint.id;
        }
      }
      const startFound = minStartDist < screenWidth * GESTURE_TUNING.START_FOUND_RATIO;

      let targetX = -1;
      let targetY = -1;
      let targetId = -1;

      const intentRight = gestureEvent.velocityX < -GESTURE_TUNING.VELOCITY_THRESHOLD || gestureEvent.translationX < -distanceThresholdX;
      const intentLeft = gestureEvent.velocityX > GESTURE_TUNING.VELOCITY_THRESHOLD || gestureEvent.translationX > distanceThresholdX;
      const intentDown = gestureEvent.velocityY < -GESTURE_TUNING.VELOCITY_THRESHOLD || gestureEvent.translationY < -distanceThresholdY;
      const intentUp = gestureEvent.velocityY > GESTURE_TUNING.VELOCITY_THRESHOLD || gestureEvent.translationY > distanceThresholdY;

      if (startFound && (intentRight || intentLeft || (!isSingleRow && (intentDown || intentUp)))) {
        let targetRow = anchorRow;
        let targetCol = anchorCol;

        if (activeAxis.value === 1) {
          if (intentRight) targetCol = anchorCol + 1;
          else if (intentLeft) targetCol = anchorCol - 1;
        } else if (activeAxis.value === 2 && !isSingleRow) {
          if (intentDown) targetRow = anchorRow + 1;
          else if (intentUp) targetRow = anchorRow - 1;
        }

        for (let index = 0; index < snapPointsProcessed.length; index++) {
          const snapPoint = snapPointsProcessed[index];
          if (snapPoint.row === targetRow && snapPoint.col === targetCol) {
            targetX = snapPoint.x;
            targetY = snapPoint.y;
            targetId = snapPoint.id;
            break;
          }
        }
      }

      if (targetX === -1) {
        let minDistance = Infinity;
        for (let index = 0; index < snapPointsProcessed.length; index++) {
          const snapPoint = snapPointsProcessed[index];

          if (activeAxis.value === 1 && snapPoint.row !== anchorRow) continue;
          if (activeAxis.value === 2 && snapPoint.col !== anchorCol) continue;

          const dist = Math.sqrt(Math.pow(x.value - snapPoint.x, 2) + Math.pow(y.value - snapPoint.y, 2));
          if (dist < minDistance) {
            minDistance = dist;
            targetX = snapPoint.x;
            targetY = snapPoint.y;
            targetId = snapPoint.id;
          }
        }
      }

      if (targetId === -1) {
        targetId = anchorId;
        const snapPoint = snapPointsProcessed.find(p => p.id === anchorId);
        if (snapPoint) {
          targetX = snapPoint.x;
          targetY = snapPoint.y;
        }
      }

      if (targetId !== -1 && targetId !== anchorId) {
        triggerPageChange(targetId);
      }

      const isBoundaryX = targetX <= bounds.minX || targetX >= bounds.maxX;
      const isBoundaryY = targetY <= bounds.minY || targetY >= bounds.maxY;
      const velocityDamping = GESTURE_TUNING.BOUNDARY_VELOCITY_DAMPING;

      x.value = withSpring(targetX, {
        ...springConfig,
        velocity: isBoundaryX ? -gestureEvent.velocityX * velocityDamping : -gestureEvent.velocityX,
      }, (finished) => {
        if (finished) isSnappingVal.value = false;
      });

      if (!isSingleRow) {
        y.value = withSpring(targetY, {
          ...springConfig,
          velocity: isBoundaryY ? -gestureEvent.velocityY * velocityDamping : -gestureEvent.velocityY,
        });
      } else {
        y.value = withSpring(targetY, springConfig);
      }

      isSnappingVal.value = true;
    })
    .onFinalize((event, success) => {
      'worklet';
      if (!success || activeAxis.value === 0) return;

      if (gestureEnabled && gestureEnabled.value === false) return;
      if (isSnappingVal.value) return;

      let minDistance = Infinity;
      let targetX = x.value;
      let targetY = y.value;
      let targetId = -1;
      const snapPointsCount = snapPointsProcessed.length;

      for (let index = 0; index < snapPointsCount; index++) {
        const snapPoint = snapPointsProcessed[index];
        const dist = Math.sqrt(Math.pow(x.value - snapPoint.x, 2) + Math.pow(y.value - snapPoint.y, 2));
        if (dist < minDistance) {
          minDistance = dist;
          targetX = snapPoint.x;
          targetY = snapPoint.y;
          targetId = snapPoint.id;
        }
      }

      if (lastTargetId) {
        const currentProgrammaticId = resolveId(lastTargetId.value);
        const stageStartX = startX.value;
        const stageStartY = startY.value;

        let anchorId2 = -1;
        let minStartDist2 = Infinity;
        for (let index = 0; index < snapPointsCount; index++) {
          const snapPoint = snapPointsProcessed[index];
          const dist = Math.sqrt(Math.pow(stageStartX - snapPoint.x, 2) + Math.pow(stageStartY - snapPoint.y, 2));
          if (dist < minStartDist2) {
            minStartDist2 = dist;
            anchorId2 = snapPoint.id;
          }
        }

        if (currentProgrammaticId !== anchorId2 && Math.abs(minDistance) < screenWidth * 0.2) {
          targetId = currentProgrammaticId;
          const snapPoint = snapPointsProcessed.find(p => p.id === targetId);
          if (snapPoint) {
            targetX = snapPoint.x;
            targetY = snapPoint.y;
          }
        }
      }

      if (targetId !== -1) {
        triggerPageChange(targetId);
      }

      x.value = withSpring(targetX, springConfig, (finished) => {
        if (finished) isSnappingVal.value = false;
      });
      y.value = withSpring(targetY, springConfig);
      isSnappingVal.value = true;
    });
}
