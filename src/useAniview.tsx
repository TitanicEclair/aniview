import * as React from 'react';
import { useContext } from 'react';
import { AniviewContext, AniviewProps, AniviewLogic, AniviewContextType } from "./useAniviewContext";

/**
 * **useAniview** — Access the Aniview world context
 *
 * This hook has two overloads:
 *
 * **1. Context-only** (`useAniview()`) — Returns the raw {@link AniviewContextType}
 * containing the camera SharedValues, config, dimensions, and gesture state.
 * Use this when you need to read the camera position or react to page changes
 * without being an animated component yourself.
 *
 * **2. Per-component** (`useAniview(props)`) — Used internally by `Aniview`
 * components. Registers the component's `pageId` with the config engine and
 * returns an {@link AniviewLogic} object containing the resolved registration,
 * activation value, and keyframes. You rarely need this overload directly.
 *
 * @returns When called without arguments: `{ dimensions, events, config, activationMap, panGesture, visiblePages, isMoving }`
 * @returns When called with props: `AniviewLogic` with additional `registration`, `activationValue`, and `keyframes`
 *
 * @throws Error if called outside of an `<AniviewProvider />`
 *
 * @example
 * ```tsx
 * // Read camera position from any child
 * function CameraDebug() {
 *   const { events } = useAniview();
 *   // events.x.value, events.y.value are the camera world coordinates
 * }
 *
 * // React to custom events
 * function ScrollReactor() {
 *   const { events } = useAniview();
 *   // events.scrollY?.value (if parent passed events={{ scrollY }})
 * }
 * ```
 */
export function useAniview(): AniviewContextType;
export function useAniview(props: AniviewProps): AniviewLogic;
export function useAniview(props?: AniviewProps): AniviewContextType | AniviewLogic {
  const context = useContext(AniviewContext);
  if (!context) {
    throw new Error('Aniview components must be wrapped in an <AniviewProvider />');
  }

  // If no props provided, just return the raw context
  if (!props || typeof props !== 'object') return context;

  const pageId = props.pageId;

  const registration = context.config ? context.config.registerPage(pageId, context.dimensions) : {
    offset: { x: 0, y: 0 },
    dimensions: context.dimensions
  };

  const activationValue = (context.activationMap && pageId !== undefined) ? (context.activationMap as any)[pageId] : null;

  const logic: AniviewLogic = {
    dimensions: context.dimensions,
    events: context.events,
    activationMap: context.activationMap,
    panGesture: context.panGesture,
    config: context.config,
    registration: registration as any,
    activationValue: activationValue as any,
    keyframes: props.frames as any,
    lock: context.lock,
    visiblePages: context.visiblePages,
    isMoving: context.isMoving,
  };

  return logic;
}
