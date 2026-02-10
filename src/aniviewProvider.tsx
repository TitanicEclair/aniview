import React, { useMemo, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { LayoutChangeEvent, View, Dimensions as RNDimensions, LayoutRectangle } from 'react-native';
import Animated, { useSharedValue, withSpring, makeMutable, SharedValue, WithSpringConfig } from 'react-native-reanimated';
import { AniviewContext, AniviewContextType, AniviewHandle, AniviewFrame, BakedFrame, IAniviewConfig, WorldBounds } from "./useAniviewContext";
import { AniviewConfig } from './aniviewConfig';
import { GestureDetector, PanGesture } from 'react-native-gesture-handler';
import * as AniviewMath from './core/AniviewMath';

export interface AniviewProviderProps {
  children: React.ReactNode;
  /** Explicitly provide a config instance (Advanced) */
  config?: AniviewConfig;
  /** The grid layout matrix (e.g., [[1, 1, 1, 1]]) - Simple setup */
  layout?: number[][];
  /** The source-of-truth origin page */
  defaultPage?: number;
  /** Explicitly override page size. Defaults to container size. */
  pageSize?: { width: number; height: number };
  /** Callback when page changes */
  onPageChange?: (pageId: number | string) => void;
  /** Imperative active page control (Legacy) - prefer ref.snapToPage */
  activePage?: number | string;
  /** Map of semantic names to numeric page IDs */
  pageMap?: Record<string, number>;
  /** External ref for the internal PanGesture (for coordination) */
  gestureRef?: React.RefObject<any>;
  /** Custom spring physics */
  springConfig?: WithSpringConfig;
  /** External events to drive animations */
  events?: Record<string, SharedValue<number>>;
  /** Explicit dimensions override */
  dimensions?: Partial<AniviewContextType['dimensions']>;
  /** External lockMask for gesture coordination */
  externalLockMask?: SharedValue<number>;
  /** External gesture enabled control (simple on/off) */
  gestureEnabled?: SharedValue<boolean>;
  /** Simultaneous gesture handlers for coordination */
  simultaneousHandlers?: any;
}

/**
 * **AniviewProvider** — World Coordinate System & Gesture Controller
 *
 * The root provider that establishes the virtual 2D world in which all
 * child `Aniview` components live. It manages:
 *
 * - **The Camera** (`events.x`, `events.y` SharedValues) — the current
 *   viewport position in world coordinates, driven by gestures or
 *   programmatic `snapToPage` calls.
 * - **Pan Gesture** — a RNGH Pan gesture that translates finger movement
 *   into camera position updates, with axis locking, edge resistance,
 *   velocity-based snapping, and bitmask-based directional locks.
 * - **Virtualization** — tracks which pages are "near" the camera and
 *   provides a `visiblePages` set for child components.
 * - **Custom Events** — user-supplied SharedValues (e.g., scroll position,
 *   slider value) that drive event-based keyframe animations.
 *
 * ### Sizing behavior
 *
 * By default, the provider measures its own container via `onLayout`
 * and uses that as the page size. Override with `pageSize` or
 * `dimensions` if you need explicit control (e.g., for offscreen pages
 * that are larger than the visible container).
 *
 * ### Imperative API
 *
 * Attach a `ref` to access `snapToPage(pageId)`, `getCurrentPage()`,
 * and `lock(mask)` for programmatic navigation.
 *
 * @param props.config - Pre-built `AniviewConfig` instance (advanced). Mutually exclusive with `layout`.
 * @param props.layout - Grid matrix (e.g., `[[1, 1, 1]]` for 3 horizontal pages). Creates an `AniviewConfig` internally.
 * @param props.defaultPage - The initial page ID (default: `0`).
 * @param props.pageMap - Semantic name → numeric ID mapping (e.g., `{ HOME: 0, SETTINGS: 1 }`).
 * @param props.pageSize - Explicit page dimensions. If omitted, inferred from container layout.
 * @param props.onPageChange - Fires when the camera snaps to a new page.
 * @param props.springConfig - Custom spring physics for snap animations.
 * @param props.events - Additional SharedValues that drive event-based keyframes.
 * @param props.externalLockMask - Externally controlled bitmask SharedValue for gesture locking. See {@link useAniviewLock}.
 * @param props.gestureEnabled - SharedValue to globally enable/disable the pan gesture.
 * @param props.simultaneousHandlers - RNGH refs for gesture coordination with parent/sibling handlers.
 * @param props.activePage - (Legacy) Declarative page control. Prefer `ref.snapToPage()`.
 *
 * @example
 * ```tsx
 * const config = new AniviewConfig([[1, 1, 1]], 0, { HOME: 0, FEED: 1, PROFILE: 2 });
 * const scrollY = useSharedValue(0);
 *
 * <AniviewProvider ref={aniviewRef} config={config} events={{ scrollY }} onPageChange={setPage}>
 *   <Aniview pageId="HOME">...</Aniview>
 *   <Aniview pageId="FEED">...</Aniview>
 * </AniviewProvider>
 * ```
 */
export const AniviewProvider = forwardRef<AniviewHandle, AniviewProviderProps>(({
  children,
  config: providedConfig,
  layout,
  defaultPage = 0,
  pageSize,
  onPageChange,
  activePage,
  gestureRef,
  springConfig,
  events: externalEvents,
  pageMap = {},
  dimensions: providedDims,
  externalLockMask,
  gestureEnabled: externalGestureEnabled,
  simultaneousHandlers
}: AniviewProviderProps, ref: React.Ref<AniviewHandle>) => {
  // --- CONFIG MANAGEMENT ---
  const config = useMemo(() => {
    if (providedConfig) return providedConfig;
    if (layout) return new AniviewConfig(layout, defaultPage, pageMap, {}, {}, {});
    return new AniviewConfig([[1]], 0, pageMap, {}, {}, {}); // Fallback
  }, [providedConfig, layout, defaultPage, pageMap]);

  // --- STATE & PHYSICS ---
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  
  // Use external lockMask if provided, otherwise create internal one
  const internalLockMask = useSharedValue(0);
  const lockMask = externalLockMask || internalLockMask;
  
  // Use external gestureEnabled if provided, otherwise create internal one
  const internalGestureEnabled = useSharedValue(true);
  const gestureEnabled = externalGestureEnabled || internalGestureEnabled;
  const lastTargetId = useSharedValue<number | string>(config.defaultPage);
  const isMoving = useSharedValue(false);
  
  const [dimensions, setDimensions] = useState<AniviewContextType['dimensions']>({
    width: providedDims?.width ?? pageSize?.width ?? 0,
    height: providedDims?.height ?? pageSize?.height ?? 0,
    offsetX: providedDims?.offsetX ?? 0,
    offsetY: providedDims?.offsetY ?? 0
  });

  // --- VIRTUALIZATION STATE ---
  // Tracks which pages are near the "viewport" on the JS thread
  // We use a ref and a forced refresh ONLY when absolutely needed to prevent 
  // every Aniview component from re-rendering on every page traversal.
  const visiblePagesRef = useRef<Set<number>>(new Set([config.resolvePageId(defaultPage)]));

  const updateVisibility = (centerPage: number | string) => {
    const visible = new Set<number>();
    const pages = config.getPages();
    const resolvedCenter = config.resolvePageId(centerPage);
    const centerPos = AniviewMath.pageIdToMatrixPos(resolvedCenter, (config as any).layout);

    pages.forEach((p: number) => {
        const pPos = AniviewMath.pageIdToMatrixPos(p, (config as any).layout);
        const rowDist = Math.abs(pPos.r - centerPos.r);
        const colDist = Math.abs(pPos.c - centerPos.c);
        if (rowDist <= 1 && colDist <= 1) visible.add(p);
    });

    const current = visiblePagesRef.current;
    if (current.size !== visible.size || ![...visible].every(v => current.has(v))) {
        visiblePagesRef.current = visible;
        // Optimization: NO BROADCAST. 
        // We rely on the native proxy for virtualization checks within worklets.
    }
  };

  // Sync the SharedValue target into the config engine for virtualization worklets
  useEffect(() => {
    if ((config as any)._setCurrentPageSV) {
      (config as any)._setCurrentPageSV(lastTargetId);
    }
  }, [config, lastTargetId]);

  // --- IMPERATIVE API ---
  useImperativeHandle(ref, () => ({
    snapToPage: (pageId: number | string) => {
      const offset = config.getPageOffset(pageId, dimensions);
      const springConfig = config.getSpringConfig();
      
      isMoving.value = true;
      x.value = withSpring(offset.x, springConfig, (finished) => {
        if (finished) isMoving.value = false;
      });
      y.value = withSpring(offset.y, springConfig);
      
      lastTargetId.value = pageId;
      updateVisibility(pageId);
      if (onPageChange) onPageChange(pageId);
    },
    getCurrentPage: () => lastTargetId.value,
    lock: (mask: number) => { lockMask.value = mask; }
  }));

  // --- DYNAMIC UPDATES ---
  useEffect(() => {
    if (springConfig) config.updateSpringConfig(springConfig);
  }, [springConfig, config]);

  useEffect(() => {
    config.updateDimensions(dimensions);
  }, [dimensions, config]);

  // --- ONLAYOUT AUTO-SIZING ---
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height, x: layoutX, y: layoutY } = e.nativeEvent.layout;
    
    // Only update if dimensions drastically changed (debounce/diff)
    if (
      Math.abs(width - dimensions.width) > 1 || 
      Math.abs(height - dimensions.height) > 1 ||
      Math.abs(layoutX - dimensions.offsetX) > 1 ||
      Math.abs(layoutY - dimensions.offsetY) > 1
    ) {
      setDimensions(prev => ({
        ...prev,
        width: providedDims?.width ?? (pageSize?.width || width),
        height: providedDims?.height ?? (pageSize?.height || height),
        offsetX: layoutX,
        offsetY: layoutY
      }));
    }
  };

  // --- VIRTUALIZATION ---
  const activationMap = useMemo(() => {
    const map: Record<number, any> = {};
    config.getPages().forEach(id => {
      map[id] = makeMutable(1);
    });
    return map;
  }, [config]);

  // --- BOOTSTRAPPING ---
  useEffect(() => {
    if (config) {
      const offset = config.getPageOffset(config.defaultPage, dimensions);
      x.value = offset.x;
      y.value = offset.y;
      lastTargetId.value = config.defaultPage;
    }
  }, [config]);

  // --- LEGACY TAB SYNC ---
  useEffect(() => {
    if (config && activePage !== undefined) {
      if (lastTargetId.value === activePage) return;
      const offset = config.getPageOffset(activePage, dimensions);
      const isMoved = Math.abs(x.value - offset.x) > 1 || Math.abs(y.value - offset.y) > 1;

      if (isMoved) {
        const physics = config.getSpringConfig();
        isMoving.value = true;
        x.value = withSpring(offset.x, physics, (finished) => {
          if (finished) isMoving.value = false;
        });
        y.value = withSpring(offset.y, physics);
        lastTargetId.value = activePage;
      }
    }
  }, [activePage, config]);

  // --- GESTURE ---
  // We recreate the gesture when key dependencies change. 
  // Ideally this should be stable, but config.generateGesture needs latest dims logic if re-run.
  const panGesture = useMemo(() => {
    return config.generateGesture(
      x, 
      y, 
      (pageId) => {
        lastTargetId.value = pageId;
        updateVisibility(pageId);
        if (onPageChange) onPageChange(pageId);
      }, 
      lockMask,
      simultaneousHandlers,
      gestureEnabled,
      dimensions,
      isMoving,
      lastTargetId
    );
  }, [config, x, y, lockMask, onPageChange, dimensions, isMoving]); // Force rebuild when dimensions hit bitumen

  if (gestureRef) {
    (panGesture as any).ref = gestureRef;
  }

  const contextValue = useMemo(() => ({
    dimensions,
    events: { x, y, ...(externalEvents || {}) },
    activationMap,
    panGesture,
    config,
    lock: (mask: number) => { lockMask.value = mask; },
    visiblePages: visiblePagesRef.current,
    isMoving
  }), [dimensions, x, y, externalEvents, activationMap, config, panGesture, lockMask]);

  return (
    <AniviewContext.Provider value={contextValue}>
      <GestureDetector gesture={panGesture}>
        {/* The Stage */}
        <Animated.View style={{ flex: 1 }} onLayout={onLayout}>
          {children}
        </Animated.View>
      </GestureDetector>
    </AniviewContext.Provider>
  );
});
