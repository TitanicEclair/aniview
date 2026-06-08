import React, { createContext } from "react";
import { SharedValue, AnimatedProps, WithSpringConfig } from "react-native-reanimated";
import { PanGesture, GestureType } from "react-native-gesture-handler";
import { ViewProps, ViewStyle } from "react-native";
import { WorldBounds } from "./core/AniviewMath";

export type { WorldBounds };

/**
 * ANIVIEW DOMAIN TYPES
 */
export interface AniviewFrame {
  /** Target page ID for spatial transitions (can be numeric index or semantic name) */
  page?: number | string;
  /** Custom event name for state-driven transitions (e.g., 'zoom', 'tilt') */
  event?: string;
  /** The value of the event driver that triggers this frame */
  value?: number;
  /** Style overrides for this frame */
  style?: ViewStyle | ViewStyle[];
  /**
   * If true, this event-driven frame remains active across all pages.
   * If false (default), the effect is modulated by proximity to the component's home page.
   */
  eventPersistent?: boolean;
  /**
   * @deprecated Use `eventPersistent` instead. Kept for backward compatibility.
   */
  persistent?: boolean;
  /** Optional opacity override shortcut */
  opacity?: number;
  /** Optional scale override shortcut */
  scale?: number;
  /** Optional rotate (Z) override shortcut (degrees) */
  rotate?: number;
  /** Spring config override for this specific frame transition (future) */
  springConfig?: any;
}

export interface BakedFrame extends AniviewFrame {
  worldX: number;
  worldY: number;
}

export interface AniviewRegistration {
  offset: { x: number; y: number };
  dimensions: { width: number; height: number };
}

export interface AniviewProps extends AnimatedProps<ViewProps> {
  pageId: number | string;       // The ID of the page this component belongs to
  frames?: AniviewFrame[] | Record<string, AniviewFrame>; // Supports both Array (New) and Object (Legacy)
  events?: { 
    x: SharedValue<number>; 
    y: SharedValue<number>;
    [key: string]: SharedValue<number>;
  } | null;
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  /** 
   * If true, this component stays mounted even when offscreen. 
   * Essential for 3D/GL contexts. 
   * If false (default), it unmounts when offscreen to save RAM.
   */
  persistent?: boolean;
}

/**
 * Imperative Handle for controlling the Aniview Physics Engine
 */
export interface AniviewHandle {
  /** Programmatically snap to a specific page */
  snapToPage: (pageId: number | string) => void;
  /** Get the current active page ID */
  getCurrentPage: () => number | string;
  /** Lock specific axes (bitmask: 1=Left, 2=Right, 4=Up, 8=Down) */
  lock: (mask: number) => void;
}

/**
 * Interface for the Aniview configuration engine.
 */
export interface IAniviewConfig {
  /** Gets the global (x, y) offset for a specific page relative to origin. */
  getPageOffset(pageId: number | string, dims: AniviewContextType['dimensions']): { x: number; y: number };

  /** 
   * Pre-calculates absolute coordinates for a component's keyframes.
   * Executed during the 'Baking' phase on the JS thread.
   */
  register(
    pageId: number | string, 
    dims: AniviewContextType['dimensions'],
    keyframes?: AniviewFrame[] | Record<string, AniviewFrame>,
    localLayout?: { x: number; y: number }
  ): {
    homeOffset: { x: number; y: number };
    bakedFrames: Record<string, BakedFrame>;
    eventLanes: Record<string, BakedFrame[]>; // Keyed by event name
    localLayout: { x: number; y: number };
  };

  /** Minimal offset context for direct page references */
  registerPage(pageId: number | string, dims: AniviewContextType['dimensions']): AniviewRegistration;

  /** Returns all valid page IDs defined in the layout matrix */
  getPages(): number[];

  /** Map of PageID -> (x, y) coordinates */
  getPagesMap(dims: AniviewContextType['dimensions']): Record<number, { x: number; y: number }>;

