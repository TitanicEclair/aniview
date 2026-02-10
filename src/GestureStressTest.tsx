import * as React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { 
  GestureDetector, 
  Gesture,
} from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  runOnJS
} from 'react-native-reanimated';

import { useAniview } from './useAniview';

export default function GestureStressTest() {
  const { lock } = useAniview();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // LOGGING UTILITY
  const logGesture = (name: string, state: string, x?: number, y?: number) => {
    console.log(`[GESTURE: ${name}] State: ${state} | X: ${Math.round(x || 0)} Y: ${Math.round(y || 0)}`);
  };

  const panGesture = Gesture.Pan()
    .onStart((event: any) => {
      runOnJS(lock)(1); // 1 = Horizontal Lock
      runOnJS(logGesture)('PAN', 'START', event.x, event.y);
      opacity.value = 0.8;
    })
    .onUpdate((event: any) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event: any) => {
        runOnJS(lock)(0); // Unlock
        runOnJS(logGesture)('PAN', 'END', event.x, event.y);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        opacity.value = withSpring(1);
    });

  const tapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event: any) => {
      runOnJS(logGesture)('DOUBLE_TAP', 'END', event.x, event.y);
      scale.value = withSpring(1.5, {}, () => {
          scale.value = withSpring(1);
      });
    });

  const longPressGesture = Gesture.LongPress()
    .onEnd((event: any, success: boolean) => {
      if (success) {
        runOnJS(logGesture)('LONG_PRESS', 'SUCCESS', event.x, event.y);
        opacity.value = withSpring(0.3, {}, () => {
            opacity.value = withSpring(1);
        });
      }
    });

  const composed = Gesture.Simultaneous(panGesture, tapGesture, longPressGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ],
    opacity: opacity.value
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GESTURE ORCHESTRATION 2.0</Text>
      
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.box, animatedStyle]}>
          <Text style={styles.boxText}>PAN / DOUBLE-TAP / LONG-PRESS</Text>
          <Text style={styles.hint}>Testing Parallel Dispatch (Simultaneous)</Text>
        </Animated.View>
      </GestureDetector>

      <View style={styles.logIndicator}>
        <Text style={styles.logText}>Check Console for Orchestration Traces</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 20,
    opacity: 0.6,
  },
  box: {
    width: 300,
    height: 300,
    backgroundColor: '#1c1c1e',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#38383a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  boxText: {
    color: '#0a84ff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  hint: {
    color: '#8e8e93',
    marginTop: 10,
    fontSize: 12,
  },
  logIndicator: {
    marginTop: 30,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
  },
  logText: {
    color: '#636366',
    fontSize: 11,
  }
});
