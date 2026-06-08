# Aniview

[![npm version](https://badge.fury.io/js/aniview.svg)](https://www.npmjs.com/package/aniview)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React Native](https://img.shields.io/badge/React%20Native-%3E%3D0.71-blue)](https://reactnative.dev/)

Aniview is a coordinate-based animation and page-navigation engine for React Native. It lets you describe a 2D page world, place components on named pages, and define style frames that interpolate as the camera moves between pages or as custom Reanimated `SharedValue`s change.

## What it is good for

- Swipeable multi-page interfaces that are not just a flat carousel.
- Components that morph between pages without imperative animation code.
- Event-driven effects such as scroll, zoom, or progress-linked animation.
- React Native apps that need gesture coordination between page swipes and nested interactions.
- Persistent animated surfaces such as video, canvas, or GL content that must not unmount offscreen.

## Install

Aniview expects a working React Native app with Reanimated and React Native Gesture Handler configured.

```bash
npm install aniview react-native-reanimated react-native-gesture-handler
```

For Expo projects, prefer Expo's version resolver for the peer dependencies:

```bash
npx expo install react-native-reanimated react-native-gesture-handler
npm install aniview
```

Make sure the Reanimated Babel plugin is configured according to the Reanimated docs for your app.

## Minimal Example

```tsx
import React from "react";
import { Text, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Aniview, AniviewProvider } from "aniview";

const pageMap = {
  HOME: 0,
  PROFILE: 1,
};

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AniviewProvider layout={[[1, 1]]} pageMap={pageMap} defaultPage="HOME">
        <Aniview pageId="HOME" style={[styles.page, styles.home]}>
          <Text style={styles.title}>Home</Text>
        </Aniview>

        <Aniview pageId="PROFILE" style={[styles.page, styles.profile]}>
          <Text style={styles.title}>Profile</Text>
        </Aniview>

        <Aniview
          pageId="HOME"
          style={styles.badge}
          frames={{
            atProfile: {
              page: "PROFILE",
              style: {
                backgroundColor: "#e91e63",
                transform: [{ scale: 1.4 }],
              },
            },
          }}
        />
      </AniviewProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  home: { backgroundColor: "#e3f2fd" },
  profile: { backgroundColor: "#fce4ec" },
  title: { fontSize: 32, fontWeight: "700" },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2196f3",
    left: 32,
    top: 64,
  },
});
```

Swipe horizontally to move between `HOME` and `PROFILE`. The badge belongs to `HOME`, but its frame describes how it should look when the camera reaches `PROFILE`.

## Documentation

- [Getting Started](docs/01-getting-started.md) - Installation and first working app
- [Core Concepts](docs/02-core-concepts.md) - Coordinate space, pages, frames, baking, and virtualization
- [API Reference](docs/03-api-reference.md) - Public components, hooks, methods, and types
- [Advanced Patterns](docs/04-advanced-patterns.md) - Composition, persistence, and event-driven patterns
- [Examples & Recipes](docs/05-examples.md) - Larger examples and interaction recipes
- [Performance Guide](docs/06-performance.md) - Optimization techniques
- [Testing](docs/07-testing.md) - Testing Aniview logic and components
- [Gesture Control](docs/08-gesture-control.md) - Gesture toggles, locks, and simultaneous handlers
- [Reporting Issues](docs/09-reporting-issues.md) - Bug reports and feature requests
- [Local Development](LOCAL_DEV.md) - Using a local checkout from a React Native app

## Mental Model

Aniview has three moving parts:

1. `AniviewProvider` owns the camera, dimensions, page layout, gesture handler, and custom event shared values.
2. `AniviewConfig` maps page IDs to world coordinates and builds gesture/navigation rules.
3. `Aniview` components declare a home page plus optional spatial or event frames. On mount, frames are baked into interpolation lanes consumed by Reanimated worklets.

The important composition rule: use sibling `Aniview` components for world-positioned elements. Nest `Aniview` components only when you intentionally want parent and child transforms to combine.

## License

MIT (c) Madelyn Cruz Tan (TitanicEclair)
