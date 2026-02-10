# Advanced Patterns

This guide covers advanced Aniview patterns for complex applications.

## 1. Sibling Composition

When building complex pages, avoid nesting `Aniview` components inside each other. Since `Aniview` handles its own positioning in the "World", nesting them causes double-transformations (the child moves twice as fast as the parent).

Instead, use a **Sibling Composition** pattern. Anchor multiple `Aniview` components to the same `pageId` and position them absolutely relative to the page origin.

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
