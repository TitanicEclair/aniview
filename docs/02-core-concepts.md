---
id: core-concepts
slug: /core-concepts
title: Core Concepts
---

# Core Concepts

## Architecture Overview

Aniview uses a **coordinate-based animation system** where components exist in a 2D grid and transform based on camera position.

```
┌─────────────────────────────────────┐
│     WORLD COORDINATE SPACE          │
│                                     │
│  [Page 0]  [Page 1]  [Page 2]       │
│     ↑                               │
│     └── Components declare their    │
│          "home" page                │
│                                     │
│  Camera Position (x, y) determines  │
│  what the user sees                 │
└─────────────────────────────────────┘
```

## The Grid System

### Layout Matrix

The layout is defined as a **2D matrix** where `1` represents an active page:

```typescript
const layout = [
  [1, 1, 1], // Row 0: Pages 0, 1, 2
  [1, 0, 1], // Row 1: Pages 3, _, 5 (4 is disabled)
  [1, 1, 1], // Row 2: Pages 6, 7, 8
];
```

**Page ID Calculation:**

```
pageId = rowIndex * columnsPerRow + columnIndex
```

### Page Mapping

Use semantic names for better code readability:

```typescript
const pageMap = {
  HOME: 0,
  FEED: 1,
  PROFILE: 2,
  SETTINGS: 3,
  // ...
};

config = new AniviewConfig(layout, 0, pageMap);
```

Now you can use `pageId="HOME"` instead of `pageId={0}`.

## Components & Frames

### Component Registration

Every Aniview component declares where it "lives":

```typescript
<Aniview
  pageId="HOME"  // This component belongs to the HOME page
  style={{ width: 100, height: 100 }}
>
  <MyContent />
</Aniview>
```

### Keyframes (Frames)

**Frames** define how a component transforms when navigating to different pages:

```typescript
<Aniview
  pageId="HOME"
  style={{
    width: 100,
    height: 100,
    backgroundColor: 'white'
  }}
  frames={{
    // When camera is at PROFILE page:
    profileFrame: {
      page: 'PROFILE',
      style: {
        opacity: 0,
        backgroundColor: 'blue'
      }
    },
    // When camera is at SETTINGS page:
    settingsFrame: {
      page: 'SETTINGS',
      opacity: 0.5 // Shorthand for style: { opacity: 0.5 }
    }
  }}
>
  <MyContent />
</Aniview>
```

**Frame Properties:**

- `page` - Target page for this frame
- `style` - Style overrides at this position
- `opacity` - Shorthand for `style: { opacity }`
- `scale` - Shorthand for `style: { transform: [{ scale }] }`
- `rotate` - Shorthand for `style: { transform: [{ rotate }] }` (degrees)

## Animation Types

### 1. Spatial Animations (Page-Based)

Triggered by **camera position** in the 2D grid:

```typescript
frames={{
  nextPage: {
    page: 'PROFILE',     // Spatial trigger
    style: { opacity: 0 }
  }
}}
```

**Interpolation:** Component smoothly transitions between HOME and PROFILE as the camera moves.

### 2. Event-Driven Animations

Triggered by **custom SharedValues**:

```typescript
// In your provider:
const scrollFactor = useSharedValue(1);

<AniviewProvider
  config={config}
  events={{ scrollFactor }}  // Expose event
>
  {/* Children */}
</AniviewProvider>

// In your component:
<Aniview
  pageId="HOME"
  frames={{
    scrolled: {
      event: 'scrollFactor',  // Event trigger
      value: 0,               // When scrollFactor === 0
      style: { opacity: 0.5 }
    }
  }}
/>
```

**Use Cases:**

- Scroll-based parallax
- Zoom effects
- Pull-to-refresh indicators
- Any custom animation driver

## The Baking Process

### What is "Baking"?

When an Aniview component mounts, it runs a **one-time pre-computation** called "baking":

