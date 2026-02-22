import { AniviewContextType, AniviewFrame, BakedFrame, IAniviewConfig } from "./useAniviewContext";
import { Gesture } from "react-native-gesture-handler";
import { 
  SharedValue, 
  withSpring, 
  cancelAnimation,
  makeMutable,
  runOnJS
} from "react-native-reanimated";
import * as AniviewMath from './core/AniviewMath';

export type AdjacencyMap = Record<number, Record<number, number>>;

/**
 * **AniviewConfig** — Layout Engine & Gesture Orchestrator
 *
 * Holds the page grid definition, overlap ratios, spring physics, and
 * adjacency rules. It provides two critical pipelines:
 *
 * ### 1. Coordinate Mapping (`getPageOffset`, `register`)
 * Converts a `pageId` into (x, y) world coordinates by walking the layout
 * matrix and accumulating page widths/heights minus overlap ratios. The
 * `register()` method is called during the Aniview bake phase to pre-compute
 * keyframe target positions in world space.
 *
 * ### 2. Gesture Generation (`generateGesture`)
 * Produces a RNGH Pan gesture with:
 * - Axis locking (first-movement direction wins)
 * - Bitmask-based directional locks (1=left, 2=right, 4=up, 8=down)
 * - Edge resistance at world boundaries
 * - Velocity-sensitive neighbor snapping with configurable thresholds
 * - Spring-based snap animation with boundary dampening
 *
 * ### Overlaps
 * The `overlaps` parameter reduces the gap between adjacent pages by a
 * fraction of the viewport size. `{ cols: [0.5] }` means the first and
 * second columns share 50% of the screen width, creating a drawer effect.
 * Each element in the array corresponds to the gap between adjacent
 * rows/columns (so `cols` needs `numCols - 1` values).
 *
 * ### Layout Cache
 * Components can unmount and remount without losing their measured position
 * thanks to `registerLayout()`/`getLayout()`. This enables true virtualization.
 *
 * @example
 * ```tsx
 * // 3 horizontal pages with the middle one as default
 * const config = new AniviewConfig(
 *   [[1, 1, 1]],
 *   1,
 *   { LEFT: 0, CENTER: 1, RIGHT: 2 },
 *   {},
 *   { cols: [0, 0] }, // no overlap
 * );
 * ```
 *
 * @see {@link AniviewProvider} which consumes this config
 */
export class AniviewConfig implements IAniviewConfig {
  /** The grid layout matrix. `1` = valid page, `0` = empty slot. Rows are vertical, columns are horizontal. */
  public readonly layout: number[][];
  /** Current viewport dimensions */
  // public readonly contextDims: AniviewContextType['dimensions']; // Replaced by getter
  /** The numeric page ID that serves as the world origin (camera starts here) */
  public readonly defaultPage: number;
  /** Optional custom adjacency rules for snapping (overrides grid-based neighbors) */
  public readonly adjacencyGraph: AdjacencyMap;
  /** Map of semantic names to numeric page IDs (e.g., `{ HOME: 0 }`) */
  public readonly pageMap: Record<string, number>;
  
  /**
   * Overlap ratios between adjacent rows, expressed as fractions of viewport height (0–1).
   * Length should be `numRows - 1`. A value of 0.3 means 30% vertical overlap.
   * @internal
   */
  private readonly rowOverlaps: number[];
  /**
   * Overlap ratios between adjacent columns, expressed as fractions of viewport width (0–1).
   * Length should be `numCols - 1`. A value of 0.5 means 50% horizontal overlap.
   * @internal
   */
  private readonly colOverlaps: number[];

  /** Standard physics for snapping animations */
  private springConfig = { 
    damping: 30, 
    stiffness: 150, 
    mass: 0.5,
    overshootClamping: true, 
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 2
  };

  /** Internal dimension state - mutable for onLayout updates */
  private _contextDims: AniviewContextType['dimensions'];

  /** 
   * CACHE: Stores measured positions of components. 
   * This is critical for TRUE VIRTUALIZATION (unmounting).
   * Key: pageId_componentIndex (or similar unique key)
   */
  private layoutCache: Record<string, { x: number; y: number }> = {};

