---
id: examples
slug: /examples
title: Examples & Recipes
---

# Examples & Recipes

This guide walks through the **Aniview Example App** — a 3×2 spatial grid that demonstrates every major feature.

## Grid Layout

```
Row 0:  [ Page0 ]  [ Page1 ]  [ Page2 ]
Row 1:  [ Page3 ]  [ Page4 ]  [ Page5 ]
```

Pages use a cohesive pastel palette (blues → cyans → oranges → pinks) so transitions feel smooth.

## Full Code (`App.tsx`)

```tsx
import React, { useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  AniviewConfig,
  AniviewProvider,
  Aniview,
  AniviewHandle,
} from "aniview";
import { useSharedValue, withSpring } from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

// 3x2 Grid
// Row 0: [Page0, Page1, Page2]
// Row 1: [Page3, Page4, Page5]
const config = new AniviewConfig(
  [
    [1, 1, 1],
    [1, 1, 1],
  ],
  0,
  {
    Page0: 0,
    Page1: 1,
    Page2: 2,
    Page3: 3,
    Page4: 4,
    Page5: 5,
  },
);

// --- Reusable Pieces ---

function InfoCard({ lines }: { lines: string[] }) {
  return (
    <View style={styles.infoCard}>
      {lines.map((l, i) => (
        <Text key={i} style={i === 0 ? styles.cardTitle : styles.cardSub}>
          {l}
        </Text>
      ))}
    </View>
  );
}

function RandomDot({
  label,
  persistent,
}: {
  label: string;
  persistent: boolean;
}) {
  const color = useRef(`hsl(${Math.random() * 360}, 70%, 55%)`).current;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.tinyLabel}>{label}</Text>
      <Text style={[styles.tinyLabel, { fontSize: 8 }]}>
        {persistent ? "(Persists)" : "(Resets)"}
      </Text>
    </View>
  );
}

// --- Pages ---

function Page0() {
  return (
    <Aniview
      pageId="Page0"
      style={[styles.page, { backgroundColor: "#E3F2FD" }]}
    >
      <Text style={styles.watermark}>Page 0</Text>
      <InfoCard
        lines={["Top Left", "Swipe Left → Page 1", "Swipe Up → Page 3"]}
      />
    </Aniview>
  );
}

function Page1() {
  return (
    <Aniview
      pageId="Page1"
      style={[styles.page, { backgroundColor: "#E1F5FE" }]}
    >
      <Text style={styles.watermark}>Page 1</Text>
      <InfoCard
        lines={["Top Center", "Swipe Left → Page 2", "Swipe Right → Page 0"]}
      />
    </Aniview>
  );
}

function Page2() {
  return (
    <Aniview
      pageId="Page2"
      style={[styles.page, { backgroundColor: "#E0F7FA" }]}
    >
      <Text style={styles.watermark}>Page 2</Text>
      <InfoCard
        lines={[
          "Top Right",
          "Swipe Down → Page 5",
          "Watch the component morph!",
        ]}
      />
    </Aniview>
  );
}

function Page3({ zoomEvent }: { zoomEvent: any }) {
  const zoomed = useRef(false);
  const toggleZoom = () => {
    zoomed.current = !zoomed.current;
    zoomEvent.value = withSpring(zoomed.current ? 1 : 0);
  };

  const frames = {
    zoomed: {
      event: "zoom",
      value: 0.5,
      style: { transform: [{ scale: 1.5 }] },
      persistent: true,
    },
  };

  return (
    <>
      <Aniview
        pageId="Page3"
        style={[styles.page, { backgroundColor: "#FFF3E0" }]}
      >
        <Text style={styles.watermark}>Page 3</Text>
        <InfoCard
          lines={["Bottom Left", "Swipe Right → Page 0", "Swipe Left → Page 4"]}
        />

        <TouchableOpacity onPress={toggleZoom} style={styles.actionBtn}>
          <Text style={styles.actionText}>Toggle Zoom Event</Text>
        </TouchableOpacity>

        <View style={styles.zoomNote}>
          <Text style={styles.tinyLabel}>
            The "Resets" dot re-mounts with a new color after virtualization.
          </Text>
          <Text style={styles.tinyLabel}>
            The "Persists" dot stays mounted (persistent=true) even when this
            page unmounts.
          </Text>
          <Text style={[styles.tinyLabel, { color: "#1565C0", marginTop: 4 }]}>
            Zoom resets when swiping away. To keep zoom on adjacent pages, copy
            the zoomed frame style into their frames too.
          </Text>
        </View>
      </Aniview>

      {/* Non-persistent: color changes on revisit */}
      <Aniview
        pageId="Page3"
        style={[styles.dotSlot, { left: width / 2 - 80 }]}
        frames={frames}
      >
        <RandomDot label="State" persistent={false} />
      </Aniview>

      {/* Persistent: survives virtualization */}
      <Aniview
        pageId="Page3"
        style={[styles.dotSlot, { left: width / 2 + 30 }]}
        frames={frames}
        persistent={true}
      >
        <RandomDot label="State" persistent={true} />
      </Aniview>
    </>
  );
}

function Page4() {
  return (
    <Aniview
      pageId="Page4"
      style={[styles.page, { backgroundColor: "#FBE9E7" }]}
    >
      <Text style={styles.watermark}>Page 4</Text>
      <InfoCard
        lines={["Bottom Center", "Swipe Left → Page 5", "Swipe Right → Page 3"]}
      />
    </Aniview>
  );
}

function Page5() {
  return (
    <Aniview
      pageId="Page5"
      style={[styles.page, { backgroundColor: "#FCE4EC" }]}
    >
      <Text style={styles.watermark}>Page 5</Text>
      <InfoCard
        lines={["Bottom Right", "Swipe Up → Page 2", "Swipe Right → Page 4"]}
      />
    </Aniview>
  );
}

// --- Traveler ---
// Persistent component that morphs across ALL 6 pages.
// Demonstrates: color, size, rotation, border, shadow, opacity changes.
function Traveler() {
  return (
    <Aniview
      pageId="Page0"
      style={styles.traveler}
      pointerEvents="none"
      persistent={true}
      frames={{
        onPage1: {
          page: "Page1",
          style: {
            transform: [{ translateX: width - 110 }, { scale: 1.3 }],
            backgroundColor: "#E91E63",
            borderRadius: 8,
            borderWidth: 3,
            borderColor: "#C2185B",
            shadowRadius: 12,
            shadowOpacity: 0.6,
          },
        },
        onPage2: {
          page: "Page2",
          style: {
            transform: [
              { translateX: 80 },
              { translateY: 200 },
              { rotate: "45deg" },
            ],
            backgroundColor: "#9C27B0",
            width: 70,
            height: 70,
            borderRadius: 12,
            opacity: 0.85,
            shadowColor: "#9C27B0",
            shadowRadius: 20,
            shadowOpacity: 0.5,
          },
        },
        onPage3: {
          page: "Page3",
          style: {
            transform: [
              { translateY: 300 },
              { rotate: "-15deg" },
              { scale: 0.8 },
            ],
            backgroundColor: "#4CAF50",
            borderRadius: 25,
            borderWidth: 2,
            borderColor: "#fff",
            shadowRadius: 8,
            shadowOpacity: 0.4,
          },
        },
        onPage4: {
          page: "Page4",
          style: {
            transform: [
              { translateX: width / 2 - 25 },
              { translateY: 400 },
              { scale: 1.4 },
            ],
            backgroundColor: "#FF5722",
            width: 60,
            height: 60,
            borderRadius: 30,
            opacity: 0.7,
            borderWidth: 4,
            borderColor: "#FFCCBC",
          },
        },
        onPage5: {
          page: "Page5",
          style: {
            transform: [
              { translateX: width - 100 },
              { translateY: 250 },
              { rotate: "90deg" },
              { scale: 0.6 },
            ],
            backgroundColor: "#607D8B",
            borderRadius: 0,
            width: 80,
            height: 80,
            shadowColor: "#263238",
            shadowRadius: 15,
            shadowOpacity: 0.7,
          },
        },
      }}
    />
  );
}

// --- ResponsiveBox ---
// On Page 2 (top-right): wide horizontal header bar with row-flex content.
// On Page 5 (bottom-right): tall vertical card with column-flex content.
// Demonstrates how the same children reflow when the container morphs.
function ResponsiveBox() {
  return (
    <Aniview
      pageId="Page2"
      style={{
        position: "absolute",
        top: 120,
        width: width,
        height: 90,
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 16,
        padding: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
        flexDirection: "row",
        alignItems: "center",
      }}
      frames={{
        toPage5: {
          page: "Page5",
          style: {
            top: 120,
            width: 200,
            height: 260,
            backgroundColor: "#fff",
            borderRadius: 24,
            shadowOpacity: 0.2,
            shadowRadius: 16,
          },
        },
      }}
    >
      {/* Avatar circle */}
      <View style={styles.boxAvatar} />

      {/* Text block */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: "bold", color: "#311B92" }}>
          Responsive
        </Text>
        <Text style={{ fontSize: 11, color: "#7E57C2" }}>
          Layout morphs per page
        </Text>
      </View>

      {/* Static text (shows crowding when narrower) */}
      <View style={styles.boxStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Static</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>text</Text>
        </View>
      </View>
    </Aniview>
  );
}

// --- App ---

export default function App() {
  const aniviewRef = useRef<AniviewHandle>(null);
  const zoom = useSharedValue(0);
  const [menuOpen, setMenuOpen] = React.useState(true);

  const nav = (page: string) => {
    aniviewRef.current?.snapToPage(page);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AniviewProvider config={config} ref={aniviewRef} events={{ zoom }}>
        <View style={styles.container}>
          <Page0 />
          <Page1 />
          <Page2 />
          <Page3 zoomEvent={zoom} />
          <Page4 />
          <Page5 />

          <Traveler />
          <ResponsiveBox />

          {/* HUD */}
          <View style={styles.hud}>
            {!menuOpen ? (
              <TouchableOpacity onPress={() => setMenuOpen(true)}>
                <Text style={styles.menuIcon}>☰</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.menuBody}>
                <View style={styles.menuHeader}>
                  <Text style={styles.hudTitle}>Grid</Text>
                  <TouchableOpacity onPress={() => setMenuOpen(false)}>
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.gridNav}>
                  {["Page0", "Page1", "Page2", "Page3", "Page4", "Page5"].map(
                    (p, i) => (
                      <TouchableOpacity
                        key={p}
                        style={styles.gridBtn}
                        onPress={() => nav(p)}
                      >
                        <Text style={styles.btnText}>{i}</Text>
                      </TouchableOpacity>
                    ),
                  )}
                </View>
              </View>
            )}
          </View>
        </View>
      </AniviewProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  page: {
    width,
    height,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
  },
  watermark: {
    fontSize: 48,
    fontWeight: "900",
    color: "rgba(0,0,0,0.07)",
    position: "absolute",
    top: 50,
  },

  // InfoCard
  infoCard: {
    backgroundColor: "rgba(255,255,255,0.55)",
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 6,
  },
  cardSub: { fontSize: 13, color: "#555", textAlign: "center", lineHeight: 19 },

  // Traveler
  traveler: {
    position: "absolute",
    left: 30,
    top: 130,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF9800",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },

  // Dots (zoom demo)
  dotSlot: {
    position: "absolute",
    top: 200,
    width: 50,
    alignItems: "center",
    transformOrigin: "center top", // Scale from top edge so dots don't drift upward
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  tinyLabel: { fontSize: 10, color: "#555", textAlign: "center" },
  zoomNote: {
    position: "absolute",
    bottom: 200,
    left: 30,
    right: 30,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 10,
    padding: 12,
  },
  actionBtn: {
    marginTop: 20,
    backgroundColor: "#1976D2",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  actionText: { color: "#fff", fontWeight: "bold", fontSize: 13 },

  // ResponsiveBox inner
  boxAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#673AB7",
  },
  boxStats: {
    flexDirection: "row",
    gap: 10,
  },
  statItem: { alignItems: "center" },
  statLabel: { fontSize: 12, color: "#999" },

  // HUD
  hud: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#222",
    borderRadius: 16,
    elevation: 20,
    minWidth: 48,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  menuIcon: { color: "#fff", fontSize: 22 },
  menuBody: { padding: 14, width: 180 },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  hudTitle: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  closeText: { color: "#888", fontSize: 16 },
  gridNav: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridBtn: {
    width: "30%",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 10,
    marginBottom: 6,
    borderRadius: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
});
```

