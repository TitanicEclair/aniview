---
id: api-reference
slug: /api-reference
title: API Reference
---

# API Reference

## Table of Contents

- [AniviewProvider](#aniviewprovider)
- [Aniview](#aniview)
- [AniviewConfig](#aniviewconfig)
- [Hooks](#hooks)
- [Types](#types)

---

## AniviewProvider

The root component that sets up the animation context and gesture handling.

### Props

| Prop           | Type                          | Required | Default     | Description                    |
| -------------- | ----------------------------- | -------- | ----------- | ------------------------------ |
| `children`     | `ReactNode`                   | ✅       | -           | Child components               |
| `config`       | `AniviewConfig`               | ✅       | -           | Configuration instance         |
| `dimensions`   | `Partial<Dimensions>`         | ❌       | Screen size | Override viewport size         |
| `defaultPage`  | `number \| string`            | ❌       | `0`         | Initial page                   |
| `onPageChange` | `(pageId) => void`            | ❌       | -           | Page change callback           |
| `activePage`   | `number \| string`            | ❌       | -           | Controlled page (legacy)       |
| `gestureRef`   | `RefObject<PanGesture>`       | ❌       | -           | External gesture ref           |
| `springConfig` | `WithSpringConfig`            | ❌       | See below   | Custom physics                 |
| `events`       | `Record<string, SharedValue>` | ❌       | `{}`        | Event-driven animation drivers |

### Default Spring Config

```typescript
{
  damping: 60,
  stiffness: 200,
  mass: 0.6,
  overshootClamping: true,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 2
}
```

### Ref API (`AniviewHandle`)

```typescript
interface AniviewHandle {
  snapToPage: (pageId: number | string) => void;
  getCurrentPage: () => number | string;
  lock: (mask: number) => void;
}
```

### Example

```tsx
const aniviewRef = useRef<AniviewHandle>(null);

<AniviewProvider
  config={config}
  ref={aniviewRef}
  defaultPage="HOME"
  onPageChange={(page) => console.log("Now at:", page)}
  springConfig={{ damping: 80, stiffness: 300 }}
  events={{ scrollFactor: myScrollValue }}
>
  <App />
</AniviewProvider>;

// Imperative navigation:
aniviewRef.current.snapToPage("SETTINGS");
```

---

## Aniview

The animated component that responds to camera position and events.

### Props

| Prop            | Type                       | Required | Default  | Description                        |
| --------------- | -------------------------- | -------- | -------- | ---------------------------------- |
| `pageId`        | `number \| string`         | ✅       | -        | Home page identifier               |
| `frames`        | `Frames`                   | ❌       | `{}`     | Animation keyframes                |
| `style`         | `ViewStyle \| ViewStyle[]` | ❌       | `{}`     | Base styles                        |
| `children`      | `ReactNode`                | ❌       | -        | Child content                      |
| `pointerEvents` | `PointerEvents`            | ❌       | `'auto'` | Touch handling                     |
| `persistent`    | `boolean`                  | ❌       | `false`  | Keep mounted offscreen (for 3D/GL) |
| ...`ViewProps`  | -                          | ❌       | -        | All standard View props            |

### Frames Structure

```typescript
type Frames = Record<string, AniviewFrame> | AniviewFrame[];

interface AniviewFrame {
  // Spatial trigger (page-based)
  page?: number | string;

  // Event trigger (1D animation)
  event?: string;
  value?: number;

  // Style overrides
  style?: ViewStyle | ViewStyle[];

  // Shortcuts
  opacity?: number;
  scale?: number;
  rotate?: number; // degrees
}
```

### Supported Style Properties

#### Numeric Properties

- Layout: `width`, `height`, `left`, `top`, `right`, `bottom`
- Margins: `marginTop`, `marginLeft`, etc.
- Padding: `paddingTop`, `paddingLeft`, etc.
- Border: `borderRadius`, `borderWidth`, etc.
- Shadow: `shadowRadius`, `shadowOpacity`, `elevation`
- Opacity: `opacity`

#### Color Properties

- `backgroundColor`
- `borderColor`
- `shadowColor`
- `color` (for Text children)
- Any property containing "color"

#### Transform Properties

- `translateX`, `translateY`
- `scale`, `scaleX`, `scaleY`
- `rotate`, `rotateX`, `rotateY`, `rotateZ`
- `skewX`, `skewY`

### Examples

#### Basic Fade

```tsx
<Aniview
  pageId="HOME"
  style={{ opacity: 1 }}
  frames={{
    hidden: { page: "AWAY", opacity: 0 },
  }}
/>
```

#### Multi-Property Animation

```tsx
<Aniview
  pageId="HOME"
  style={{
    width: 200,
    height: 200,
    backgroundColor: "white",
    transform: [{ scale: 1 }],
  }}
  frames={{
    scaled: {
      page: "DETAIL",
      style: {
        width: 400,
        height: 400,
        backgroundColor: "blue",
        transform: [{ scale: 1.5 }],
      },
    },
  }}
/>
```

#### Event-Driven Animation

```tsx
<Aniview
  pageId="HOME"
  frames={{
    scrolled: {
      event: "scrollFactor",
      value: 0,
      style: { opacity: 0.3 },
    },
    fullyScrolled: {
      event: "scrollFactor",
      value: 1,
      style: { opacity: 1 },
    },
  }}
/>
```

---

## AniviewConfig

Configuration object that manages the grid layout, page mappings, and gesture logic.

### Constructor

```typescript
new AniviewConfig(
  layout: number[][],
  defaultPage?: number | string,
  pageMap?: Record<string, number>,
  initialDims?: Partial<Dimensions>,
  overlaps?: { rows?: number[], cols?: number[] },
  adjacencyGraph?: AdjacencyMap
)
```

### Parameters

| Parameter        | Type                     | Default      | Description                        |
| ---------------- | ------------------------ | ------------ | ---------------------------------- |
| `layout`         | `number[][]`             | **Required** | 2D grid (1 = active, 0 = disabled) |
| `defaultPage`    | `number \| string`       | `0`          | Starting page                      |
| `pageMap`        | `Record<string, number>` | `{}`         | Semantic name mapping              |
| `initialDims`    | `Partial<Dimensions>`    | `{}`         | Initial dimensions                 |
| `overlaps`       | `{ rows?, cols? }`       | `{}`         | Row/column overlap ratios (0-1)    |
| `adjacencyGraph` | `AdjacencyMap`           | `{}`         | Custom snap adjacency              |

### Methods

#### `getPageOffset(pageId, dims): { x, y }`

Get world coordinates for a page.

```typescript
const offset = config.getPageOffset("HOME", dimensions);
// => { x: 0, y: 0 }
```

#### `resolvePageId(pageId): number`

Convert semantic name to numeric ID.

```typescript
config.resolvePageId("HOME"); // => 0
config.resolvePageId(0); // => 0
```

#### `getPages(): number[]`

Get all active page IDs.

```typescript
config.getPages(); // => [0, 1, 2, 3, 5, 6, 7, 8]
```

#### `getPagesMap(dims): Record<number, { x, y }>`

Get all page coordinates.

```typescript
config.getPagesMap(dimensions);
// => { 0: { x: 0, y: 0 }, 1: { x: 430, y: 0 }, ... }
```

#### `getWorldBounds(dims): WorldBounds`

Get min/max world coordinates.

```typescript
config.getWorldBounds(dimensions);
// => { minX: 0, maxX: 1290, minY: 0, maxY: 1864 }
```

#### `updateDimensions(dims): void`

Update viewport dimensions.

```typescript
config.updateDimensions({ width: 414, height: 896, offsetX: 0, offsetY: 0 });
```

#### `updateSpringConfig(config): void`

Update spring physics.

```typescript
config.updateSpringConfig({ damping: 70, stiffness: 250 });
```

### Example

```typescript
const config = new AniviewConfig(
  [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  "HOME", // Default page
  {
    HOME: 0,
    FEED: 1,
    PROFILE: 2,
    SETTINGS: 3,
    DETAIL: 5,
  },
  { width: 430, height: 932 }, // Initial dims
  { rows: [0, 0.1], cols: [0, 0] }, // 10% vertical overlap between rows
);
```

---

## Hooks

### `useAniview()`

Access Aniview context from any child component.

```typescript
const { dimensions, events, config, activationMap, visiblePages, isMoving } =
  useAniview();
```

**Returns:**

- `dimensions: Dimensions` - Current viewport size
- `events: { x, y, ...custom }` - Camera position and custom events
- `config: IAniviewConfig` - Configuration instance
- `activationMap: Record<number, SharedValue>` - Page activation states
- `panGesture: PanGesture` - Main gesture handler
- `visiblePages: Set<number>` - Currently visible page IDs
- `isMoving: SharedValue<boolean>` - Whether Aniview is currently snapping/animating

### `useAniviewLock()`

Lock/unlock specific swipe directions from within any child component.

```typescript
const { lockDirections, unlock, isMoving, AniviewLock } = useAniviewLock();
```

**Returns:**

| Property         | Type                                | Description              |
| ---------------- | ----------------------------------- | ------------------------ |
| `lockDirections` | `(dirs: AniviewAxisLock) => void`   | Lock specific directions |
| `unlock`         | `() => void`                        | Release all locks        |
| `isMoving`       | `SharedValue<boolean> \| undefined` | Animation state          |
| `AniviewLock`    | `{ mask: (dirs) => number }`        | Bitmask utility          |

**AniviewAxisLock:**

```typescript
type AniviewAxisLock = {
  left?: boolean; // bit 1
  right?: boolean; // bit 2
  up?: boolean; // bit 4
  down?: boolean; // bit 8
};
```

**Example:**

```tsx
function MyComponent() {
  const { lockDirections, unlock } = useAniviewLock();

  const onScrollStart = () => lockDirections({ left: true, right: true });
  const onScrollEnd = () => unlock();

  return (
    <ScrollView
      onScrollBeginDrag={onScrollStart}
      onScrollEndDrag={onScrollEnd}
    />
  );
}
```

---

## Types

### Core Types

```typescript
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

### Animation Types

```typescript
interface AniviewFrame {
  page?: number | string;
  event?: string;
  value?: number;
  style?: ViewStyle | ViewStyle[];
  opacity?: number;
  scale?: number;
  rotate?: number;
  springConfig?: WithSpringConfig;
}

interface BakedFrame extends AniviewFrame {
  worldX: number;
  worldY: number;
}
```

### Provider Types

```typescript
interface AniviewHandle {
  snapToPage: (pageId: number | string) => void;
  getCurrentPage: () => number | string;
  lock: (mask: number) => void;
}

interface AniviewContextType {
  dimensions: Dimensions;
  events: {
    x: SharedValue<number>;
    y: SharedValue<number>;
    [key: string]: SharedValue<number>;
  };
  activationMap: Record<number, SharedValue<number>>;
  panGesture: PanGesture;
  config: IAniviewConfig;
  lock: (mask: number) => void;
  visiblePages: Set<number>;
}
```

---

## Next Steps

- See practical examples in [Examples & Recipes](05-examples.md)
- Learn optimization techniques in [Performance Guide](06-performance.md)
- Understand testing in [Testing Guide](07-testing.md)
