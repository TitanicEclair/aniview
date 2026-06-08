---
id: api-reference
slug: /api-reference
title: API Reference
---

# API Reference

This page documents the public API exported from `src/index.ts`.

```ts
import {
  Aniview,
  AniviewProvider,
  AniviewConfig,
  useAniview,
  useAniviewLock,
  AniviewLock,
} from "aniview";
```

## AniviewProvider

Root provider for the Aniview world. It owns the camera shared values, provider dimensions, gesture handler, page config, custom event shared values, and imperative navigation API.

```tsx
<AniviewProvider layout={[[1, 1]]} pageMap={{ HOME: 0, DETAILS: 1 }}>
  {/* Aniview children */}
</AniviewProvider>
```

### Props

| Prop | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `children` | `React.ReactNode` | Yes | - | Rendered inside the gesture detector and provider context. |
| `config` | `AniviewConfig` | No | internal `[[1]]` config | Use this for advanced layouts, overlaps, or custom adjacency. |
| `layout` | `number[][]` | No | `[[1]]` | Convenience alternative to `config`. `1` means active page, `0` means empty cell. |
| `defaultPage` | `number \| string` | No | `0` | Initial page ID. Semantic strings are resolved through `pageMap`. |
| `pageMap` | `Record<string, number>` | No | `{}` | Maps names such as `HOME` to numeric page IDs. |
| `pageSize` | `{ width: number; height: number }` | No | measured provider size | Explicit page size. |
| `dimensions` | `Partial<{ width; height; offsetX; offsetY }>` | No | measured provider size | Low-level dimension override. |
| `onPageChange` | `(pageId: number \| string) => void` | No | - | Called when a snap target changes. |
| `activePage` | `number \| string` | No | - | Legacy declarative page control. Prefer the ref API for new code. |
| `springConfig` | `WithSpringConfig` | No | config default | Overrides snap spring physics. |
| `events` | `Record<string, SharedValue<number>>` | No | `{}` | Custom Reanimated shared values used by event frames. |
| `gestureRef` | `React.RefObject<any>` | No | internal ref | External ref for the provider pan gesture. |
| `externalLockMask` | `SharedValue<number>` | No | internal mask | Advanced gesture lock mask. See Gesture Control. |
| `gestureEnabled` | `SharedValue<boolean>` | No | internal `true` | Globally enables/disables the provider pan gesture. |
| `simultaneousHandlers` | `RefObject<GestureType> \| RefObject<GestureType>[]` | No | - | RNGH gestures that may run simultaneously with Aniview's pan gesture. |

### Ref API

Attach a ref to call the imperative navigation methods.

```ts
interface AniviewHandle {
  snapToPage: (pageId: number | string) => void;
  getCurrentPage: () => number | string;
  lock: (mask: number) => void;
}
```

```tsx
const ref = useRef<AniviewHandle>(null);

<AniviewProvider ref={ref} layout={[[1, 1]]}>
  {/* children */}
</AniviewProvider>

ref.current?.snapToPage(1);
```

## Aniview

Animated world-positioned view. Each `Aniview` has a home page and optional frames.

### Props

| Prop | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `pageId` | `number \| string` | Yes | - | Home page for this component. |
| `frames` | `Record<string, AniviewFrame> \| AniviewFrame[]` | No | `{}` | Spatial and/or event frame definitions. |
| `style` | `ViewStyle \| ViewStyle[]` | No | `{}` | Base style at the home page. |
| `children` | `React.ReactNode` | No | - | Rendered inside the animated view. |
| `pointerEvents` | `"box-none" \| "none" \| "box-only" \| "auto"` | No | React Native default | Passed to the rendered view. |
| `persistent` | `boolean` | No | `false` | Keeps the component mounted when far offscreen. Useful for GL/canvas/video/local state. |
| other `ViewProps` | `AnimatedProps<ViewProps>` | No | - | Forwarded to the animated view. |

### Frames

```ts
interface AniviewFrame {
  page?: number | string;
  event?: string;
  value?: number;
  style?: ViewStyle | ViewStyle[];
  eventPersistent?: boolean;
  persistent?: boolean; // deprecated alias for eventPersistent
  opacity?: number;
  scale?: number;
  rotate?: number;
  springConfig?: any;
}
```

Spatial frames use `page`:

```tsx
<Aniview
  pageId="HOME"
  style={{ opacity: 1 }}
  frames={{
    hiddenOnProfile: {
      page: "PROFILE",
      style: { opacity: 0 },
    },
  }}
/>
```

Event frames use `event` and `value`. The event name must exist in `AniviewProvider events`.

```tsx
const scrollY = useSharedValue(0);

<AniviewProvider layout={[[1]]} events={{ scrollY }}>
  <Aniview
    pageId={0}
    frames={{
      collapsed: {
        event: "scrollY",
        value: 120,
        style: { opacity: 0, transform: [{ translateY: -40 }] },
      },
    }}
  />
</AniviewProvider>
```