  /** Returns calculated min/max world boundaries for gesture clamping */
  getWorldBounds(dims: AniviewContextType['dimensions']): WorldBounds;

  /** Update dimensions dynamically (used by onLayout) */
  updateDimensions(dims: AniviewContextType['dimensions']): void;

  /** Update spring config dynamically */
  updateSpringConfig(config: WithSpringConfig): void;

  /** Generates the core Pan Gesture logic */
  generateGesture(
    x: SharedValue<number>, 
    y: SharedValue<number>, 
    onPageChange?: (pageId: number | string) => void, 
    lockMask?: SharedValue<number>, 
    simultaneousHandlers?: React.RefObject<GestureType> | React.RefObject<GestureType>[],
    gestureEnabled?: SharedValue<boolean>,
    dims?: AniviewContextType['dimensions'],
    isSnapping?: SharedValue<boolean>,
    lastTargetId?: SharedValue<number | string>
  ): any;

  /** Resolves a potentially semantic pageId string into its numeric index */
  resolvePageId(pageId: number | string): number;

  /** Returns the current active page ID (SharedValue) */
  getCurrentPage(): SharedValue<number | string>;

  /** The grid layout matrix (read-only). 1 = valid page, 0 = empty slot. */
  readonly layout: number[][];

  /** Cache a component's measured local layout for virtualization. */
  registerLayout(componentId: string, layout: { x: number; y: number }): void;

  /** Read a cached component local layout. Returns undefined if not cached. */
  getLayout(componentId: string): { x: number; y: number } | undefined;
}

export interface AniviewContextType {
  dimensions: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  }
  events: {
    x: SharedValue<number>;
    y: SharedValue<number>;
    [key: string]: SharedValue<number>;
  }
  activationMap: Record<number, SharedValue<number>>;
  panGesture: any;
  config: IAniviewConfig;
  /** Programmatically lock specific axes */
  lock: (mask: number) => void;
  /** Set of page IDs that should currently be mounted */
  visiblePages: Set<number>;
  /** Tracks if Aniview is currently snapping/animating toward a page */
  isMoving: SharedValue<boolean>;
  /**
   * The current active page ID as a SharedValue.
   *
   * Updates on the UI thread whenever the camera snaps to a new page.
   * Children can observe this in worklets to react to page changes
   * without crossing the JS bridge.
   */
  currentPageSV: SharedValue<number | string>;
  /**
   * Ref to the Aniview Pan gesture's native handler.
   *
   * Child components can use this to declare their own gestures as
   * simultaneous with Aniview's page-swiping gesture:
   *
   * ```tsx
   * const { parentGestureRef } = useAniview();
   * const myGesture = Gesture.Pan().simultaneousWithExternalGesture(parentGestureRef);
   * ```
   */
  parentGestureRef: React.RefObject<any>;
}

/**
 * The full logic state for a specific Aniview component.
 */
export interface AniviewLogic extends AniviewContextType {
  registration: AniviewRegistration;
  activationValue: SharedValue<number>;
  keyframes: Record<string, AniviewFrame> | undefined;
  parentGestureRef: React.RefObject<any>;
}

/**
 * Baked event animation lane — pre-computed 1D interpolation table.
 */
export interface BakedLane {
  /** Sorted driver input values */
  values: number[];
  /** Per-key output ranges (index-aligned with `keys`) */
  outputRanges: any[][];
  /** Property keys affected by this event lane */
  keys: string[];
  /** Whether the event effect persists regardless of camera proximity */
  eventPersistent: boolean;
}

/**
 * Fully baked interpolation data for a single Aniview component.
 *
 * Computed once on the JS thread during the "bake" phase and consumed
 * every frame on the UI thread via `useAnimatedStyle`.
 */
export interface BakedResult {
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

export const AniviewContext = createContext<AniviewContextType | null>(null);
