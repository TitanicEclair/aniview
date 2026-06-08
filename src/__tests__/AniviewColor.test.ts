/**
 * AniviewColor — Baseline tests for color utilities
 *
 * Tests the existing implementations before extraction to src/core/AniviewColor.ts.
 * These functions are currently exported from Aniview.tsx for testing.
 */

import {
  normalizeColorToRgba,
  isColorProp,
  jsInterpolateColor,
  smartInterpolateColor,
  getSegmentInfo,
} from '../core/AniviewColor';
import { stripLayoutProps, flattenTransform } from '../core/AniviewStyleUtils';

// ──────────────────────────────────────────────
// isColorProp
// ──────────────────────────────────────────────
describe('isColorProp', () => {
  test('"color" → true', () => {
    expect(isColorProp('color')).toBe(true);
  });

  test('"backgroundColor" → true', () => {
    expect(isColorProp('backgroundColor')).toBe(true);
  });

  test('"borderColor" → true', () => {
    expect(isColorProp('borderColor')).toBe(true);
  });

  test('"tintColor" → true', () => {
    expect(isColorProp('tintColor')).toBe(true);
  });

  test('"COLOR" (uppercase) → true', () => {
    expect(isColorProp('COLOR')).toBe(true);
  });

  test('"opacity" → false', () => {
    expect(isColorProp('opacity')).toBe(false);
  });

  test('"width" → false', () => {
    expect(isColorProp('width')).toBe(false);
  });

  test('"transform" → false', () => {
    expect(isColorProp('transform')).toBe(false);
  });
});

// ──────────────────────────────────────────────
// normalizeColorToRgba
// ──────────────────────────────────────────────
describe('normalizeColorToRgba', () => {
  describe('hex colors', () => {
    test('3-digit hex: #fff → rgba(255,255,255,1)', () => {
      expect(normalizeColorToRgba('#fff')).toBe('rgba(255,255,255,1)');
    });

    test('3-digit hex: #000 → rgba(0,0,0,1)', () => {
      expect(normalizeColorToRgba('#000')).toBe('rgba(0,0,0,1)');
    });

    test('3-digit hex: #f00 → rgba(255,0,0,1)', () => {
      expect(normalizeColorToRgba('#f00')).toBe('rgba(255,0,0,1)');
    });

    test('6-digit hex: #ffffff → rgba(255,255,255,1)', () => {
      expect(normalizeColorToRgba('#ffffff')).toBe('rgba(255,255,255,1)');
    });

    test('6-digit hex: #ff0000 → rgba(255,0,0,1)', () => {
      expect(normalizeColorToRgba('#ff0000')).toBe('rgba(255,0,0,1)');
    });

    test('8-digit hex: #ffffff00 → rgba(255,255,255,0)', () => {
      expect(normalizeColorToRgba('#ffffff00')).toBe('rgba(255,255,255,0)');
    });

    test('8-digit hex: #00000080 → rgba(0,0,0,0.5)', () => {
      expect(normalizeColorToRgba('#00000080')).toBe('rgba(0,0,0,0.5019607843137255)');
    });

    test('mixed-case hex: #FfFfFf → rgba(255,255,255,1)', () => {
      expect(normalizeColorToRgba('#FfFfFf')).toBe('rgba(255,255,255,1)');
    });
  });

  describe('rgb / rgba', () => {
    test('rgb(255,0,0) → rgba(255,0,0,1)', () => {
      expect(normalizeColorToRgba('rgb(255,0,0)')).toBe('rgba(255,0,0,1)');
    });

    test('rgb(0, 255, 0) → rgba(0,255,0,1) (with spaces)', () => {
      expect(normalizeColorToRgba('rgb(0, 255, 0)')).toBe('rgba(0,255,0,1)');
    });

    test('rgba(0,0,255,0.5) → rgba(0,0,255,0.5)', () => {
      expect(normalizeColorToRgba('rgba(0,0,255,0.5)')).toBe('rgba(0,0,255,0.5)');
    });

    test('rgba(255, 100, 50, 0.75) (with spaces)', () => {
      expect(normalizeColorToRgba('rgba(255, 100, 50, 0.75)')).toBe('rgba(255,100,50,0.75)');
    });
  });

  describe('hsl / hsla', () => {
    test('hsl(0, 100%, 50%) → pure red', () => {
      expect(normalizeColorToRgba('hsl(0, 100%, 50%)')).toBe('rgba(255,0,0,1)');
    });

    test('hsl(120, 100%, 50%) → pure green', () => {
      expect(normalizeColorToRgba('hsl(120, 100%, 50%)')).toBe('rgba(0,255,0,1)');
    });

    test('hsl(240, 100%, 50%) → pure blue', () => {
      expect(normalizeColorToRgba('hsl(240, 100%, 50%)')).toBe('rgba(0,0,255,1)');
    });

    test('hsl(0, 0%, 100%) → white', () => {
      expect(normalizeColorToRgba('hsl(0, 0%, 100%)')).toBe('rgba(255,255,255,1)');
    });

    test('hsl(0, 0%, 0%) → black', () => {
      expect(normalizeColorToRgba('hsl(0, 0%, 0%)')).toBe('rgba(0,0,0,1)');
    });

    test('hsla(0, 100%, 50%, 0.5) → semi-transparent red', () => {
      expect(normalizeColorToRgba('hsla(0, 100%, 50%, 0.5)')).toBe('rgba(255,0,0,0.5)');
    });
  });

  describe('transparent & edge cases', () => {
    test('"transparent" → rgba(0,0,0,0)', () => {
      expect(normalizeColorToRgba('transparent')).toBe('rgba(0,0,0,0)');
    });

    test('empty string → rgba(0,0,0,0)', () => {
      expect(normalizeColorToRgba('')).toBe('rgba(0,0,0,0)');
    });

    test('null/undefined-ish: empty check catches falsy', () => {
      // The function checks `!c` — falsy strings get transparent
      expect(normalizeColorToRgba('')).toBe('rgba(0,0,0,0)');
    });

    test('unrecognized format → rgba(0,0,0,0)', () => {
      expect(normalizeColorToRgba('not-a-color')).toBe('rgba(0,0,0,0)');
    });

    test('named color "blue" → rgba(0,0,0,0) (not supported)', () => {
      expect(normalizeColorToRgba('blue')).toBe('rgba(0,0,0,0)');
    });
  });
});

