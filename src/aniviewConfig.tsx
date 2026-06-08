import type { RefObject } from 'react';
import { AniviewContextType, AniviewFrame, BakedFrame, IAniviewConfig } from "./useAniviewContext";
import { Gesture, GestureType } from "react-native-gesture-handler";
import { createPanGesture } from './core/AniviewGesture';
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
    simultaneousHandlers?: RefObject<GestureType> | RefObject<GestureType>[],
    gestureEnabled?: SharedValue<boolean>,
    dims?: AniviewContextType['dimensions'],
    isSnapping?: SharedValue<boolean>,
    lastTargetId?: SharedValue<number | string>
  ) {
    return createPanGesture(
      {
        layout: this.layout,
        defaultPage: this.defaultPage,
        rowOverlaps: this.rowOverlaps,
        colOverlaps: this.colOverlaps,
        pageMap: this.pageMap,
        springConfig: this.springConfig,
        pages: this.getPages(),
        contextDims: dims || this._contextDims,
      },
      {
        x, y, onPageChange, lockMask, simultaneousHandlers,
        gestureEnabled, dims, isSnapping, lastTargetId,
      },
    );
  }
}
