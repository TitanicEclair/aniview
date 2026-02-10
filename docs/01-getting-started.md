# Getting Started

## Prerequisites

- **Node.js** ≥ 18
- **React Native** ≥ 0.71 (or **Expo SDK** 49+)
- A working React Native project (Expo or bare CLI)

## Installation

Install Aniview and its required peer dependencies:

```bash
npx expo install react-native-reanimated react-native-gesture-handler react-native-worklets
```

> [!IMPORTANT]
> If you encounter compatibility issues with `react-native-worklets`, pin it to `^0.5.1`:
>
> ```bash
> npx expo install react-native-worklets@0.5.1
> ```

Then install Aniview itself:

```bash
npm install aniview
```

### Configure Babel

Add the Reanimated plugin to your `babel.config.js`. **It must be listed last.**

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // ... other plugins
      "react-native-reanimated/plugin", // Must be last
    ],
  };
};
```

### Verified Dependency Versions

The following versions are tested and confirmed working together:

| Package                        | Version    |
| ------------------------------ | ---------- |
| `expo`                         | `~54.0.33` |
| `react`                        | `19.1.0`   |
| `react-native`                 | `0.81.5`   |
| `react-native-reanimated`      | `~4.1.1`   |
| `react-native-gesture-handler` | `~2.28.0`  |
| `react-native-worklets`        | `^0.5.1`   |

## Your First App

We'll build a **2×2 grid** — four pages you can swipe between, with a circle that changes style depending on which page the camera is on.

### Step 1: Define the Layout

```tsx
import { AniviewConfig } from "aniview";

const config = new AniviewConfig(
  [
    [1, 1], // Row 0: Home, Profile
    [1, 1], // Row 1: Settings, Gallery
  ],
  0, // Start at index 0
  {
    HOME: 0, // (0,0) — Top Left
    PROFILE: 1, // (0,1) — Top Right
    SETTINGS: 2, // (1,0) — Bottom Left
    GALLERY: 3, // (1,1) — Bottom Right
  },
);
```

### Step 2: Create Pages

Each page is an `Aniview` component. The `pageId` tells Aniview where it belongs in the world.

```tsx
import { Aniview } from "aniview";

function HomePage() {
  return (
    <Aniview
      pageId="HOME"
      style={[styles.page, { backgroundColor: "#E3F2FD" }]}
    >
      <Text style={styles.title}>Home</Text>
      <Text style={styles.sub}>Swipe left → Profile</Text>
      <Text style={styles.sub}>Swipe up → Settings</Text>
    </Aniview>
  );
}
```

### Step 3: Add a Morphing Component

Aniview components can define `frames` — style targets that activate when the camera reaches a specific page. The engine interpolates between them automatically.

```tsx
<Aniview
  pageId="HOME"
  style={{
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2196F3",
  }}
  frames={{
    atProfile: {
      page: "PROFILE",
      style: { backgroundColor: "#E91E63", transform: [{ scale: 1.5 }] },
    },
  }}
/>
```

When you swipe from Home to Profile, this circle smoothly scales up and turns pink — no imperative animation code needed.

### Step 4: Assemble the App

Wrap everything in `AniviewProvider` and `GestureHandlerRootView`:

```tsx
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AniviewProvider } from "aniview";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AniviewProvider config={config}>
        <View style={{ flex: 1 }}>
          <HomePage />
          <ProfilePage />
          <SettingsPage />
          <GalleryPage />
        </View>
      </AniviewProvider>
    </GestureHandlerRootView>
  );
}
```

Swiping works automatically — no gesture code required. For programmatic navigation, pass a `ref`:

```tsx
const ref = useRef<AniviewHandle>(null);

<AniviewProvider config={config} ref={ref}>
  ...
  <Button onPress={() => ref.current?.snapToPage("SETTINGS")} />
</AniviewProvider>;
```

### Complete Runnable Example

See [GettingStartedApp.tsx](../../aniview-example/GettingStartedApp.tsx) for a self-contained, runnable version of this tutorial. To try it, update your example app's `index.ts`:

```ts
import App from "./GettingStartedApp";
```

## Key Concepts

| Concept        | Description                                                                       |
| -------------- | --------------------------------------------------------------------------------- |
| **Layout**     | Defined in `AniviewConfig` as a 2D grid matrix                                    |
| **Pages**      | `Aniview` components with a `pageId`                                              |
| **Frames**     | Style targets for specific pages or events                                        |
| **Navigation** | Swipe works automatically; use `ref.snapToPage()` for buttons                     |
| **Events**     | Reanimated `SharedValues` passed to `AniviewProvider` that drive frame animations |

## Next Steps

- [Core Concepts](02-core-concepts.md) — Architecture and coordinate system
- [API Reference](03-api-reference.md) — Complete props and methods
- [Examples](05-examples.md) — Full 3×2 grid example app