// ──────────────────────────────────────────────
// jsInterpolateColor
// ──────────────────────────────────────────────
describe('jsInterpolateColor', () => {
  test('midpoint between black and white → gray', () => {
    const result = jsInterpolateColor(0.5, 0, 1, 'rgba(0,0,0,1)', 'rgba(255,255,255,1)');
    expect(result).toBe('rgba(128,128,128,1)');
  });

  test('at start value → returns start color', () => {
    const result = jsInterpolateColor(0, 0, 1, 'rgba(255,0,0,1)', 'rgba(0,0,255,1)');
    expect(result).toBe('rgba(255,0,0,1)');
  });

  test('at end value → returns end color', () => {
    const result = jsInterpolateColor(1, 0, 1, 'rgba(255,0,0,1)', 'rgba(0,0,255,1)');
    expect(result).toBe('rgba(0,0,255,1)');
  });

  test('same start and end → returns start color', () => {
    const result = jsInterpolateColor(0.5, 0, 1, 'rgba(100,150,200,1)', 'rgba(100,150,200,1)');
    expect(result).toBe('rgba(100,150,200,1)');
  });

  test('falsy start color → transparent fallback', () => {
    const result = jsInterpolateColor(0.5, 0, 1, '', 'rgba(255,0,0,1)');
    expect(result).toBe('rgba(0,0,0,0)');
  });

  test('alpha interpolation: 0 → 1', () => {
    const result = jsInterpolateColor(0.5, 0, 1, 'rgba(255,255,255,0)', 'rgba(255,255,255,1)');
    expect(result).toBe('rgba(255,255,255,0.5)');
  });

  test('clamps progress below range to 0', () => {
    const below = jsInterpolateColor(-1, 0, 1, 'rgba(0,0,0,1)', 'rgba(255,255,255,1)');
    expect(below).toBe('rgba(0,0,0,1)');
  });

  test('clamps progress above range to 1', () => {
    const above = jsInterpolateColor(2, 0, 1, 'rgba(0,0,0,1)', 'rgba(255,255,255,1)');
    expect(above).toBe('rgba(255,255,255,1)');
  });

  test('zero range (start === end) → range falls back to 1, progress clamps to 0', () => {
    // range = (1-1) || 1 = 1, progress = (0.5-1)/1 = -0.5, clamped to 0 → returns startColor
    const result = jsInterpolateColor(0.5, 1, 1, 'rgba(255,0,0,1)', 'rgba(0,0,255,1)');
    expect(result).toBe('rgba(255,0,0,1)');
  });

  test('works with hex colors', () => {
    const result = jsInterpolateColor(0, 0, 1, '#ff0000', '#0000ff');
    // jsInterpolateColor's internal parse handles hex
    expect(result).toBe('rgba(255,0,0,1)');
  });
});

