# Performance Guide

## Overview

Aniview is built for 60+ FPS animation performance. This guide explains the architecture that makes it fast and how to get the most out of it.

---

## How Aniview Is Fast

### The Baking Pipeline

On mount, each `Aniview` runs a one-time pre-computation ("bake") that eliminates runtime work:

```
Mount (JS thread, once)              Every Frame (UI thread)
━━━━━━━━━━━━━━━━━━━━━━━              ━━━━━━━━━━━━━━━━━━━━━━━
1. Grid construction                 1. Segment lookup (O(1))
2. Lane organization (H + V)         2. Linear interpolation
3. Color normalization → rgba()      3. Composite result
4. Constant folding                  → No searching, no parsing
```

**What this means in practice:**

| Operation     | Without Baking  | With Baking                    |
| ------------- | --------------- | ------------------------------ |
| Find frame    | O(n) per render | O(1) lookup                    |
| Parse colors  | Every frame     | Never (pre-normalized at bake) |
| Interpolation | All properties  | Only dynamic properties        |

### Segment Caching

Inside `useAnimatedStyle`, Aniview finds the interpolation segment **once per frame**, then reuses it for every property. So if a component has 20 animated properties, the segment search runs 1 time, not 20.

### Constant Folding

During baking, Aniview detects when a property has the **same value at every position** along an axis. These properties are marked with `constFlags` and skip interpolation entirely at runtime.

```tsx
frames={{
  left:  { page: 'PAGE_1', style: { opacity: 0, backgroundColor: 'red' } },
  right: { page: 'PAGE_2', style: { opacity: 0, backgroundColor: 'red' } }
}}
// backgroundColor is the same at both positions → constFlag = true
// At render: skip interpolateColor() for backgroundColor entirely
```

### Smart Color Interpolation

When transitioning between a solid color and `transparent`, standard `interpolateColor` produces a gray flash (the RGB channels decay to black). Aniview's `smartInterpolateColor` preserves the RGB of the non-transparent color and only fades the alpha:

```
Standard:     rgba(255,255,255,1) → rgba(0,0,0,0)     // Gray flash at midpoint
Aniview:      rgba(255,255,255,1) → rgba(255,255,255,0) // Clean fade
```

### Dual-Layer Virtualization

Aniview has two virtualization layers that work together automatically:

1. **Worklet-level** (instant): Components more than 1.5× screen width from the camera are set to `opacity: 0` on the UI thread. Zero React re-renders.

2. **JS-level** (deferred): After a snap completes, far-away non-persistent components are unmounted from the React tree to reclaim memory.

---

## Optimization Techniques

### 1. Frame Property Defaults

Properties specified in a frame but **not** in the base `style` are taken to be the same as the base style. Aniview uses **value-based** change detection — if a frame property's value matches the base, it's flagged as constant and skipped at runtime. This means redundant specifications are harmless, but unnecessary:

```tsx
<Aniview
  pageId="HOME"
  style={{ width: 100, height: 100, borderRadius: 20 }}
  frames={{
    away: {
      page: "PROFILE",
      style: {
        width: 100, // Same as base — will be detected as constant, not interpolated
        height: 100, // Same as base — will be detected as constant, not interpolated
        borderRadius: 20, // Same as base — will be detected as constant, not interpolated
        opacity: 0, // Different from base — this is the only property that gets interpolated
      },
    },
  }}
/>
```

Properties in `style` that don't appear in any frame are **never interpolated**. They're applied as-is.

### 2. Stabilize Dependencies

The bake runs inside `useMemo`. If its dependencies change, it re-bakes. Avoid creating new `style` objects on every render:

**❌ Re-bakes every render:**

```tsx
<Aniview style={{ width: 100, backgroundColor: "red" }} />
```

**✅ Stable — bakes once:**

```tsx
const stableStyle = useMemo(() => ({ width: 100, backgroundColor: "red" }), []);
<Aniview style={stableStyle} />;
```

Or use `StyleSheet.create`:

```tsx
const styles = StyleSheet.create({
  box: { width: 100, backgroundColor: "red" },
});
<Aniview style={styles.box} />;
```

### 3. Use `persistent` Sparingly

`persistent={true}` prevents unmounting, which means those components contribute to the render tree even when offscreen. Only use it for:

- WebGL/Three.js canvases
- Components with expensive internal state (video players, etc.)
- Components with event-driven animations that must remain active cross-page

### 4. Keep Event Lanes Focused

Only pass events to `AniviewProvider` that are actually consumed by frames:

```tsx
// ❌ Passing unused events
<AniviewProvider events={{ scrollY, zoom, rotation, tilt }}>

// ✅ Only what's needed
<AniviewProvider events={{ scrollY }}>
```

Each event drives a 1D interpolation lane. Unused events still consume a small amount of worklet overhead.

---

## Presence-Weighted Events

Aniview modulates event-driven animations by **presence** — a value from 0 to 1 indicating how close the camera is to the component's home page. When you swipe away from a page, its event-driven effects fade out automatically.

This means you don't need to manually gate event effects. A scroll-linked header on Page 0 won't "leak" its scroll offset into Page 1's layout.

If you need an event to stay active even when far from the home page, use `persistent: true` on the event frame:

```tsx
frames={{
  scrolled: {
    event: 'scrollY',
    value: 100,
    persistent: true, // Effect stays active on all pages
    style: { opacity: 0.5 },
  },
}}
```

---

## Profiling & Debugging

### Measure Bake Time

Bake time is usually 1-5ms. If you suspect it's excessive, wrap your component in a timing log:

```tsx
const start = performance.now();
const baked = useMemo(() => performBake(), [deps]);
console.log(`Bake: ${performance.now() - start}ms`);
```

### React DevTools Profiler

1. Enable profiling in React DevTools
2. Start recording → navigate between pages
3. Look for:
   - Aniview render time: should be < 1ms
   - Bake phase: one-time mount cost
   - `useAnimatedStyle` callbacks: should be minimal

### Worklet Debugging

In Reanimated 3.0+, `console.log` works inside worklets:

```tsx
const animatedStyle = useAnimatedStyle(() => {
  console.log(`Camera: ${events.x.value}, ${events.y.value}`);
  return computeStyle();
});
```

---

## Common Pitfalls

### 1. Too Many Aniview Components

If you have static content that doesn't animate, wrap it in a regular `View`:

```tsx
<View>
  <Text>Static header</Text>
  <Aniview>
    <DynamicContent />
  </Aniview>
</View>
```

Only components that need position/style interpolation should be `Aniview`.

### 2. Inline Style Objects

As mentioned above, inline objects cause re-bakes on every render. Use `StyleSheet.create` or `useMemo`.

### 3. Redundant Frame Properties

Don't repeat the same value in `style` and `frames` — it wastes constant folding analysis time and adds noise.

---

## Production Checklist

- [ ] Static properties in `style`, dynamic in `frames`
- [ ] Style objects stabilized (`StyleSheet.create` or `useMemo`)
- [ ] `persistent={true}` only where necessary
- [ ] Only needed events passed to `AniviewProvider`
- [ ] Tested on low-end devices (iPhone 8, Android mid-range)
- [ ] Profiled with React DevTools

---

## Next Steps

- Learn how to test Aniview components in [Testing Guide](07-testing.md)
- Review [Gesture Control](08-gesture-control.md) for complex interactions