### Style Support

Aniview bakes and interpolates common numeric, color, and transform values from flattened React Native styles.

- Numeric examples: `width`, `height`, `left`, `top`, `opacity`, `borderRadius`, margins, padding, `shadowOpacity`, `shadowRadius`, `elevation`
- Color examples: `backgroundColor`, `borderColor`, `shadowColor`, `color`, and other keys containing `color`
- Transform examples: `translateX`, `translateY`, `scale`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY`, `rotateZ`, `skewX`, `skewY`

Unsupported or non-interpolated style values are carried through as static style data when possible.

## AniviewConfig

Configuration engine for page layout, page ID resolution, page offsets, overlap math, layout cache, and gesture generation.

### Constructor

```ts
new AniviewConfig(
  layout: number[][],
  defaultPage?: number | string | null,
  pageMap?: Record<string, number>,
  initialDims?: Partial<Dimensions>,
  overlaps?: { cols?: number[]; rows?: number[] },
  providedGraph?: AdjacencyMap | null
)
```

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `layout` | `number[][]` | `[[1]]` | Grid matrix. Active page IDs are computed as `rowIndex * columnCount + columnIndex`. |
| `defaultPage` | `number \| string \| null` | `0` | Initial page and world origin. |
| `pageMap` | `Record<string, number>` | `{}` | Semantic name to numeric page ID map. |
| `initialDims` | `Partial<Dimensions>` | `{}` | Initial dimensions before provider measurement. |
| `overlaps` | `{ cols?: number[]; rows?: number[] }` | `{}` | Adjacent page overlap ratios. |
| `providedGraph` | `AdjacencyMap \| null` | `null` | Reserved custom adjacency map. |

### Common Methods

| Method | Returns | Notes |
| --- | --- | --- |
| `resolvePageId(pageId)` | `number` | Resolves a numeric or semantic page ID. Unknown strings parse as numbers or fall back to `0`. |
| `getPages()` | `number[]` | Active page IDs from the layout matrix. |
| `getPageOffset(pageId, dims)` | `{ x: number; y: number }` | World coordinate offset for a page. |
| `getPagesMap(dims)` | `Record<number, { x; y }>` | Offset map for all active pages. |
| `getWorldBounds(dims)` | `WorldBounds` | Min/max camera bounds for gesture clamping. |
| `updateDimensions(dims)` | `void` | Updates config dimension state. |
| `updateSpringConfig(config)` | `void` | Merges spring physics overrides. |
| `getSpringConfig()` | `WithSpringConfig` | Returns current snap spring config. |
| `registerLayout(componentId, layout)` | `void` | Caches measured component layout for remounts. |
| `getLayout(componentId)` | layout or `undefined` | Reads cached component layout. |

## Hooks

### useAniview()

Returns the provider context. Throws if called outside `AniviewProvider`.

```tsx
const {
  dimensions,
  events,
  config,
  panGesture,
  visiblePages,
  isMoving,
  parentGestureRef,
  currentPageSV,
} = useAniview();
```

| Field | Type | Notes |
| --- | --- | --- |
| `dimensions` | `{ width; height; offsetX; offsetY }` | Current provider dimensions. |
| `events` | `{ x; y; [eventName]: SharedValue<number> }` | Camera shared values plus custom events. |
| `activationMap` | `Record<number, SharedValue<number>>` | Internal page activation map. |
| `panGesture` | `any` | Provider pan gesture. |
| `config` | `IAniviewConfig` | Active config instance. |
| `lock` | `(mask: number) => void` | Low-level gesture lock setter. |
| `visiblePages` | `Set<number>` | Current near-page set. |
| `isMoving` | `SharedValue<boolean>` | Whether snapping/gesture movement is in progress. |
| `parentGestureRef` | `React.RefObject<any>` | Ref for child gesture coordination. |
| `currentPageSV` | `SharedValue<number \| string>` | Last snapped target page. |

`useAniview(props)` is an internal overload used by `Aniview` itself to register a component. Most apps should use `useAniview()` without arguments.

### useAniviewLock()

Directional gesture-lock helper built on the nearest provider context.

```tsx
const { lockDirections, unlock, isMoving } = useAniviewLock();

lockDirections({ left: true, right: true });
unlock();
```

```ts
type AniviewAxisLock = {
  left?: boolean;
  right?: boolean;
  up?: boolean;
  down?: boolean;
};
```

`AniviewLock.mask(directions)` returns the numeric mask for a direction object. Prefer this helper over hand-coded masks in app code.

## Types

```ts
interface Dimensions {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

type AdjacencyMap = Record<number, Record<number, number>>;
```

## Next Steps

- [Getting Started](01-getting-started.md)
- [Core Concepts](02-core-concepts.md)
- [Gesture Control](08-gesture-control.md)
