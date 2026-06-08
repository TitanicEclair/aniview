import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { LayoutChangeEvent, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS
} from 'react-native-reanimated';
import { AniviewProps, BakedResult } from './useAniviewContext';
import { useAniview } from './useAniview';
import { bakeKeyframes } from './core/AniviewBake';
import { computeAnimatedStyle } from './core/AniviewStyle';

/**
 * **Aniview** — Absolute World Coordinate Animation Engine Component
 *
 * The core animated view that interpolates its style properties based on
 * the camera's position in a virtual 2D world coordinate system. Each
 * `Aniview` belongs to a specific `pageId` (its "home page") and defines
 * `frames` — keyframes that describe how the component should look when
 * the camera is at a different page or when a custom event reaches a
 * certain value.
 *
 * ### How it works (the "Baking" pipeline)
 *
 * 1. On mount (or when `frames`/`style`/`dimensions` change), Aniview
 *    runs a one-time **bake** on the JS thread. This pre-computes a
 *    lookup grid of style values indexed by world coordinates.
 * 2. On every frame, `useAnimatedStyle` reads the camera SharedValues
 *    (`events.x`, `events.y`) and performs O(1) segment lookups +
 *    linear/color interpolation — no searching, no string parsing.
 * 3. The baked data also powers **native virtualization**: components
 *    farther than 1.5× screen width from the camera are hidden via
 *    `opacity: 0`, keeping the render tree lightweight.
 *
 * ### Key design choices
 *
 * - **Absolute positioning**: All Aniview children are rendered with
 *   `position: 'absolute'` and placed via `translateX`/`translateY`
 *   relative to the camera. This decouples layout from animation.
 * - **Smart color interpolation**: When transitioning to/from
 *   `transparent`, the RGB of the non-transparent color is preserved
 *   to avoid grey flash artifacts.
 * - **Selective unmounting**: Non-persistent components unmount when
 *   offscreen (after snapping completes) to reclaim memory. Set
 *   `persistent={true}` for 3D/GL content that must stay mounted.
 *
 * @param props Standard `ViewProps` plus:
 * @param props.pageId - The page this component belongs to (numeric index or semantic name from `pageMap`)
 * @param props.frames - Keyframe definitions. Object keys are frame names, values are {@link AniviewFrame}
 * @param props.persistent - If `true`, stays mounted even when far offscreen. Required for WebGL/Three.js canvases. Default: `false`
 * @param props.style - Base styles applied when at home position. Numeric and color props here become the interpolation baseline.
 * @param props.pointerEvents - Standard RN pointer events. Useful for overlay pages that shouldn't block touches.
 * @returns Animated view that interpolates styles from spatial and event lanes.
 *
 * @example
 * ```tsx
 * <Aniview
 *   pageId="HOME"
 *   style={{ width: '100%', height: '100%', backgroundColor: '#fff' }}
 *   frames={{
 *     away: { page: 'SETTINGS', opacity: 0 },
 *     scrolled: { event: 'scrollY', value: 100, style: { transform: [{ translateY: -50 }] } },
 *   }}
 * >
 *   <HomeContent />
 * </Aniview>
 * ```
 *
 * @see {@link AniviewProvider} for setting up the coordinate system
 * @see {@link AniviewConfig} for layout and gesture configuration
 * @see {@link useAniview} for accessing context from child components
 */
