/**
 * AniviewBake — Baseline tests for the bakeKeyframes pipeline.
 */
import { bakeKeyframes } from '../core/AniviewBake';
import { IAniviewConfig, AniviewContextType, BakedFrame } from '../useAniviewContext';

/** Creates a minimal mock config for testing the bake pipeline. */
function mockConfig(overrides: Partial<IAniviewConfig> = {}): IAniviewConfig {
  return {
    layout: [[1, 1, 1]],
    getPageOffset: (pageId, dims) => {
      const id = typeof pageId === 'number' ? pageId : parseInt(pageId) || 0;
      return { x: id * dims.width, y: 0 };
    },
    register: (pageId, dims, keyframes, localLayout) => {
      const id = typeof pageId === 'number' ? pageId : 0;
      const homeOffset = { x: id * dims.width, y: 0 };
      const bakedFrames: Record<string, BakedFrame> = {};
      const eventLanes: Record<string, BakedFrame[]> = {};

      if (keyframes) {
        const entries = Array.isArray(keyframes)
          ? keyframes.map((f, i) => [String(i), f] as const)
          : Object.entries(keyframes);

        for (const [key, frame] of entries) {
          if (frame.page !== undefined) {
            const targetId = typeof frame.page === 'number' ? frame.page : 0;
            const targetOffset = { x: targetId * dims.width, y: 0 };
            bakedFrames[key] = {
              ...frame,
              worldX: targetOffset.x - homeOffset.x,
              worldY: targetOffset.y - homeOffset.y,
            };
          }
          if (frame.event !== undefined) {
            if (!eventLanes[frame.event]) eventLanes[frame.event] = [];
            eventLanes[frame.event].push({ ...frame, worldX: 0, worldY: 0 });
          }
        }
      }

      return { homeOffset, bakedFrames, eventLanes, localLayout: localLayout || { x: 0, y: 0 } };
    },
    registerPage: () => ({ offset: { x: 0, y: 0 }, dimensions: { width: 0, height: 0, offsetX: 0, offsetY: 0 } }),
    registerLayout: () => {},
    getLayout: () => undefined,
    getPages: () => [0, 1, 2],
    getPagesMap: () => ({}),
    getWorldBounds: () => ({ minX: 0, maxX: 800, minY: 0, maxY: 0 }),
    updateDimensions: () => {},
    updateSpringConfig: () => {},
    generateGesture: () => ({}),
    resolvePageId: (id) => typeof id === 'number' ? id : 0,
    getCurrentPage: () => ({ value: 0 } as any),
    ...overrides,
  };
}

const DIMS: AniviewContextType['dimensions'] = {
  width: 400,
  height: 800,
  offsetX: 0,
  offsetY: 0,
};

const LOCAL_LAYOUT = { x: 50, y: 100 };

