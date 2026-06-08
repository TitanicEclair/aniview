/**
 * AniviewStyleUtils — Pure style normalization helpers.
 *
 * These operate on React Native style objects during the bake phase
 * (JS thread only) and are consumed by both the component shell and
 * the bake pipeline.
 */

import { StyleSheet, ViewStyle } from 'react-native';

/**
 * Splits a style object into non-layout props and transform entries.
 *
 * Layout-mapping props (positioning and margins used by world mapping) are
 * removed so they are not applied twice during final style composition.
 *
 * @param style - The style object to normalize.
 * @returns An object containing the remaining style props and normalized transform array.
 */
export function stripLayoutProps(style: ViewStyle) {
  const flattened = StyleSheet.flatten(style) || {};
  const {
    transform, position, left, top, right, bottom,
    marginLeft, marginTop, marginRight, marginBottom,
    ...rest
  } = flattened;
  return { rest, transform: Array.isArray(transform) ? transform : [] };
}

/**
 * Flattens a React Native transform array into key/value pairs.
 *
 * Transform keys are namespaced with `_tr_` so they can be treated like
 * standard interpolated properties during baking and composition.
 *
 * @param transform - React Native transform array.
 * @returns Flattened transform property map.
 */
export function flattenTransform(transform: any[]) {
  const props: any = {};
  transform.forEach(t => {
    const key = Object.keys(t)[0];
    let val = t[key];
    // Handle rotation strings
    if (typeof val === 'string' && val.endsWith('deg')) val = parseFloat(val);
    props[`_tr_${key}`] = val;
  });
  return props;
}
