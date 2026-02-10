
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
};
module.exports = Reanimated;
