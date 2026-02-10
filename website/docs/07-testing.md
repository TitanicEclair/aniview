# Testing Guide

## Overview

Testing Aniview components requires understanding how they interact with Reanimated's worklet environment and gesture handlers.

---

## Test Setup

### Installing Test Dependencies

```bash
npm install --save-dev jest @testing-library/react-native react-test-renderer
```

### Jest Configuration

Add to your `jest.config.js`:

```javascript
module.exports = {
  preset: "react-native",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|react-native-reanimated|react-native-gesture-handler|aniview)/)",
  ],
};
```

### Mocking Reanimated

Create `jest.setup.js`:

```javascript
// Mock Reanimated
jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");

  Reanimated.default.call = () => {};

  return {
    ...Reanimated,
    useSharedValue: (init) => ({ value: init }),
    useAnimatedStyle: (fn) => fn(),
    useDerivedValue: (fn) => ({ value: fn() }),
    withSpring: (to) => to,
    withTiming: (to) => to,
    interpolate: (value, input, output) => {
      // Simple linear interpolation for tests
      if (value <= input[0]) return output[0];
      if (value >= input[input.length - 1]) return output[output.length - 1];

      for (let i = 0; i < input.length - 1; i++) {
        if (value >= input[i] && value <= input[i + 1]) {
          const progress = (value - input[i]) / (input[i + 1] - input[i]);
          return output[i] + progress * (output[i + 1] - output[i]);
        }
      }
      return output[0];
    },
    interpolateColor: (value, input, output) => {
      // Return first or last color based on value
      if (value <= input[0]) return output[0];
      if (value >= input[input.length - 1]) return output[output.length - 1];
      // For intermediate values, return first color (simplification)
      return output[0];
    },
  };
});

// Mock Gesture Handler
jest.mock("react-native-gesture-handler", () => {
  const View = require("react-native").View;
  return {
    GestureDetector: View,
    GestureHandlerRootView: View,
    Gesture: {
      Pan: () => ({
        onBegin: () => {},
        onUpdate: () => {},
        onEnd: () => {},
        simultaneousWithExternalGesture: () => ({}),
      }),
    },
  };
});
```

---

## Unit Testing

### Testing AniviewConfig

```typescript
import { AniviewConfig } from "aniview";

describe("AniviewConfig", () => {
  const dims = { width: 430, height: 932, offsetX: 0, offsetY: 0 };

  it("should create config with grid layout", () => {
    const config = new AniviewConfig([[1, 1, 1]], 0, {
      HOME: 0,
      PROFILE: 1,
      SETTINGS: 2,
    });

    expect(config.getPages()).toEqual([0, 1, 2]);
    expect(config.resolvePageId("HOME")).toBe(0);
  });

  it("should calculate page offsets correctly", () => {
    const config = new AniviewConfig([[1, 1]], 0);

    const offset0 = config.getPageOffset(0, dims);
    const offset1 = config.getPageOffset(1, dims);

    expect(offset0).toEqual({ x: 0, y: 0 });
    expect(offset1).toEqual({ x: 430, y: 0 });
  });

  it("should calculate world bounds", () => {
    const config = new AniviewConfig(
      [
        [1, 1],
        [1, 1],
      ],
      0,
    );

    const bounds = config.getWorldBounds(dims);

    expect(bounds.minX).toBe(0);
    expect(bounds.maxX).toBe(430);
    expect(bounds.minY).toBe(0);
    expect(bounds.maxY).toBe(932);
  });
});
```

### Testing Frame Registration

