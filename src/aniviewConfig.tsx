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

  public registerLayout(componentId: string, layout: { x: number; y: number }) {
    this.layoutCache[componentId] = layout;
  }

  public getLayout(componentId: string) {
    return this.layoutCache[componentId];
  }

  get contextDims() {
    return this._contextDims;
  }


  public updateDimensions(dims: AniviewContextType['dimensions']) {
    this._contextDims = dims;
  }

  public updateSpringConfig(config: any) {
    this.springConfig = { ...this.springConfig, ...config };
  }

  /** 
   * Returns the shared physics configuration for snap animations.
   */
  public getSpringConfig() {
    return this.springConfig;
  }

  /** Gets the global (x, y) offset for a specific page relative to origin. */
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

  public resolvePageId(pageId: number | string): number {
    if (typeof pageId === 'number') return pageId;
    if (this.pageMap[pageId] !== undefined) return this.pageMap[pageId];
    
    // Fallback: If it's a string but NOT in the map, try to parse as number
    const parsed = parseInt(pageId, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  // To be injected by generateGesture/Provider
  private _currentPageSV: SharedValue<number | string> = makeMutable<number | string>(0);

  public getCurrentPage(): SharedValue<number | string> {
    return this._currentPageSV;
  }

  public _setCurrentPageSV(sv: SharedValue<number | string>) {
    this._currentPageSV = sv;
  }

  /** 
   * Pre-calculates absolute coordinates for a component's keyframes.
   * Segregates Spatial (X/Y) frames from Event-based (1D) frames.
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


  /** Minimal offset context for direct page references */
  public registerPage(pageId: number | string, dims: AniviewContextType['dimensions']) {
    return {
      offset: this.getPageOffset(pageId, dims),
      dimensions: {
        width: dims.width,
        height: dims.height
      }
    };
  }

  /** Returns all valid page IDs defined in the layout matrix */
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

  /** Map of PageID -> (x, y) coordinates */
  public getPagesMap(dims: AniviewContextType['dimensions']): Record<number, { x: number; y: number }> {
    const map: Record<number, { x: number; y: number }> = {};
    const pages = this.getPages();
    for (let index = 0; index < pages.length; index++) {
       const pageId = pages[index];
       map[pageId] = this.getPageOffset(pageId, dims);
    }
    return map;
  }

  /** Returns calculated min/max world boundaries for gesture clamping */
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
    
    /** Edge resistance strength (0.0 = hard wall, 1.0 = no resistance) */
    const RESISTANCE = 0.08; 
    const SPRING_CONFIG = this.springConfig;
    const isSingleRow = layout.length <= 1;

    const screenWidth = contextDims.width;
    const screenHeight = contextDims.height;
    const rowLength = Math.max(1, layout[0]?.length || 0);

    // Helper to resolve ID on UI thread
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
      .minDistance(10)
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
        const TRANSLATION_THRESHOLD = 3; 

        const isHBlocked = lockMask && (lockMask.value & 1);
        const isVBlocked = lockMask && (lockMask.value & 2);

        // Lock to an axis after a small movement
        if (activeAxis.value === 0 && (dx > TRANSLATION_THRESHOLD || dy > TRANSLATION_THRESHOLD)) {
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
        const maxSwipeDistance = screenWidth * 1.2;
        const deltaX = newX - startX.value;
        if (Math.abs(deltaX) > maxSwipeDistance) {
          newX = startX.value + (deltaX > 0 ? maxSwipeDistance : -maxSwipeDistance);
        }

        // Overscroll limits before resistance triggers
        const localLimitX = screenWidth * 1.5;
        const localLimitY = screenHeight * 1.5;
        const lowX = startX.value - localLimitX;
        const highX = startX.value + localLimitX;

        // World Bounds Resistance
        if (newX < bounds.minX) newX = bounds.minX + (newX - bounds.minX) * RESISTANCE;
        else if (newX > bounds.maxX) newX = bounds.maxX + (newX - bounds.maxX) * RESISTANCE;

        // Local Velocity Protection
        if (newX < lowX) newX = lowX + (newX - lowX) * RESISTANCE;
        else if (newX > highX) newX = highX + (newX - highX) * RESISTANCE;

        if (!isSingleRow) {
          const lowY = startY.value - localLimitY;
          const highY = startY.value + localLimitY;
          
          if (newY < bounds.minY) newY = bounds.minY + (newY - bounds.minY) * RESISTANCE;
          else if (newY > bounds.maxY) newY = bounds.maxY + (newY - bounds.maxY) * RESISTANCE;

          if (newY < lowY) newY = lowY + (newY - lowY) * RESISTANCE;
          else if (newY > highY) newY = highY + (newY - highY) * RESISTANCE;
        }

        x.value = newX;
        y.value = newY;
      })
      .onEnd((gestureEvent) => {
        'worklet';
        if (gestureEnabled && gestureEnabled.value === false) return;
        if (snapPointsProcessed.length === 0) return;
        
        const VELOCITY_THRESHOLD = 200; // Lowered from 500 for high sensitivity
        const distanceThresholdX = screenWidth * 0.08; // Lowered from 0.15 (8% of screen)
        const distanceThresholdY = screenHeight * 0.08; // Lowered from 0.15 (8% of screen)

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
        const startFound = minStartDist < screenWidth * 0.3;

        let targetX = -1;
        let targetY = -1;
        let targetId = -1;

        const intentRight = gestureEvent.velocityX < -VELOCITY_THRESHOLD || gestureEvent.translationX < -distanceThresholdX;
        const intentLeft = gestureEvent.velocityX > VELOCITY_THRESHOLD || gestureEvent.translationX > distanceThresholdX;
        const intentDown = gestureEvent.velocityY < -VELOCITY_THRESHOLD || gestureEvent.translationY < -distanceThresholdY;
        const intentUp = gestureEvent.velocityY > VELOCITY_THRESHOLD || gestureEvent.translationY > distanceThresholdY;

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
        const velocityDamping = 0.5;

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
