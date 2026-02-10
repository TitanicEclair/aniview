import { useContext } from 'react';
import { AniviewContext } from './useAniviewContext';
import { AniviewLock, AniviewAxisLock } from './core/AniviewLock';

export { AniviewLock };
export type { AniviewAxisLock };

/**
 * Hook to lock/unlock Aniview swipe gestures from within a child component.
 * Provides a clean API for disabling specific directions.
 * 
 * Usage:
 * const { lockDirections } = useAniviewLock();
 * lockDirections({ left: true }); // Prevent swiping left
 */
export function useAniviewLock() {
    const context = useContext(AniviewContext);

    const lockDirections = (directions: AniviewAxisLock) => {
        if (context) {
            context.lock(AniviewLock.mask(directions));
        }
    };

    const unlock = () => {
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