```typescript
// BEFORE (Naive approach - O(frames) per render):
frames.find((f) => f.page === currentPage)?.style;

// AFTER (Baking - O(1) per render):
bakedGrid[`${x}_${y}`]; // Direct lookup
```

### Baking Steps

1. **Grid Construction**

   ```typescript
   const grid = {
     "0_0": { opacity: 1, backgroundColor: "white" }, // HOME
     "430_0": { opacity: 0, backgroundColor: "blue" }, // PROFILE
     // ... all positions pre-computed
   };
   ```

2. **Lane Organization**

   ```typescript
   // Horizontal lanes (for vertical scrolling)
   bakedH = [
     { fixed: 0, values: [[1, 0, ...], [255, 0, ...]] },
     { fixed: 100, values: [[1, 0.5, ...], [255, 128, ...]] }
   ];
   ```

3. **Constant Folding**
   ```typescript
   constFlags = [true, false, false];
   // Property 0 is constant - skip interpolation!
   ```

### Performance Impact

- **Mount**: One-time cost (1-5ms for typical component)
- **Render**: O(small constant) segment lookup per frame — no searching or string parsing
- **Result**: Smooth performance even with many animated properties

## Coordinate System

### World Coordinates

Each page has a position in "world space":

```typescript
// For a 430x932 screen with 3 columns:
const worldCoords = {
  HOME: { x: 0, y: 0 },
  FEED: { x: 430, y: 0 },
  PROFILE: { x: 860, y: 0 },
};
```

### Camera Position

The `camera` (x, y shared values) determines what's visible:

```typescript
// Camera at HOME:
camera = { x: 0, y: 0 };

// Camera transitioning to FEED:
camera = { x: 215, y: 0 }; // Halfway between HOME and FEED

// Camera at FEED:
camera = { x: 430, y: 0 };
```

### Component Transform

Each Aniview component calculates its screen position:

```typescript
screenX = componentWorldX - cameraX;
screenY = componentWorldY - cameraY;

// Applied via transform: [{ translateX }, { translateY }]
```

## Gesture Coordination

### The Lock System

Aniview provides a **bitmask-based locking system** for gesture coordination:

```typescript
const LOCK_HORIZONTAL = 1; // 0b01
const LOCK_VERTICAL = 2; // 0b10
const LOCK_BOTH = 3; // 0b11
```

### Usage Pattern

```typescript
// In a child ScrollView:
import { useAniviewLock, AniviewLock } from "aniview";

const { lock } = useAniviewLock();

const scrollHandler = useAnimatedScrollHandler({
  onBegin: () => {
    "worklet";
    lock(AniviewLock.HORIZONTAL); // Lock Aniview's horizontal pan
  },
  onEnd: () => {
    "worklet";
    lock(AniviewLock.NONE); // Release lock
  },
});
```

The Aniview gesture handler **respects** these locks and prevents conflicting movements.

## Virtualization

Aniview handles virtualization **automatically** — you don't need to write any visibility logic.

### How It Works

There are two layers:

1. **Worklet-level hiding**: On every animation frame, components farther than 1.5× screen width from the camera are set to `opacity: 0` instantly on the UI thread. This is zero-cost and keeps the visual state clean.

2. **JS-thread unmounting**: After a snap completes, non-persistent components that are far from the camera are fully unmounted from the React tree to reclaim memory.

### Opting Out

Set `persistent={true}` to keep a component mounted even when offscreen. This is necessary for WebGL/Three.js canvases and components that must maintain internal state:

```tsx
<Aniview pageId="CANVAS" persistent={true}>
  <My3DScene />
</Aniview>
```

### Layout Caching

When a non-persistent component unmounts and later remounts, Aniview restores its layout from an internal cache — no re-measurement needed.

## Next Steps

- Explore the [API Reference](03-api-reference.md)
- See practical [Examples & Recipes](05-examples.md)
- Learn about [Performance Optimization](06-performance.md)