```typescript
import { AniviewConfig } from "aniview";

describe("Frame Registration", () => {
  const config = new AniviewConfig([[1, 1]], 0, { HOME: 0, AWAY: 1 });
  const dims = { width: 430, height: 932, offsetX: 0, offsetY: 0 };

  it("should bake spatial frames", () => {
    const result = config.register(
      "HOME",
      dims,
      {
        awayFrame: {
          page: "AWAY",
          style: { opacity: 0 },
        },
      },
      { x: 0, y: 0 },
    );

    expect(result.bakedFrames.awayFrame).toBeDefined();
    expect(result.bakedFrames.awayFrame.worldX).toBe(430); // Offset of AWAY page
    expect(result.bakedFrames.awayFrame.worldY).toBe(0);
  });

  it("should separate event frames", () => {
    const result = config.register("HOME", dims, {
      scrollFrame: {
        event: "scrollY",
        value: 100,
        style: { opacity: 0.5 },
      },
    });

    expect(result.eventLanes.scrollY).toBeDefined();
    expect(result.eventLanes.scrollY[0].value).toBe(100);
  });
});
```

---

## Integration Testing

### Testing Aniview Components

```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { AniviewProvider, Aniview, AniviewConfig } from 'aniview';

const config = new AniviewConfig([[1, 1]], 0, { HOME: 0, AWAY: 1 });
const dims = { width: 430, height: 932, offsetX: 0, offsetY: 0 };

describe('Aniview Component', () => {
  it('should render children', () => {
    const { getByText } = render(
      <AniviewProvider config={config} dimensions={dims}>
        <Aniview pageId="HOME">
          <Text>Test Content</Text>
        </Aniview>
      </AniviewProvider>
    );

    expect(getByText('Test Content')).toBeTruthy();
  });

  it('should apply base styles', () => {
    const { UNSAFE_getByType } = render(
      <AniviewProvider config={config} dimensions={dims}>
        <Aniview
          pageId="HOME"
          style={{ backgroundColor: 'red', width: 100 }}
        >
          <Text>Test</Text>
        </Aniview>
      </AniviewProvider>
    );

    const animatedView = UNSAFE_getByType('Animated.View');
    expect(animatedView.props.style).toMatchObject({
      backgroundColor: 'red',
      width: 100
    });
  });
});
```

### Snapshot Testing

```typescript
import renderer from 'react-test-renderer';

describe('Aniview Snapshots', () => {
  it('should match snapshot', () => {
    const tree = renderer.create(
      <AniviewProvider config={config} dimensions={dims}>
        <Aniview
          pageId="HOME"
          style={{ width: 100, height: 100 }}
          frames={{
            away: { page: 'AWAY', opacity: 0 }
          }}
        >
          <Text>Content</Text>
        </Aniview>
      </AniviewProvider>
    ).toJSON();

    expect(tree).toMatchSnapshot();
  });
});
```

---

## Testing Animations

### Mock Camera Position

```typescript
describe('Animation Behavior', () => {
  it('should interpolate opacity based on camera position', async () => {
    const eventsMock = {
      x: { value: 0 },
      y: { value: 0 }
    };

    let tree;
    await renderer.act(async () => {
      tree = renderer.create(
        <AniviewProvider
          config={config}
          dimensions={dims}
          events={eventsMock}
        >
          <Aniview
            pageId="HOME"
            style={{ opacity: 1 }}
            frames={{
              away: { page: 'AWAY', opacity: 0 }
            }}
          >
            <Text>Test</Text>
          </Aniview>
        </AniviewProvider>
      );
    });

    // Camera at HOME
    eventsMock.x.value = 0;
    const atHome = tree.root.findByType('Animated.View');
    expect(atHome.props.style.opacity).toBe(1);

    // Camera halfway to AWAY
    eventsMock.x.value = 215;
    // Re-render would show opacity ≈ 0.5

    // Camera at AWAY
    eventsMock.x.value = 430;
    // Re-render would show opacity ≈ 0
  });
});
```

### Testing Event-Driven Animations

```typescript
describe('Event Animations', () => {
  it('should respond to custom events', () => {
    const scrollY = { value: 0 };

    const { rerender } = render(
      <AniviewProvider
        config={config}
        dimensions={dims}
        events={{ scrollY }}
      >
        <Aniview
          pageId="HOME"
          frames={{
            scrolled: {
              event: 'scrollY',
              value: 100,
              style: { opacity: 0.5 }
            }
          }}
        >
          <Text>Test</Text>
        </Aniview>
      </AniviewProvider>
    );

    // Simulate scroll
    scrollY.value = 100;
    rerender(); // Trigger re-render

    // Opacity should change (mocked interpolation)
  });
});
```