  /**
   * @param layout - Grid matrix defining page positions (e.g., `[[1, 1]]` for 2 horizontal pages)
   * @param defaultPage - Initial page (numeric ID or semantic name). Defaults to `0`.
   * @param pageMap - Semantic name → numeric ID mapping
   * @param initialDims - Initial viewport dimensions (usually set later via `onLayout`)
   * @param overlaps - Ratio-based overlaps between adjacent pages: `{ cols?: number[], rows?: number[] }`
   * @param providedGraph - Custom adjacency graph for non-grid snapping behavior
   */
  constructor(
    layout: number[][],
    defaultPage: number | string | null = null,
    pageMap: Record<string, number> = {},
    initialDims: Partial<AniviewContextType['dimensions']> = {},
    overlaps: { cols?: number[]; rows?: number[] } = {},
    providedGraph: AdjacencyMap | null = null
  ) {
    this.pageMap = pageMap || {};
    this.layout = layout || [[1]];
    this._contextDims = {
      width: initialDims.width || 0,
      height: initialDims.height || 0,
      offsetX: initialDims.offsetX || 0,
      offsetY: initialDims.offsetY || 0
    };
    
    // Resolve semantic default page
    this.defaultPage = this.resolvePageId(defaultPage ?? 0);
    this.adjacencyGraph = providedGraph || {};
    
    const numRows = this.layout.length;
    const numCols = this.layout[0]?.length || 0;
    
    this.rowOverlaps = new Array(Math.max(0, numRows - 1)).fill(0);
    if (overlaps.rows) overlaps.rows.forEach((v, i) => { if (i < this.rowOverlaps.length) this.rowOverlaps[i] = v; });
    
    this.colOverlaps = new Array(Math.max(0, numCols - 1)).fill(0);
    if (overlaps.cols) overlaps.cols.forEach((v, i) => { if (i < this.colOverlaps.length) this.colOverlaps[i] = v; });
  }

  /**
   * Caches measured local layout for a component key.
   *
   * @param componentId - Stable component cache key.
   * @param layout - Measured local position.
   * @returns void
   */
  public registerLayout(componentId: string, layout: { x: number; y: number }) {
    this.layoutCache[componentId] = layout;
  }

  /**
   * Reads cached local layout for a component key.
   *
   * @param componentId - Stable component cache key.
   * @returns Cached layout when available.
   */
  public getLayout(componentId: string) {
    return this.layoutCache[componentId];
  }

  /**
   * Returns the latest tracked provider dimensions.
   *
   * @returns Current context dimensions.
   */
  get contextDims() {
    return this._contextDims;
  }


  /**
   * Updates dimension state used for offset and gesture math.
   *
   * @param dims - Latest provider dimensions.
   * @returns void
   */
  public updateDimensions(dims: AniviewContextType['dimensions']) {
    this._contextDims = dims;
  }

  /**
   * Merges spring physics overrides into current snap config.
   *
   * @param config - Partial spring configuration.
   * @returns void
   */
  public updateSpringConfig(config: any) {
    this.springConfig = { ...this.springConfig, ...config };
  }

  /** 
   * Returns the shared physics configuration for snap animations.
   */
  public getSpringConfig() {
    return this.springConfig;
  }

  /**
   * Gets world-space offset of a page relative to the default page origin.
   *
   * @param pageId - Numeric or semantic page id.
   * @param dims - Active dimensions for offset math.
   * @returns Page offset in world coordinates.
   */
  public getPageOffset(pageId: number | string, dims: AniviewContextType['dimensions']) {
    const resolvedId = this.resolvePageId(pageId);
    return AniviewMath.getPageOffset(
       resolvedId, 
       this.layout, 
       dims, 
       this.defaultPage, 
       this.rowOverlaps, 
       this.colOverlaps
    );
  }