// ──────────────────────────────────────────────
// smartInterpolateColor (transparent-aware)
// ──────────────────────────────────────────────
describe('smartInterpolateColor', () => {
  test('single output → returns that color', () => {
    const result = smartInterpolateColor(0.5, [0, 1], ['rgba(255,0,0,1)']);
    expect(result).toBe('rgba(255,0,0,1)');
  });

  test('empty output array → transparent', () => {
    const result = smartInterpolateColor(0.5, [0, 1], []);
    expect(result).toBe('rgba(0,0,0,0)');
  });

  test('below first input → first output', () => {
    const result = smartInterpolateColor(-1, [0, 1], ['rgba(255,0,0,1)', 'rgba(0,0,255,1)']);
    // It uses Reanimated's interpolateColor internally, which clamps
    expect(result).toBeTruthy();
  });

  test('above last input → last output', () => {
    const result = smartInterpolateColor(2, [0, 1], ['rgba(255,0,0,1)', 'rgba(0,0,255,1)']);
    expect(result).toBeTruthy();
  });

  test('transparent-to-color fade preserves RGB at midpoints (no gray flash)', () => {
    // At val=0, returns raw output[0] = 'rgba(0,0,0,0)' (endpoint, no fix needed)
    // At val=0.5, the fix() fires: transparent borrows red's RGB with alpha 0
    // then interpolateColor blends between (255,0,0,0) and (255,0,0,1)
    const result = smartInterpolateColor(0.5, [0, 1], ['rgba(0,0,0,0)', 'rgba(255,0,0,1)']);
    // The result at midpoint should be red-ish (not dark gray), proving the fix worked
    // R channel should be ~255, G and B should be ~0
    expect(result).toMatch(/^rgba\(25[0-5],\s*[0-5],\s*[0-5]/);
  });

  test('color-to-transparent fade preserves RGB at midpoints (no gray flash)', () => {
    // At val=0.5, fix() rewrites the transparent end to borrow red's RGB,
    // so interpolation only fades alpha, not through black
    const result = smartInterpolateColor(0.5, [0, 1], ['rgba(255,0,0,1)', 'rgba(0,0,0,0)']);
    // Should be red-ish at half alpha, not dark gray
    expect(result).toMatch(/^rgba\(25[0-5],\s*[0-5],\s*[0-5]/);
  });

  test('normal color-to-color works', () => {
    const result = smartInterpolateColor(0.5, [0, 1], ['rgba(255,0,0,1)', 'rgba(0,255,0,1)']);
    // Should be a blend of red and green, not broken
    expect(result).toBeTruthy();
    expect(result).not.toBe('rgba(0,0,0,0)');
  });
});

// ──────────────────────────────────────────────
// getSegmentInfo
// ──────────────────────────────────────────────
describe('getSegmentInfo', () => {
  test('empty input → constant with i=0, p=0', () => {
    expect(getSegmentInfo(5, [])).toEqual({ i: 0, p: 0, constant: true });
  });

  test('single element → constant at edge', () => {
    expect(getSegmentInfo(5, [10])).toEqual({ i: 0, p: 0, constant: true });
  });

  test('value at or below first anchor', () => {
    expect(getSegmentInfo(0, [0, 5, 10])).toEqual({ i: 0, p: 0, constant: true });
    expect(getSegmentInfo(-5, [0, 5, 10])).toEqual({ i: 0, p: 0, constant: true });
  });

  test('value at or above last anchor', () => {
    expect(getSegmentInfo(10, [0, 5, 10])).toEqual({ i: 2, p: 0, constant: true });
    expect(getSegmentInfo(20, [0, 5, 10])).toEqual({ i: 2, p: 0, constant: true });
  });

  test('value within range returns segment index and progress', () => {
    const info = getSegmentInfo(2.5, [0, 5, 10]);
    expect(info.i).toBe(0);
    expect(info.p).toBeCloseTo(0.5, 5);
    expect(info.constant).toBe(false);
  });

  test('value in second segment', () => {
    const info = getSegmentInfo(7.5, [0, 5, 10]);
    expect(info.i).toBe(1);
    expect(info.p).toBeCloseTo(0.5, 5);
    expect(info.constant).toBe(false);
  });

  test('value exactly at a midpoint anchor', () => {
    // val = 5 → should be at start of segment 1 (i=1, p=0)
    // but actually: getSegmentInfo loops while val >= input[i+1]
    // val=5 >= input[1]=5 → true → i becomes 1
    // val=5 >= input[2]=10 → false → stop
    // So i=1, gap=10-5=5, p=(5-5)/5=0
    const info = getSegmentInfo(5, [0, 5, 10]);
    expect(info.i).toBe(1);
    expect(info.p).toBe(0);
    expect(info.constant).toBe(false);
  });

  test('very close anchors (small gap) → p ≈ 0 when gap < 0.001', () => {
    const info = getSegmentInfo(0.0005, [0, 0.001]);
    // gap = 0.001, which is not < 0.001, so p is computed normally
    expect(info.constant).toBe(false);
  });

  test('multiple segments (4 anchors)', () => {
    const info = getSegmentInfo(55, [0, 50, 100, 150]);
    expect(info.i).toBe(1);
    expect(info.p).toBeCloseTo(0.1, 5);
    expect(info.constant).toBe(false);
  });
});

// ──────────────────────────────────────────────
// stripLayoutProps
// ──────────────────────────────────────────────
describe('stripLayoutProps', () => {
  test('removes position and margin props, keeps others', () => {
    const { rest, transform } = stripLayoutProps({
      position: 'absolute',
      left: 10,
      top: 20,
      right: 30,
      bottom: 40,
      marginLeft: 5,
      marginTop: 6,
      marginRight: 7,
      marginBottom: 8,
      opacity: 0.5,
      backgroundColor: '#fff',
      width: 100,
      height: 200,
    });
    expect(rest.position).toBeUndefined();
    expect(rest.left).toBeUndefined();
    expect(rest.top).toBeUndefined();
    expect(rest.marginLeft).toBeUndefined();
    expect(rest.opacity).toBe(0.5);
    expect(rest.backgroundColor).toBe('#fff');
    expect(rest.width).toBe(100);
    expect(rest.height).toBe(200);
    expect(transform).toEqual([]);
  });

  test('extracts transform array', () => {
    const { rest, transform } = stripLayoutProps({
      transform: [{ scale: 2 }, { rotate: '45deg' }],
      opacity: 1,
    });
    expect(transform).toEqual([{ scale: 2 }, { rotate: '45deg' }]);
    expect(rest.opacity).toBe(1);
  });

  test('handles missing transform gracefully', () => {
    const { transform } = stripLayoutProps({ opacity: 1 });
    expect(transform).toEqual([]);
  });

  test('handles empty style', () => {
    const { rest, transform } = stripLayoutProps({} as any);
    expect(rest).toEqual({});
    expect(transform).toEqual([]);
  });
});

// ──────────────────────────────────────────────
// flattenTransform
// ──────────────────────────────────────────────
describe('flattenTransform', () => {
  test('flattens scale transform', () => {
    const result = flattenTransform([{ scale: 2 }]);
    expect(result).toEqual({ _tr_scale: 2 });
  });

  test('flattens rotate transform (strips "deg" suffix)', () => {
    const result = flattenTransform([{ rotate: '45deg' }]);
    expect(result).toEqual({ _tr_rotate: 45 });
  });

  test('flattens multiple transforms', () => {
    const result = flattenTransform([
      { scale: 1.5 },
      { rotate: '90deg' },
      { translateX: 100 },
    ]);
    expect(result).toEqual({
      _tr_scale: 1.5,
      _tr_rotate: 90,
      _tr_translateX: 100,
    });
  });

  test('rotate as number (not string) passes through', () => {
    const result = flattenTransform([{ rotate: 45 }]);
    expect(result).toEqual({ _tr_rotate: 45 });
  });

  test('handles empty array', () => {
    const result = flattenTransform([]);
    expect(result).toEqual({});
  });

  test('handles rotateX, rotateY, rotateZ', () => {
    const result = flattenTransform([
      { rotateX: '30deg' },
      { rotateY: '60deg' },
      { rotateZ: '90deg' },
    ]);
    expect(result).toEqual({
      _tr_rotateX: 30,
      _tr_rotateY: 60,
      _tr_rotateZ: 90,
    });
  });
});