---

## Testing Gestures

### Simulating Pan Gestures

```typescript
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

describe('Gesture Navigation', () => {
  it('should navigate on swipe', () => {
    const onPageChange = jest.fn();

    const { getByTestId } = render(
      <AniviewProvider
        config={config}
        onPageChange={onPageChange}
      >
        <View testID="gesture-container">
          <Aniview pageId="HOME">
            <Text>Home</Text>
          </Aniview>
        </View>
      </AniviewProvider>
    );

    const container = getByTestId('gesture-container');

    // Simulate swipe left
    fireGestureHandler(container, [
      { state: State.BEGAN },
      { state: State.ACTIVE, translationX: -200 },
      { state: State.END, velocityX: -500 }
    ]);

    expect(onPageChange).toHaveBeenCalledWith(1); // Navigated to page 1
  });
});
```

---

## E2E Testing (Detox Example)

### Setup

```javascript
// e2e/firstTest.e2e.js
describe("Aniview Navigation", () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it("should swipe between pages", async () => {
    await expect(element(by.text("Page 1"))).toBeVisible();

    // Swipe left
    await element(by.id("aniview-container")).swipe("left");

    await expect(element(by.text("Page 2"))).toBeVisible();
  });

  it("should navigate via button", async () => {
    await element(by.id("goto-settings")).tap();
    await expect(element(by.text("Settings Page"))).toBeVisible();
  });
});
```

---

## Testing Best Practices

### 1. Test Behavior, Not Implementation

```typescript
// ❌ Don't test internal bake structure
expect(baked.bakedH[0].values).toBeDefined();

// ✅ Test observable behavior
expect(component.props.style.opacity).toBe(0);
```

### 2. Use Integration Tests for Animations

```typescript
// Unit test: Config logic
describe('AniviewConfig', () => { ... });

// Integration test: Full animation flow
describe('Page Transition', () => {
  it('should fade out when navigating away', () => { ... });
});
```

### 3. Mock Minimally

Only mock what's necessary:

- ✅ Reanimated (unavoidable in Jest)
- ✅ Gesture Handler (unavoidable in Jest)
- ❌ Aniview internals (test the real thing)

### 4. Test Edge Cases

```typescript
it("should handle transparent colors correctly", () => {
  const result = config.register("HOME", dims, {
    frame: {
      page: "AWAY",
      style: { backgroundColor: "transparent" },
    },
  });

  // Should normalize to rgba(0,0,0,0)
  expect(result.bakedFrames.frame.style.backgroundColor).toMatch(
    /rgba\(0,0,0,0\)/,
  );
});
```

### 5. Test Cleanup

```typescript
describe('Memory Cleanup', () => {
  it('should release resources on unmount', () => {
    const { unmount } = render(<AniviewProvider>...</AniviewProvider>);

    unmount();

    // Assert no listeners remain, etc.
  });
});
```

---

## Debugging Failed Tests

### Enable Verbose Logging

```typescript
// In test file:
beforeEach(() => {
  global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };
});

afterEach(() => {
  if (global.console.error.mock.calls.length > 0) {
    console.error("Errors during test:", global.console.error.mock.calls);
  }
});
```

### Inspect Render Tree

```typescript
it('should render correctly', () => {
  const tree = renderer.create(<MyComponent />);
  console.log(JSON.stringify(tree.toJSON(), null, 2));
  // Inspect structure
});
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: "18"
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v2
```

---

## Next Steps

- Review [Performance Guide](06-performance.md) for optimization
- Learn about [Gesture Control](08-gesture-control.md) for complex interactions
- Check out [Contributing Guidelines](../CONTRIBUTING.md) to help improve Aniview