---

## Feature Breakdown

### 1. The Traveler (Cross-Page Morphing)

The `Traveler` component is anchored at **Page 0** but defines a unique visual state for every page in the grid. As you swipe, Aniview interpolates between these states.

| Page | Color       | Shape                     | Additional                            |
| ---- | ----------- | ------------------------- | ------------------------------------- |
| 0    | Orange      | Circle (25r)              | Default shadow                        |
| 1    | Pink        | Rounded square (8r)       | Thick border, stronger shadow         |
| 2    | Purple      | Rotated square (12r, 45°) | Enlarged, translucent                 |
| 3    | Green       | Circle (25r)              | White border, tilted -15°             |
| 4    | Deep Orange | Circle (30r)              | Semi-transparent, thick pastel border |
| 5    | Blue Grey   | Sharp square (0r)         | Rotated 90°, small, heavy shadow      |

> [!IMPORTANT]
> The Traveler uses `persistent={true}` so it stays mounted even when far from its anchor page. Without this, it would unmount and disappear when more than 1.5 screens away.

### 2. The ResponsiveBox (Layout Morphing)

Demonstrates how a single component can change its **dimensions and layout** between pages.

- **Page 2 (Top Right)**: Full-width horizontal bar (`width: width`, `height: 90`). Children are laid out in a `flexDirection: 'row'` — avatar, text, and labels sit side-by-side.
- **Page 5 (Bottom Right)**: Narrowed card (`width: 200`, `height: 260`). The same children get squeezed into a smaller horizontal space, demonstrating how the flex layout adapts when the container shrinks on one axis and grows on the other.

