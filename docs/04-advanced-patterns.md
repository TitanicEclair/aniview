---
id: advanced-patterns
slug: /advanced-patterns
title: Advanced Patterns
---

# Advanced Patterns

This guide covers advanced Aniview patterns for complex applications.

## 1. Sibling Composition

When building complex pages, avoid nesting `Aniview` components inside each other. Since `Aniview` handles its own positioning in the "World" by applying a transform relative to the camera, nesting them **sums these transforms**.

For example, if a parent Page translates `-100px` to stay in place relative to the world, and a child Aniview _also_ translates `-100px` to stay in place, the child will visually move `-200px` relative to the screen.

Instead, use a **Sibling Composition** pattern. Place multiple `Aniview` components as siblings in the `AniviewProvider` root. They will all move independently relative to the shared World Origin.

```tsx
function SettingsPage() {
  return (
    <>
      {/* Layer 1: Background */}
      <Aniview pageId="SETTINGS" style={styles.bg}>
        ...
      </Aniview>

      {/* Layer 2: Interactive Element */}
      <Aniview pageId="SETTINGS" style={styles.interactive}>
        ...
      </Aniview>
    </>
  );
}
```

### Intentional Nesting (The "Relative" Pattern)

Nesting IS technically allowed and can be useful for **parallax** or **relative movement** effects where you _want_ the child to move faster or differently than its parent.

For example, if you want a child element to stay "pinned" while the parent page scrolls away:

1.  **Parent**: Moves with the camera (standard Page behavior).
2.  **Child**: Nested inside. It inherits the parent's movement + applies its own.

You can control this relative movement using **Events**. By driving the child's transform with a custom event (like scroll position), you can counteract the parent's movement or exaggerate it.

#### Using Events for Relative Movement

Events allow you to decouple a component's movement from the camera's page-snapping logic.

- **See [Core Concepts: Event-Driven Animations](02-core-concepts.md#2-event-driven-animations)** for the syntax of setting up events.
- **See [Examples: Zoom Event](05-examples.md#4-zoom-event--persistent-event-frames)** for a practical example of event frames.

To create a relative movement effect (like a Parallax layer):

```tsx
// 1. Define a shared value for the event (e.g., scroll position)
const scrollY = useSharedValue(0);

// 2. Pass it to the provider
<AniviewProvider events={{ scrollY }} ...>
  {/* ... */}
</AniviewProvider>

// 3. In the child component, define a frame driven by this event
<Aniview
  pageId="HOME"
  frames={{
    parallaxEffect: {
      event: "scrollY", // Triggered by 'scrollY'
      value: 100,       // When scrollY is 100...
      style: {
        transform: [{ translateY: -50 }] // ...move up by 50 (0.5x speed)
      }
    }
  }}
/>
```

In this example, as `scrollY` increases to 100, the component moves up by 50 pixels. If this component is inside a parent that moves up by 100 pixels, the child effectively moves at **half speed** relative to the screen, creating a depth effect.

## 2. Persistence (Virtualization)

Aniview includes a built-in virtualization engine to save memory.

- **Default Behavior**: Components are **unmounted** when they are more than `1.5` screen lengths away from the camera (horizontally or vertically).
- **Result**: Local state (like `useState`, text input, or video playback) is lost when the component unmounts.

### The `persistent` Prop

To keep a component mounted forever (even when off-screen), set `persistent={true}`.

```tsx
<Aniview persistent={true} ...>
    <VideoPlayer source={...} />
</Aniview>
```

### Testing Virtualization

In the example app, we demonstrate this with two "Random Color" circles. The circle with `persistent={false}` changes color every time you navigate far away and return (because it unmounts and remounts). The circle with `persistent={true}` keeps its color.
