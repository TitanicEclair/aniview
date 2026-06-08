# Gesture Control

## Overview

Aniview provides built-in gesture control for page navigation. For complex UIs with nested scroll views, buttons, or custom gestures, you can control how Aniview's pan gesture behaves using two mechanisms:

1. **`gestureEnabled`** — Simple on/off toggle
2. **`externalLockMask`** — Axis-specific control (lock horizontal, vertical, or both independently)

---

## gestureEnabled (Simple API)

Pass a `SharedValue<boolean>` to `AniviewProvider` to globally enable/disable Aniview's pan gesture:

```tsx
import { useSharedValue } from "react-native-reanimated";
import { AniviewLock } from "aniview";

const gestureEnabled = useSharedValue(true);

<AniviewProvider config={config} gestureEnabled={gestureEnabled}>
  ...
</AniviewProvider>;
```

Then toggle it from any child component:

```tsx
<Pressable
  onPressIn={() => {
    "worklet";
    gestureEnabled.value = false;
  }}
  onPressOut={() => {
    "worklet";
    gestureEnabled.value = true;
  }}
>
  <Text>Button</Text>
</Pressable>
```

### When to Use

- ✅ Buttons/Pressables (prevent accidental swipes while pressing)
- ✅ Modals/Bottom Sheets (disable background navigation)
- ✅ Long-press interactions
- ✅ Any "disable all panning" scenario

---

## externalLockMask (Advanced API)

For low-level control, pass a `SharedValue<number>` as `externalLockMask`:

```tsx
const lockMask = useSharedValue(0);

<AniviewProvider config={config} externalLockMask={lockMask}>
  ...
</AniviewProvider>;
```

### Bit Pattern

Use `AniviewLock.mask(...)` instead of hand-writing masks when possible.

| Direction | Bit |
| --- | --- |
| `left` | `1` |
| `right` | `2` |
| `up` | `4` |
| `down` | `8` |

### Usage Example

```tsx
<ScrollView
  onScrollBeginDrag={() => {
      "worklet";
    lockMask.value = AniviewLock.mask({ left: true, right: true });
  }}
  onScrollEndDrag={() => {
    "worklet";
    lockMask.value = 0;
  }}
>
  {/* Vertical scroll works, horizontal page swipes blocked */}
</ScrollView>
```

### When to Use

- ✅ Nested ScrollViews (block Aniview on one axis, allow the other)
- ✅ Custom gestures that conflict with specific axes
- ✅ Complex multi-directional interactions

---

## Disabling All Panning

Use `gestureEnabled` when you want to disable all Aniview panning. It is clearer than setting every lock bit manually:

```typescript
gestureEnabled.value = false;
```

For directional locking, set the mask back to `0` when the child interaction ends.

---

## simultaneousHandlers

For advanced gesture coordination with React Native Gesture Handler:

```tsx
import { Gesture } from "react-native-gesture-handler";

const myGesture = Gesture.Pan();

<AniviewProvider config={config} simultaneousHandlers={[myGesture]}>
  ...
</AniviewProvider>;
```

This allows `myGesture` to run **simultaneously** with Aniview's internal pan gesture instead of blocking it.

---

## Comparison

| Scenario            | Use `gestureEnabled` | Use `lockMask`       |
| ------------------- | -------------------- | -------------------- |
| Button press-drag   | ✅                   | ❌                   |
| Modal open          | ✅                   | ❌                   |
| Vertical ScrollView | No | Yes, lock left and right |
| Horizontal FlatList | No | Yes, lock up and down |
| Tutorial/Onboarding | Yes | No |
| Pinch zoom active   | Yes | No |

---

## Complete Example

```tsx
import { useSharedValue } from "react-native-reanimated";
import { AniviewLock, AniviewProvider, AniviewConfig } from "aniview";

function MyApp() {
  const gestureEnabled = useSharedValue(true);
  const lockMask = useSharedValue(0);

  return (
    <AniviewProvider
      config={config}
      gestureEnabled={gestureEnabled}
      externalLockMask={lockMask}
    >
      {/* Simple button: disable all panning */}
      <Pressable
        onPressIn={() => {
          gestureEnabled.value = false;
        }}
        onPressOut={() => {
          gestureEnabled.value = true;
        }}
      >
        <Text>Simple Button</Text>
      </Pressable>

      {/* Vertical scroll: lock horizontal only */}
      <ScrollView
        onScrollBeginDrag={() => {
          lockMask.value = AniviewLock.mask({ left: true, right: true });
        }}
        onScrollEndDrag={() => {
          lockMask.value = 0;
        }}
      >
        {/* Content scrolls vertically, page swipes blocked */}
      </ScrollView>
    </AniviewProvider>
  );
}
```

---

## Best Practices

1. **Prefer `gestureEnabled` for simple cases** — clearer intent
2. **Use `lockMask` only when you need axis-specific control**
3. **Always release locks** — add `onPressOut`, `onScrollEndDrag`, etc.
4. **Use the worklet directive** — all SharedValue mutations in gesture/scroll callbacks should be in worklets
5. **Test on real devices** — gesture behavior can differ from simulator

---

## See Also

- [Core Concepts](02-core-concepts.md) — Understanding the architecture
- [Examples & Recipes](05-examples.md) — Gesture coordination patterns
- [Performance Guide](06-performance.md) — Optimization techniques