This pattern is useful for responsive headers, collapsible panels, or dashboard cards that adapt to their context.

### 3. Virtualization & Persistence (Page 3)

Page 3 demonstrates the difference between default and persistent components:

- **"Resets" dot** (left): Uses default virtualization. When you navigate far away (>1.5 screens), this component unmounts. On return, `RandomDot` re-mounts and `useRef(Math.random())` generates a **new** color.
- **"Persists" dot** (right): Uses `persistent={true}`. The component stays mounted regardless of distance, preserving its original color.

### 4. Zoom Event & Persistent Event Frames

The "Toggle Zoom" button on Page 3 drives a shared `zoom` event that scales both dots. The frame's `value: 0.5` means the dots reach full scale (1.5×) when the event is only halfway to 1, giving the animation a snappier feel.

> [!NOTE]
> **Toggle pattern**: The zoom toggle uses a `useRef(false)` to track the intended on/off state rather than reading the animated `SharedValue` mid-spring. Reading `sharedValue.value` during a spring animation returns a fractional intermediate, making `=== 0` checks unreliable. The ref ensures instant, deterministic toggling regardless of animation progress.

#### `persistent: true` on Event Frames

The zoom frame uses `persistent: true`. This is **different** from `persistent={true}` on an `<Aniview>` component — they control separate things:

| Persistent                                | What it controls       | Effect                                                                                                             |
| ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `persistent: true` on a **frame**         | Event lane **weight**  | Event effect stays at full strength regardless of camera distance from the home page (bypasses presence-weighting) |
| `persistent={true}` on an **`<Aniview>`** | Component **mounting** | Component stays in the React tree even when far from the camera (bypasses virtualization)                          |

These two are **independent**. If you want an event effect to work across all pages, you need **both**:

1. `persistent: true` on the event frame — so the effect isn't faded out by presence
2. `persistent={true}` on the `<Aniview>` component — so the component itself isn't unmounted

Without both, a persistent event frame on a non-persistent component would still unmount when far away, losing the event effect entirely.

In the Page 3 example, the "Persists" dot has both: `persistent: true` on the zoom frame **and** `persistent={true}` on its `<Aniview>`, so it stays zoomed even on distant pages. The "Resets" dot only has `persistent: true` on the frame — its component still unmounts when far away.

### 5. Transform Origin

The `dotSlot` style uses `transformOrigin: 'center top'` to ensure that scale transforms expand the dots downward rather than drifting them upward. By default, React Native scales from the element's center, which causes top-positioned elements to visually shift when scaled.

### 6. Navigation HUD

The bottom-right HUD provides a 3×2 grid of buttons matching the page layout. The menu:

- **Stays open** after tapping a page (no auto-close) for easier testing.
- Can be dismissed with the ✕ button and reopened with ☰.
