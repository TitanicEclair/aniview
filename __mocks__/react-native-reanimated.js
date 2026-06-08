
/**
 * Parses a color to RGBA channels (simplified for mock environment).
 * Supports hex, rgb/rgba strings. Falls back to [0,0,0,0].
 */
function parseColor(c) {
  if (!c || c === 'transparent') return [0, 0, 0, 0];
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    if (hex.length === 3) return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), 1];
    if (hex.length === 8) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), parseInt(hex.slice(6, 8), 16) / 255];
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 1];
  }
  const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), match[4] ? parseFloat(match[4]) : 1];
  return [0, 0, 0, 0];
}

const Reanimated = {
  default: { call: () => {} },
  makeMutable: (init) => ({ value: init, modify: (cb) => { init = cb(init); return { value: init }; } }),
  useSharedValue: (init) => ({ value: init, modify: (cb) => { init = cb(init); return { value: init }; } }),
  runOnJS: (fn) => fn,
  withSpring: (toValue, config, callback) => {
      if (callback) callback(true);
      return toValue;
  },
  withTiming: (toValue, config, callback) => {
      if (callback) callback(true);
      return toValue;
  },
  cancelAnimation: () => {},
  SharedValue: jest.fn(),
  useAnimatedStyle: (cb) => cb(),
  useAnimatedProps: (cb) => cb(),
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  interpolate: (value, inputRange, outputRange, extrapolate) => {
    if (value <= inputRange[0]) return outputRange[0];
    if (value >= inputRange[inputRange.length - 1]) return outputRange[outputRange.length - 1];
    let i = 0;
    while (i < inputRange.length - 2 && value >= inputRange[i + 1]) i++;
    const gap = inputRange[i + 1] - inputRange[i];
    const p = gap > 0.001 ? (value - inputRange[i]) / gap : 0;
    return outputRange[i] + p * (outputRange[i + 1] - outputRange[i]);
  },
  interpolateColor: (value, inputRange, outputRange) => {
    if (value <= inputRange[0]) return outputRange[0];
    if (value >= inputRange[inputRange.length - 1]) return outputRange[outputRange.length - 1];
    let i = 0;
    while (i < inputRange.length - 2 && value >= inputRange[i + 1]) i++;
    const gap = inputRange[i + 1] - inputRange[i];
    const p = gap > 0.001 ? (value - inputRange[i]) / gap : 0;
    const s = parseColor(outputRange[i]), e = parseColor(outputRange[i + 1]);
    const r = Math.round(s[0] + (e[0] - s[0]) * p);
    const g = Math.round(s[1] + (e[1] - s[1]) * p);
    const b = Math.round(s[2] + (e[2] - s[2]) * p);
    const a = s[3] + (e[3] - s[3]) * p;
    return `rgba(${r},${g},${b},${a})`;
  },
};
module.exports = Reanimated;