export default function Aniview(props: AniviewProps) {
  const { style, children, pageId, frames, ...rest } = props;

  const context = useAniview(props);
  const { events, config, dimensions, isMoving } = context;

  const persistent = props.persistent ?? false;
  const [shouldRender, setShouldRender] = useState(true);

  // Pre-calculate home page offset on the JS thread to avoid UI thread class calls.
  const homeOffset = useMemo(() => {
    if (!config || !dimensions.width || !dimensions.height) return { x: 0, y: 0 };
    const homeId = config.resolvePageId(pageId);
    return config.getPageOffset(homeId, dimensions);
  }, [config, pageId, dimensions.width, dimensions.height]);
  const homeX = homeOffset.x;
  const homeY = homeOffset.y;

  // SELECTIVE UNMOUNTING: If not persistent, monitor visibility natively.
  useAnimatedReaction(
    () => {
      if (persistent || !isMoving || isMoving.value) return null;
      const cameraX = events.x.value;
      const cameraY = events.y.value;
      const isFarX = Math.abs(cameraX - homeX) > dimensions.width * 1.5;
      const isFarY = Math.abs(cameraY - homeY) > dimensions.height * 1.5;
      const isFar = isFarX || isFarY;
      return isFar;
    },
    (isFar) => {
      if (isFar === null) return null;
      if (isFar && shouldRender) runOnJS(setShouldRender)(false);
      if (!isFar && !shouldRender) runOnJS(setShouldRender)(true);
    },
    [persistent, dimensions.width, dimensions.height, homeX, homeY, shouldRender, isMoving]
  );

  const hasNoDims = dimensions.width <= 0 || dimensions.height <= 0;
  const cached = useMemo(() => config?.getLayout(pageId.toString()), [config, pageId]);
  const [localLayout, setLocalLayout] = useState<{ x: number; y: number } | null>(cached || null);

  useEffect(() => {
    if (localLayout && !cached) {
      config?.registerLayout(pageId.toString(), localLayout);
    }
  }, [localLayout, cached, config, pageId]);

  // FIX: Sync localLayout with controlled style changes
  useEffect(() => {
    const flat = StyleSheet.flatten(style || {}) as ViewStyle;
    const x = (flat.left as number) ?? (flat.marginLeft as number) ?? 0;
    const y = (flat.top as number) ?? (flat.marginTop as number) ?? 0;

    if (!localLayout || Math.abs(localLayout.x - x) > 0.1 || Math.abs(localLayout.y - y) > 0.1) {
      setLocalLayout({ x, y });
    }
  }, [style, localLayout]);

  /**
   * Captures local layout origin for world composition and cache hydration.
   *
   * @param e - Native layout event from the root animated view.
   * @returns void
   */
  const onLayout = useCallback((e: any) => {
    let { x, y, width, height } = e.nativeEvent.layout;
    const flattened = StyleSheet.flatten(props.style || {}) as ViewStyle;
    if (x === 0 && typeof flattened?.marginLeft === 'number') x = flattened.marginLeft;
    if (y === 0 && typeof flattened?.marginTop === 'number') y = flattened.marginTop;

    if (!localLayout || Math.abs(localLayout.x - x) > 1 || Math.abs(localLayout.y - y) > 1) {
      if (width > 0 || height > 0) {
        setLocalLayout({ x, y });
      }
    }
  }, [localLayout, props.style]);


  const baseStyle = useMemo(() => {
    const flattened = StyleSheet.flatten(style as any) || {};
    return { ...flattened, position: 'absolute' } as ViewStyle;
  }, [style]);

  // --- THE BAKE ---
  const baked = useMemo((): BakedResult | null => {
    if (!localLayout || !config) return null;
    return bakeKeyframes(localLayout, config, pageId, dimensions, frames, baseStyle, style);
  }, [localLayout, config, pageId, frames, style, baseStyle, dimensions.offsetX, dimensions.offsetY, dimensions.width, dimensions.height]);

  const cameraX_SV = (events as any)?.x;
  const cameraY_SV = (events as any)?.y;

  const isSingleRowVal = config.layout?.length === 1;

  const animatedStyle = useAnimatedStyle(() => {
    if (!baked || !cameraX_SV || !cameraY_SV || !config) return { opacity: 0 };
    return computeAnimatedStyle(
      baked,
      cameraX_SV,
      cameraY_SV,
      events,
      config,
      dimensions,
      isSingleRowVal,
    );
  }, [baked, dimensions.width, dimensions.height, cameraX_SV, cameraY_SV, events]);

  // Final safety: If no layout yet, show placeholder at opacity 0
  if (!localLayout || hasNoDims) {
    return (
      <Animated.View
        onLayout={onLayout}
        style={[
          baseStyle,
          {
            opacity: 0,
            width: baseStyle.width ?? dimensions.width,
            height: baseStyle.height ?? dimensions.height
          }
        ]}
        pointerEvents="none"
      >
        {children}
      </Animated.View>
    );
  }

  if (!shouldRender && !persistent) return null;

  return (
    <Animated.View style={animatedStyle as any} {...rest}>
      {children}
    </Animated.View>
  );
}
