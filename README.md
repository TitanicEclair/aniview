# Aniview

[![npm version](https://badge.fury.io/js/aniview.svg)](https://www.npmjs.com/package/aniview)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React Native](https://img.shields.io/badge/React%20Native-%3E%3D0.71-blue)](https://reactnative.dev/)

> A high-performance, coordinate-based animation engine for React Native. Create fluid, multi-dimensional page transitions with spatial and event-driven animations.

## Features

- **Pre-computed Animation Grid** - Zero runtime frame searches
- **Spatial & Event-Driven** - Animate based on position OR custom events
- **Gesture Coordination** - Built-in lock system for complex UI interactions
- **Smart Color Interpolation** - Transparent-aware color transitions
- **Worklet-Optimized** - Runs entirely on the UI thread
- **2D Layout Engine** - Grid-based page navigation with overlap support
- **TypeScript First** - Full type safety out of the box

## Quick Start

```bash
npm install aniview react-native-reanimated react-native-gesture-handler
```

### Basic Example

```tsx
import { AniviewProvider, Aniview } from "aniview";

// 1. Define your layout (3x3 grid)
const config = new AniviewConfig(
  [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
  ],
  0, // default page
  { HOME: 0, PROFILE: 1, SETTINGS: 2 }, // page map
);

// 2. Wrap your app
function App() {
  return (
    <AniviewProvider config={config}>
      <Header />
      <Content />
    </AniviewProvider>
  );
}

// 3. Animate components
function Header() {
  return (
    <Aniview
      pageId="HOME"
      frames={{
        profile: {
          page: "PROFILE",
          style: { backgroundColor: "blue" },
        },
      }}
      style={{ height: 100, backgroundColor: "white" }}
    >
      <Text>My Header</Text>
    </Aniview>
  );
}
```

## Documentation

- **[Getting Started](docs/01-getting-started.md)** - Installation and first steps
- **[Core Concepts](docs/02-core-concepts.md)** - Understanding the architecture
- **[API Reference](docs/03-api-reference.md)** - Complete API documentation
- **[Advanced Patterns](docs/04-advanced-patterns.md)** - Composition, Persistence & Virtualization
- **[Examples & Recipes](docs/05-examples.md)** - Full Example App Walkthrough
- **[Performance Guide](docs/06-performance.md)** - Optimization techniques
- **[Testing](docs/07-testing.md)** - How to test Aniview components
- **[Gesture Control](docs/08-gesture-control.md)** - Lock system and gesture coordination
- **[Reporting Issues](docs/09-reporting-issues.md)** - Bug reports and feature requests

## Key Concepts

### The Grid System

Aniview uses a **2D grid layout** where each cell represents a "page":

```
[0, 1, 2]  →  Pages 0, 1, 2 (horizontal row)
[3, 4, 5]  →  Pages 3, 4, 5 (second row)
```

Components declare where they "live" (`pageId`) and how they transform when navigating to other pages (`frames`).

### Animation Types

1. **Spatial Animations** - Triggered by page navigation (X/Y position)
2. **Event-Driven Animations** - Triggered by custom SharedValues (scroll, zoom, etc.)

### The Baking Process

On mount, Aniview:

1. Pre-computes a **grid of all possible states**
2. Organizes them into **horizontal and vertical lanes**
3. Marks **constant values** to skip interpolation
4. All this happens **once**, not on every frame

## Platform Support

Aniview is designed for **React Native** (iOS and Android). It is compatible with:

- **Expo** managed workflow (SDK 49+)
- **React Native CLI** projects
- **New Architecture** (Fabric) — fully compatible (pure JS/TS + Reanimated worklets)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT © Madelyn Cruz Tan

## Credits

Built with:

- [react-native-reanimated](https://github.com/software-mansion/react-native-reanimated)
- [react-native-gesture-handler](https://github.com/software-mansion/react-native-gesture-handler)
