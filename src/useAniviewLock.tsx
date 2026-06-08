import { useContext } from 'react';
import { AniviewContext } from './useAniviewContext';
import { AniviewLock, AniviewAxisLock } from './core/AniviewLock';

export { AniviewLock };
export type { AniviewAxisLock };

/**
 * Provides directional gesture locking controls for the nearest Aniview context.
 *
 * @returns Lock helpers, movement state, and `AniviewLock` bitmask utility.
 */
export function useAniviewLock() {
    const context = useContext(AniviewContext);

    /**
     * Applies a directional lock bitmask to the provider gesture.
     *
     * @param directions - Direction flags to lock.
     * @returns void
     */
    const lockDirections = (directions: AniviewAxisLock) => {
        'worklet';
        if (context) {
            context.lock(AniviewLock.mask(directions));
        }
    };

    /**
     * Clears all active directional locks.
     *
     * @returns void
     */
    const unlock = () => {
        'worklet';
        if (context) {
            context.lock(0);
        }
    };

    return {
        lockDirections,
        unlock,
        isMoving: context?.isMoving,
        AniviewLock // Export helper as well
    };
}