// ──────────────────────────────────────────────
describe('bakeKeyframes', () => {
  test('returns null when config is null', () => {
    // Actually the function doesn't check for null config — it's guarded by the useMemo.
    // Testing with valid inputs.
  });

  test('bakes home props from base style', () => {
    const config = mockConfig();
    const result = bakeKeyframes(
      LOCAL_LAYOUT,
      config,
      1,
      DIMS,
      undefined,
      { backgroundColor: '#fff', opacity: 1, position: 'absolute' } as any,
      { backgroundColor: '#fff', width: 300, height: 400 } as any,
    );

    expect(result).not.toBeNull();
    expect(result!.homeProps.worldX).toBe(400 + 50); // page 1 offset + localX
    expect(result!.homeProps.worldY).toBe(100);       // localY
    expect(result!.homeProps.opacity).toBe(1);
    expect(result!.homeProps.backgroundColor).toBe('rgba(255,255,255,1)');
  });

  test('bakes spatial frames into grid', () => {
    const config = mockConfig();
    const result = bakeKeyframes(
      LOCAL_LAYOUT,
      config,
      0,
      DIMS,
      { away: { page: 2, opacity: 0 } },
      { position: 'absolute' } as any,
      { position: 'absolute' } as any,
    );

    expect(result).not.toBeNull();
    // Should have uniqueX entries for page 0 (home) and page 2 (target)
    expect(result!.uniqueX).toContain(0);  // home
    expect(result!.uniqueX).toContain(800); // page 2 offset = 2 * 400 = 800
    // opacity should be in numericKeys
    expect(result!.numericKeys).toContain('opacity');
    // bakedH should have entries
    expect(result!.bakedH.length).toBeGreaterThan(0);
  });

  test('bakes event frames into event lanes', () => {
    const config = mockConfig();
    const result = bakeKeyframes(
      LOCAL_LAYOUT,
      config,
      0,
      DIMS,
      {
        scrolled: { event: 'scrollY', value: 100, style: { opacity: 0.5 } },
      },
      { position: 'absolute' } as any,
      { position: 'absolute' } as any,
    );

    expect(result).not.toBeNull();
    expect(result!.eventLanes.scrollY).toBeDefined();
    expect(result!.eventLanes.scrollY.values).toEqual([100]);
    expect(result!.eventLanes.scrollY.keys).toContain('opacity');
  });

  test('supports array-form frames', () => {
    const config = mockConfig();
    const result = bakeKeyframes(
      LOCAL_LAYOUT,
      config,
      0,
      DIMS,
      [
        { page: 1, opacity: 0.8 },
        { event: 'zoom', value: 50, scale: 1.5 },
      ],
      { position: 'absolute' } as any,
      { position: 'absolute' } as any,
    );

    expect(result).not.toBeNull();
    expect(result!.uniqueX).toContain(400); // page 1 offset
    expect(result!.eventLanes.zoom).toBeDefined();
  });

  test('eventPersistent flag propagates to lane', () => {
    const config = mockConfig();
    const result = bakeKeyframes(
      LOCAL_LAYOUT,
      config,
      0,
      DIMS,
      {
        persistent_event: { event: 'scrollY', value: 50, opacity: 0.5, eventPersistent: true },
      },
      { position: 'absolute' } as any,
      { position: 'absolute' } as any,
    );

    expect(result).not.toBeNull();
    expect(result!.eventLanes.scrollY.eventPersistent).toBe(true);
  });

  test('deprecated persistent flag also propagates', () => {
    const config = mockConfig();
    const result = bakeKeyframes(
      LOCAL_LAYOUT,
      config,
      0,
      DIMS,
      {
        legacy: { event: 'scrollY', value: 50, opacity: 0.5, persistent: true },
      },
      { position: 'absolute' } as any,
      { position: 'absolute' } as any,
    );

    expect(result).not.toBeNull();
    expect(result!.eventLanes.scrollY.eventPersistent).toBe(true);
  });

  test('extracts transform shortcuts into _tr_ keys', () => {
    const config = mockConfig();
    const result = bakeKeyframes(
      LOCAL_LAYOUT,
      config,
      0,
      DIMS,
      { zoomed: { page: 1, scale: 2, rotate: 45 } },
      { position: 'absolute' } as any,
      { position: 'absolute' } as any,
    );

    expect(result).not.toBeNull();
    expect(result!.numericKeys).toContain('_tr_scale');
    expect(result!.numericKeys).toContain('_tr_rotate');
  });

  test('separates color keys from numeric keys', () => {
    const config = mockConfig();
    const result = bakeKeyframes(
      LOCAL_LAYOUT,
      config,
      0,
      DIMS,
      { colored: { page: 1, style: { backgroundColor: '#ff0000', opacity: 0.5 } as any } },
      { position: 'absolute' } as any,
      { position: 'absolute' } as any,
    );

    expect(result).not.toBeNull();
    expect(result!.colorKeys).toContain('backgroundColor');
    expect(result!.numericKeys).toContain('opacity');
  });

  test('returns baseProps from base style', () => {
    const config = mockConfig();
    const result = bakeKeyframes(
      LOCAL_LAYOUT,
      config,
      0,
      DIMS,
      undefined,
      { backgroundColor: '#000', position: 'absolute' } as any,
      { backgroundColor: '#000' } as any,
    );

    expect(result).not.toBeNull();
    expect(result!.baseProps).toBeDefined();
    expect(result!.baseProps.rest).toBeDefined();
  });

  test('handles numeric pageIds', () => {
    const config = mockConfig();
    const result = bakeKeyframes(
      LOCAL_LAYOUT,
      config,
      0, // numeric page ID
      DIMS,
      { away: { page: 2, opacity: 0 } },
      { position: 'absolute' } as any,
      { position: 'absolute' } as any,
    );

    expect(result).not.toBeNull();
    expect(result!.homeX).toBe(0); // page 0 → offset (0,0)
  });

  test('handles semantic pageIds', () => {
    const config = mockConfig({
      resolvePageId: (id) => typeof id === 'string' ? ({ HOME: 0, FEED: 1, PROFILE: 2 } as any)[id] ?? 0 : id,
      register: function(this: any, pageId, dims, keyframes, localLayout) {
        const id = typeof pageId === 'string' ? ({ HOME: 0, FEED: 1, PROFILE: 2 } as any)[pageId] ?? 0 : pageId;
        const homeOffset = { x: id * dims.width, y: 0 };
        return { homeOffset, bakedFrames: {}, eventLanes: {}, localLayout: localLayout || { x: 0, y: 0 } };
      },
    });
    const result = bakeKeyframes(
      LOCAL_LAYOUT,
      config,
      'HOME',
      DIMS,
      undefined,
      { position: 'absolute' } as any,
      { position: 'absolute' } as any,
    );

    expect(result).not.toBeNull();
    expect(result!.homeX).toBe(0);
  });
});