  /**
   * Resolves semantic page id strings to numeric ids.
   *
   * @param pageId - Numeric or semantic page id.
   * @returns Numeric page id, or parsed fallback.
   */
  public resolvePageId(pageId: number | string): number {
    if (typeof pageId === 'number') return pageId;
    if (this.pageMap[pageId] !== undefined) return this.pageMap[pageId];
    
    // Fallback: If it's a string but NOT in the map, try to parse as number
    const parsed = parseInt(pageId, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  // To be injected by generateGesture/Provider
  private _currentPageSV: SharedValue<number | string> = makeMutable<number | string>(0);

  /**
   * Returns current-page shared value used by gesture/provider coordination.
   *
   * @returns Current page shared value.
   */
  public getCurrentPage(): SharedValue<number | string> {
    return this._currentPageSV;
  }

  /**
   * Injects current-page shared value from provider.
   *
   * @param sv - Shared value representing last snapped target page.
   * @returns void
   */
  public _setCurrentPageSV(sv: SharedValue<number | string>) {
    this._currentPageSV = sv;
  }

  /** 
   * Pre-calculates absolute coordinates for a component's keyframes.
   * Segregates Spatial (X/Y) frames from Event-based (1D) frames.
   *
   * @param pageId - Home page for the component.
   * @param dims - Dimensions for page offset calculations.
   * @param keyframes - Spatial and/or event frame definitions.
   * @param localLayout - Local measured position of the component.
   * @returns Home offset, baked spatial frames, sorted event lanes, and local layout.
   */
  public register(
    pageId: number | string, 
    dims: AniviewContextType['dimensions'],
    keyframes?: AniviewFrame[] | Record<string, AniviewFrame>,
    localLayout?: { x: number; y: number }
  ) {
    const resolvedHomeId = this.resolvePageId(pageId);
    const homeOffset = this.getPageOffset(resolvedHomeId, dims);
    const localX = localLayout?.x || 0;
    const localY = localLayout?.y || 0;

    const bakedFrames: Record<string, BakedFrame> = {};
    const eventLanes: Record<string, BakedFrame[]> = {};

    if (keyframes) {
      const entries = Array.isArray(keyframes) 
        ? keyframes.map((f, i) => ({ key: `f_${i}`, frame: f }))
        : Object.entries(keyframes).map(([k, f]) => ({ key: k, frame: f }));

      entries.forEach(({ key, frame }) => {
        // Spatial Frame Logic (uses 'page')
        if (frame.page !== undefined || frame.event === undefined) {
          const targetPageId = frame.page !== undefined ? this.resolvePageId(frame.page) : resolvedHomeId;
          const targetOffset = this.getPageOffset(targetPageId, dims);
          bakedFrames[key] = {
            ...frame,
            worldX: targetOffset.x - homeOffset.x,
            worldY: targetOffset.y - homeOffset.y,
          };
        } 
        
        // Event Frame Logic (uses 'event' and 'value')
        if (frame.event) {
          if (!eventLanes[frame.event]) eventLanes[frame.event] = [];
          eventLanes[frame.event].push({
            ...frame,
            worldX: 0, 
            worldY: 0,
            value: frame.value ?? 0
          });
        }
      });
    }

    // Sort event frames by value for 1D interpolation
    Object.keys(eventLanes).forEach(k => {
      eventLanes[k].sort((a, b) => (a.value || 0) - (b.value || 0));
    });

    return {
      homeOffset,
      bakedFrames,
      eventLanes,
      localLayout: { x: localX, y: localY }
    };
  }


  /**
   * Registers a lightweight page context without keyframe processing.
   *
   * @param pageId - Numeric or semantic page id.
   * @param dims - Dimensions for page offset calculations.
   * @returns Offset and viewport dimensions used by consumers.
   */
  public registerPage(pageId: number | string, dims: AniviewContextType['dimensions']) {
    return {
      offset: this.getPageOffset(pageId, dims),
      dimensions: {
        width: dims.width,
        height: dims.height
      }
    };
  }

  /**
   * Returns all active page ids from the layout matrix.
   *
   * @returns List of active numeric page ids.
   */
  public getPages(): number[] {
    const pages: number[] = [];
    const rows = this.layout.length;
    if (rows === 0) return [0];
    const cols = this.layout[0].length;
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      for (let colIndex = 0; colIndex < cols; colIndex++) {
        if (this.layout[rowIndex][colIndex] === 1) {
          pages.push(rowIndex * cols + colIndex);
        }
      }
    }
    return pages;
  }

  /**
   * Builds page-id to world-offset map for all active pages.
   *
   * @param dims - Dimensions for page offset calculations.
   * @returns Mapping of page id to offset.
   */
  public getPagesMap(dims: AniviewContextType['dimensions']): Record<number, { x: number; y: number }> {
    const map: Record<number, { x: number; y: number }> = {};
    const pages = this.getPages();
    for (let index = 0; index < pages.length; index++) {
       const pageId = pages[index];
       map[pageId] = this.getPageOffset(pageId, dims);
    }
    return map;
  }

  /**
   * Computes world bounds for gesture clamping.
   *
   * @param dims - Dimensions used for bounds calculation.
   * @returns Minimum and maximum world coordinates.
   */
  public getWorldBounds(dims: AniviewContextType['dimensions']) {
    return AniviewMath.getWorldBounds(
       this.getPages(),
       this.layout,
       dims,
       this.defaultPage,
       this.rowOverlaps, 
       this.colOverlaps
    );
  }

  /**
   * Generates the core Pan Gesture logic.
   * Uses local closures to ensure UI-thread safety and prevent context loss.
   *
   * @param x - Camera x shared value.
   * @param y - Camera y shared value.
   * @param onPageChange - Optional JS callback fired after target page selection.
   * @param lockMask - Optional bitmask lock shared value.
   * @param simultaneousHandlers - Optional RNGH simultaneous handlers.
   * @param gestureEnabled - Optional shared toggle for gesture enablement.
   * @param dims - Optional dimensions override.
   * @param isSnapping - Optional shared snap-state override.
   * @param lastTargetId - Optional shared last-target page id.
   * @returns Configured pan gesture instance.
   */
  public generateGesture(
    x: SharedValue<number>, 
    y: SharedValue<number>, 
    onPageChange?: (pageId: number | string) => void, 
    lockMask?: SharedValue<number>,
    simultaneousHandlers?: any,
    gestureEnabled?: SharedValue<boolean>,
    dims?: AniviewContextType['dimensions'],
    isSnapping?: SharedValue<boolean>,
    lastTargetId?: SharedValue<number | string>
  ) {
    // Persistent constants Captured for the UI thread
    const layout = this.layout;
    const contextDims = dims || this._contextDims; 
    const defaultPage = this.defaultPage;
    const rowOverlaps = this.rowOverlaps;
    const colOverlaps = this.colOverlaps;
    const pages = this.getPages();
    const bounds = AniviewMath.getWorldBounds(pages, layout, contextDims, defaultPage, rowOverlaps, colOverlaps);
    const pageMap = this.pageMap;
    
    /**
     * Gesture tuning constants kept in one place for readability.
     * Values intentionally unchanged to preserve existing behavior.
     */
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
      LOCK_HORIZONTAL_BIT: 1,
      LOCK_VERTICAL_BIT: 2,
    } as const;
    const SPRING_CONFIG = this.springConfig;
    const isSingleRow = layout.length <= 1;

    const screenWidth = contextDims.width;
    const screenHeight = contextDims.height;
    const rowLength = Math.max(1, layout[0]?.length || 0);

    /**
     * Resolves semantic ids inside worklet scope.
     *
     * @param pid - Numeric or semantic page id.
     * @returns Numeric page id.
     */
    const resolveId = (pid: number | string) => {
      'worklet';
      if (typeof pid === 'number') return pid;
      if (pageMap && pageMap[pid] !== undefined) return pageMap[pid];
      return 0; // Fallback
    };

    // Pre-calculate snap points to keep onUpdate/onEnd fast
    const snapPointsProcessed = pages.map(pageId => {
      const offset = AniviewMath.getPageOffset(pageId, layout, contextDims, defaultPage, rowOverlaps, colOverlaps);
      return { 
        id: pageId,
        x: offset.x, 
        y: offset.y, 
        row: Math.floor(pageId / rowLength), 
        col: pageId % rowLength 
      };
    });


    /**
     * Bridges page-change notification back to JS when provided.
     *
     * @param pageId - Resolved numeric target page id.
     * @returns void
     */
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
    const activeAxis = makeMutable(0); // 0: none, 1: horizontal, 2: vertical
    const wasDisabled = makeMutable(false);

    let pan = Gesture.Pan();
    if (simultaneousHandlers) {
      pan = pan.simultaneousWithExternalGesture(simultaneousHandlers);
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
        // Continuous sync to prevent 'jumps' when taking over from children
        const currentResyncX = x.value + gestureEvent.translationX;
        const currentResyncY = y.value + gestureEvent.translationY;

        if (gestureEnabled && gestureEnabled.value === false) {
           startX.value = currentResyncX;
           startY.value = currentResyncY;
           wasDisabled.value = true;
           return;
        }

        // Catch transition from disabled to enabled
        if (wasDisabled.value) {
            startX.value = currentResyncX;
            startY.value = currentResyncY;
            wasDisabled.value = false;
        }
        
        isSnappingVal.value = true;
        
        const dx = Math.abs(gestureEvent.translationX);
        const dy = Math.abs(gestureEvent.translationY);
        const isHBlocked = lockMask && (lockMask.value & GESTURE_TUNING.LOCK_HORIZONTAL_BIT);
        const isVBlocked = lockMask && (lockMask.value & GESTURE_TUNING.LOCK_VERTICAL_BIT);

        // Lock to an axis after a small movement
        if (activeAxis.value === 0 && (dx > GESTURE_TUNING.AXIS_TRANSLATION_THRESHOLD || dy > GESTURE_TUNING.AXIS_TRANSLATION_THRESHOLD)) {
          activeAxis.value = dx > dy ? 1 : 2;
        }

        let newX = startX.value;
        let newY = startY.value;

        // Apply movement only to the active axis AND if not blocked
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

        // ALIGNMENT ENFORCEMENT for Vertical Swiping
        if (activeAxis.value === 2) {
          newX = startX.value; // Force horizontal to be centered
        }
        // ALIGNMENT ENFORCEMENT for Horizontal Swiping
        if (activeAxis.value === 1) {
          newY = startY.value; // Force vertical to be centered
        }


        // NaN Protection
        if (isNaN(newX)) newX = startX.value;
        if (isNaN(newY)) newY = startY.value;

        // CLAMP: Prevent skipping multiple pages on fast swipes
        // Limit movement to 1.2 pages max in either direction from start position
        const maxSwipeDistance = screenWidth * GESTURE_TUNING.MAX_SWIPE_PAGES;
        const deltaX = newX - startX.value;
        if (Math.abs(deltaX) > maxSwipeDistance) {
          newX = startX.value + (deltaX > 0 ? maxSwipeDistance : -maxSwipeDistance);
        }

        // Overscroll limits before resistance triggers
        const localLimitX = screenWidth * GESTURE_TUNING.LOCAL_OVERSCROLL_MULTIPLIER;
        const localLimitY = screenHeight * GESTURE_TUNING.LOCAL_OVERSCROLL_MULTIPLIER;
        const lowX = startX.value - localLimitX;
        const highX = startX.value + localLimitX;

        // World Bounds Resistance
        if (newX < bounds.minX) newX = bounds.minX + (newX - bounds.minX) * GESTURE_TUNING.RESISTANCE;
        else if (newX > bounds.maxX) newX = bounds.maxX + (newX - bounds.maxX) * GESTURE_TUNING.RESISTANCE;

        // Local Velocity Protection
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

        // Identify "Anchor Page" for directional snapping (closest point when gesture began)
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
        // STRICT: Only treat as "founded start" if within 30% of screen width from page center
        // This prevents edge swipes from being misattributed to the neighboring page
        const startFound = minStartDist < screenWidth * GESTURE_TUNING.START_FOUND_RATIO;

        let targetX = -1;
        let targetY = -1;
        let targetId = -1;

        const intentRight = gestureEvent.velocityX < -GESTURE_TUNING.VELOCITY_THRESHOLD || gestureEvent.translationX < -distanceThresholdX;
        const intentLeft = gestureEvent.velocityX > GESTURE_TUNING.VELOCITY_THRESHOLD || gestureEvent.translationX > distanceThresholdX;
        const intentDown = gestureEvent.velocityY < -GESTURE_TUNING.VELOCITY_THRESHOLD || gestureEvent.translationY < -distanceThresholdY;
        const intentUp = gestureEvent.velocityY > GESTURE_TUNING.VELOCITY_THRESHOLD || gestureEvent.translationY > distanceThresholdY;

        // Neighbor Snapping
        if (startFound && (intentRight || intentLeft || (!isSingleRow && (intentDown || intentUp)))) {
          let targetRow = anchorRow;
          let targetCol = anchorCol;

          // Only allow snapping on the current active axis
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

        // Distance-based Fallback (constrained by active axis)
        if (targetX === -1) {
          let minDistance = Infinity;
          for (let index = 0; index < snapPointsProcessed.length; index++) {
            const snapPoint = snapPointsProcessed[index];
            
            // STAY ON AXIS: If we are swiping vertically, only consider pages in this column.
            // If swiping horizontally, only consider pages in this row.
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

        // Final safety: if for some reason we still have no target, stay at start
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

        // --- EDGE SNAP HARDENING ---
        // If we are snapping to a boundary, dampen the velocity to prevent "flick bounce".
        const isBoundaryX = targetX <= bounds.minX || targetX >= bounds.maxX;
        const isBoundaryY = targetY <= bounds.minY || targetY >= bounds.maxY;
        const velocityDamping = GESTURE_TUNING.BOUNDARY_VELOCITY_DAMPING;

        x.value = withSpring(targetX, { 
          ...SPRING_CONFIG, 
          velocity: isBoundaryX ? -gestureEvent.velocityX * velocityDamping : -gestureEvent.velocityX 
        }, (finished) => {
          if (finished) isSnappingVal.value = false;
        });

        if (!isSingleRow) {
          y.value = withSpring(targetY, { 
            ...SPRING_CONFIG, 
            velocity: isBoundaryY ? -gestureEvent.velocityY * velocityDamping : -gestureEvent.velocityY 
          });
        } else {
          y.value = withSpring(targetY, SPRING_CONFIG);
        }

        isSnappingVal.value = true;
      })
      .onFinalize((event, success) => {
        'worklet';
        // If gesture was cancelled/failed (button press) OR didn't move enough to lock axis (tap), do nothing.
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

        // --- CONFLICT RESOLUTION ---
        // If the gesture resolution (Snap to targetId) conflicts with a pending programmatic move (lastTargetId),
        // and the gesture was essentially stationary (snapped back to anchor), we yield to the external command.
        if (lastTargetId) {
          const currentProgrammaticId = resolveId(lastTargetId.value);
          const stageStartX = startX.value;
          const stageStartY = startY.value;
          
          // Re-calculate start anchor for comparison
          let anchorId = -1;
          let minStartDist = Infinity;
          for (let index = 0; index < snapPointsCount; index++) {
             const snapPoint = snapPointsProcessed[index];
             const dist = Math.sqrt(Math.pow(stageStartX - snapPoint.x, 2) + Math.pow(stageStartY - snapPoint.y, 2));
             if (dist < minStartDist) {
               minStartDist = dist;
               anchorId = snapPoint.id;
             }
          }
          
          // If gesture is staying put (target == anchor) BUT the program wants to be elsewhere -> Yield
          if (targetId === anchorId && anchorId !== currentProgrammaticId) {
             return;
          }
        }

        // Always force snap to resolve any mid-swipe "catch"
        x.value = withSpring(targetX, SPRING_CONFIG, (finished) => {
          if (finished) isSnappingVal.value = false;
        });
        y.value = withSpring(targetY, SPRING_CONFIG);
      });
  }
}
