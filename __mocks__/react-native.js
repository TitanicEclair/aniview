
const React = require('react');
const View = (props) => React.createElement('View', props);
const Text = (props) => React.createElement('Text', props);
const Image = (props) => React.createElement('Image', props);
const ScrollView = (props) => React.createElement('ScrollView', props);

const Animated = {
    Value: jest.fn(() => ({ 
        setValue: jest.fn(), 
        interpolate: jest.fn(() => ({})),
    })),
    View: View,
    Text: Text,
    Image: Image,
    ScrollView: ScrollView,
    createAnimatedComponent: (c) => c,
    timing: () => ({ start: (cb) => cb && cb() }),
};

module.exports = {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet: {
      create: (styles) => styles,
      flatten: (styles) => styles,
      absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  },
  Platform: {
      OS: 'ios',
      select: (objs) => objs.ios,
      isPad: false,
      isTV: false
  },
  Dimensions: {
      get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
  },
  Animated,
  requireNativeComponent: jest.fn(() => View),
  DeviceEventEmitter: {
      addListener: jest.fn(),
      removeListener: jest.fn(), 
  }
};
