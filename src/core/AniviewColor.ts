/**
 * AniviewColor — Color parsing, normalization, and interpolation utilities.
 *
 * All functions are marked `'worklet'` so they can execute on both the JS
 * thread (during the bake phase) and the Reanimated UI thread (during
 * per-frame style interpolation).
 */
import { interpolateColor } from 'react-native-reanimated';

/**
 * Parses a color string into RGBA numeric channels `[r, g, b, a]`.
 *
 * This is the single shared parser used by both {@link normalizeColorToRgba}
 * (JS-thread) and {@link jsInterpolateColor} (worklet), eliminating the
 * previous duplication of the hex/hsl parsing logic.
 *
 * Supports hex (`#fff`, `#ffffff`, `#ffffff80`), rgb/rgba, hsl/hsla, and
 * `transparent`. Unrecognized input falls back to `[0, 0, 0, 0]`.
 *
 * @param c - Input color string.
 * @returns RGBA channel array.
 */
function parseColorToChannels(c: string): [number, number, number, number] {
  'worklet';
  if (!c || c === 'transparent') return [0, 0, 0, 0];
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
        1,
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    ];
  }
  const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    return [
      parseInt(match[1]),
      parseInt(match[2]),
      parseInt(match[3]),
      match[4] ? parseFloat(match[4]) : 1,
    ];
  }

  const hMatch = c.match(
    /hsla?\((\d+),\s*([\d.]+)%?,\s*([\d.]+)%?(?:,\s*([\d.]+))?\)/
  );
  if (hMatch) {
    const h = parseInt(hMatch[1]),
      s = parseFloat(hMatch[2]) / 100,
      l = parseFloat(hMatch[3]) / 100,
      a = hMatch[4] ? parseFloat(hMatch[4]) : 1;
    const k = (n: number) => (n + h / 30) % 12;
    const arc = s * Math.min(l, 1 - l);
    const f = (n: number) =>
      l - arc * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4)), a];
  }
  return [0, 0, 0, 0];
}

/**
 * Normalizes supported color strings into `rgba(r,g,b,a)` format.
 *
 * Supports hex, rgb/rgba, hsl/hsla, and `transparent`. Unsupported input
 * falls back to `rgba(0,0,0,0)`.
 *
 * @param c - Input color string.
 * @returns Normalized rgba color string.
 */
export function normalizeColorToRgba(c: string): string {
  'worklet';
  const [r, g, b, a] = parseColorToChannels(c);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Determines whether a style property key represents a color value and
 * should use color-aware interpolation.
 *
 * @param k - Style property key.
 * @returns `true` when the key represents a color value.
 */
export function isColorProp(k: string): boolean {
  'worklet';
  return k.toLowerCase().includes('color') || k === 'tintColor';
}

/**
 * Linearly interpolates between two colors. Worklet-safe.
 *
 * Uses the shared {@link parseColorToChannels} to parse both colors,
 * then performs per-channel linear interpolation.
 *
 * @param val - Driver value.
 * @param start - Start input value.
 * @param end - End input value.
 * @param startColor - Start color (any supported format).
 * @param endColor - End color (any supported format).
 * @returns Interpolated rgba color string.
 */
export function jsInterpolateColor(
  val: number,
  start: number,
  end: number,
  startColor: string,
  endColor: string
) {
  'worklet';
  if (!startColor || !endColor || startColor === endColor) {
    return startColor || 'rgba(0,0,0,0)';
  }
  const range = end - start || 1;
  const progress = Math.max(0, Math.min(1, (val - start) / range));

  const s = parseColorToChannels(startColor);
  const e = parseColorToChannels(endColor);
  const r = Math.round(s[0] + (e[0] - s[0]) * progress);
  const g = Math.round(s[1] + (e[1] - s[1]) * progress);
  const b = Math.round(s[2] + (e[2] - s[2]) * progress);
  const a = s[3] + (e[3] - s[3]) * progress;
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Interpolates colors while preserving RGB during transparent fades.
 *
 * When transitioning to/from `rgba(0,0,0,0)` (transparent), this avoids
 * dark/gray artifacts by borrowing the non-transparent color's RGB channels
 * and only fading alpha.
 *
 * @param val - Driver value.
 * @param input - Input range (sorted ascending).
 * @param output - Output color range.
 * @returns Interpolated color string.
 */
export function smartInterpolateColor(
  val: number,
  input: number[],
  output: string[]
) {
  'worklet';
  if (output.length === 0) return 'rgba(0,0,0,0)';
  if (output.length === 1) return output[0];

  // Bounds check — return raw endpoint (fix not needed at exact edges)
  if (val <= input[0]) return output[0];
  if (val >= input[input.length - 1]) return output[output.length - 1];

  // Find segment
  let i = 0;
  while (i < input.length - 2 && val >= input[i + 1]) {
    i++;
  }

  // Safety check
  if (input[i + 1] === undefined) return output[output.length - 1];

  const c1 = output[i];
  const c2 = output[i + 1];

  /**
   * Rewrites a transparent color to borrow the source color's RGB with alpha 0.
   *
   * @param transp - Candidate transparent color.
   * @param source - Source color to borrow RGB from.
   * @returns RGBA string suitable for smooth alpha-only interpolation.
   */
  const fix = (transp: string, source: string) => {
    'worklet';
    if (transp !== 'rgba(0,0,0,0)') return transp;
    if (!source || !source.startsWith('rgba')) return transp;

    const lastComma = source.lastIndexOf(',');
    if (lastComma === -1) return transp;
    // Construct: source RGB + alpha 0
    return source.substring(0, lastComma + 1) + '0)';
  };

  const useC1 = fix(c1, c2);
  const useC2 = fix(c2, c1);

  return interpolateColor(val, [input[i], input[i + 1]], [useC1, useC2]);
}

/**
 * Computes interpolation segment metadata for a monotonic input axis.
 *
 * This allows segment lookup once per frame with O(log n) linear scan and
 * reuse across many properties via the returned segment index and progress.
 *
 * @param val - Current axis value.
 * @param input - Sorted axis anchors.
 * @returns Segment index, progress (0–1), and a `constant` flag indicating
 *          whether the value is clamped to a single anchor.
 */
export function getSegmentInfo(val: number, input: number[]) {
  'worklet';
  const len = input.length;
  if (len === 0) return { i: 0, p: 0, constant: true };
  if (len === 1 || val <= input[0]) return { i: 0, p: 0, constant: true };
  if (val >= input[len - 1]) return { i: len - 1, p: 0, constant: true };

  let i = 0;
  while (i < len - 1 && val >= input[i + 1]) {
    i++;
  }
  const gap = input[i + 1] - input[i];
  const p = gap > 0.001 ? (val - input[i]) / gap : 0;
  return { i, p, constant: false };
}
