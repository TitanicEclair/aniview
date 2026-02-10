# Reporting Issues

## Bug Reports

If you encounter a bug, please [open an issue](https://github.com/TitanicEclair/aniview/issues/new) with the following information:

### Template

```markdown
## Bug: [Short description]

### Steps to Reproduce

1. Create an Aniview component with [specific config]
2. [Action that triggers the bug]
3. Observe [unexpected behavior]

### Expected Behavior

What should happen.

### Actual Behavior

What actually happens. Include screenshots or screen recordings if possible.

### Environment

- OS: [iOS 17 / Android 14 / etc.]
- React Native: [0.73 / 0.74 / etc.]
- Aniview: [1.0.0]
- react-native-reanimated: [4.1.1]
- react-native-gesture-handler: [2.28.0]
- Expo SDK: [54 / N/A]
```

### Tips for Good Bug Reports

- **Minimal reproduction** — strip your code down to the smallest example that shows the bug
- **Screenshots/recordings** — especially useful for animation issues
- **Console output** — include any warnings or errors from the metro bundler

---

## Feature Requests

For feature requests, [open a discussion](https://github.com/TitanicEclair/aniview/discussions/new?category=ideas) or issue with:

- **Use case** — what problem are you solving?
- **Proposed API** — how would the feature look to a developer?
- **Alternatives considered** — other approaches you've thought about

---

## Common Issues

Before filing, check if your issue matches one of these:

### "Animation is janky"

- Ensure `react-native-reanimated/plugin` is **last** in your Babel plugins
- Check that you're not creating new `style` objects on every render (use `StyleSheet.create` or `useMemo`)
- See the [Performance Guide](06-performance.md)

### "Gestures conflict with my ScrollView"

- Use `externalLockMask` to lock horizontal panning while scrolling vertically
- See [Gesture Control](08-gesture-control.md)

### "Component flashes on mount"

- This can happen if `dimensions` aren't available yet. Aniview renders at `opacity: 0` until layout is measured.
- Ensure your `AniviewProvider` has a parent with defined dimensions (e.g., `flex: 1`).

### "Colors turn gray during transition"

- This is a known issue with standard `interpolateColor` when transitioning to `transparent`. Aniview's `smartInterpolateColor` handles this automatically, but if you're using custom color logic, ensure you're not mixing color formats.

---

## See Also

- [Contributing Guidelines](../CONTRIBUTING.md) — How to submit fixes and features
- [Testing Guide](07-testing.md) — How to test your Aniview components
