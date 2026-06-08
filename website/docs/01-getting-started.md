---
id: getting-started
slug: /getting-started
title: Getting Started
---

# Getting Started

This tutorial builds a two-page React Native scene with one component that morphs as the user swipes between pages.

## Prerequisites

- Node.js 18 or newer
- A working React Native app
- React Native 0.71 or newer
- Reanimated and React Native Gesture Handler configured in your app

## Install

Install Aniview and its peer dependencies:

```bash
npm install aniview react-native-reanimated react-native-gesture-handler
```

For Expo projects:

```bash
npx expo install react-native-reanimated react-native-gesture-handler
npm install aniview
```

Add the Reanimated Babel plugin if your app does not already have it. It must be last in the plugin list:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-reanimated/plugin"],
  };
};
```

## Create a Page World

Aniview pages live in a 2D matrix. A `1` means the page exists; a `0` means the grid cell is empty.

```tsx
const pageMap = {
  HOME: 0,
  PROFILE: 1,
};

<AniviewProvider layout={[[1, 1]]} pageMap={pageMap} defaultPage="HOME">
  {/* pages go here */}
</AniviewProvider>
```

You can also construct `new AniviewConfig(...)` yourself and pass it as `config`, but the `layout` prop is enough for most apps.

## Add Pages

Each page is an `Aniview` with a `pageId`.

```tsx
<Aniview pageId="HOME" style={[styles.page, styles.home]}>
  <Text style={styles.title}>Home</Text>
</Aniview>

<Aniview pageId="PROFILE" style={[styles.page, styles.profile]}>
  <Text style={styles.title}>Profile</Text>
</Aniview>
```

## Add a Morphing Component

Frames describe how a component should look at another page or event value.

```tsx
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
```

The badge starts from `styles.badge` on `HOME`. As the camera moves toward `PROFILE`, Aniview interpolates toward the `atProfile` style.

## Complete Example

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

## Programmatic Navigation

Use a ref when you need buttons or app state to control the camera.

```tsx
import React, { useRef } from "react";
import type { AniviewHandle } from "aniview";

const aniviewRef = useRef<AniviewHandle>(null);

<AniviewProvider
  ref={aniviewRef}
  layout={[[1, 1]]}
  pageMap={pageMap}
  defaultPage="HOME"
>
  {/* pages */}
</AniviewProvider>

// Later:
aniviewRef.current?.snapToPage("PROFILE");
```

## Composition Rule

Prefer sibling `Aniview` components inside the provider. Siblings share the same world camera and each computes its own world transform.

Nested `Aniview` components are allowed, but the transforms combine. Use nesting only when you intentionally want relative movement such as parallax.

## Next Steps

- [Core Concepts](02-core-concepts.md) explains the coordinate model.
- [API Reference](03-api-reference.md) lists props, hooks, methods, and types.
- [Gesture Control](08-gesture-control.md) covers nested scroll and interaction coordination.
