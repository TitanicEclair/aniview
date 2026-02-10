
const createGestureMock = () => {
    const handler = {
      get: (target, prop) => {
        if (prop === 'bind') return () => target;
        if (typeof prop === 'string' && prop !== 'then') {
          return () => new Proxy(() => {}, handler);
        }
        return Reflect.get(target, prop);
      }
    };
    return new Proxy(() => {}, handler);
};
  
module.exports = {
      Gesture: {
          Pan: () => createGestureMock(),
          Tap: () => createGestureMock(),
          Fling: () => createGestureMock(),
          LongPress: () => createGestureMock(),
          Pinch: () => createGestureMock(),
          Rotation: () => createGestureMock(),
          Native: () => createGestureMock(),
          Manual: () => createGestureMock(),
          Race: () => createGestureMock(),
          Simultaneous: () => createGestureMock(),
          Exclusive: () => createGestureMock(),
      },
      GestureDetector: ({ children }) => children,
      GestureHandlerRootView: ({ children }) => children,
      State: {},
      Directions: {}
};
