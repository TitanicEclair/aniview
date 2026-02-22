/**
 * Valid directions for locking Aniview gestures.
 */
export type AniviewAxisLock = {
    left?: boolean;
    right?: boolean;
    up?: boolean;
    down?: boolean;
}

/**
 * Utility to generate Aniview lock bitmasks.
 */
export const AniviewLock = {
    /**
     * Converts directional lock flags into bitmask representation.
     *
     * Bits: left=1, right=2, up=4, down=8.
     *
     * @param directions - Direction flags to encode.
     * @returns Numeric lock mask.
     */
    mask: (directions: AniviewAxisLock) => {
        let mask = 0;
        if (directions.left) mask |= 1;
        if (directions.right) mask |= 2;
        if (directions.up) mask |= 4;
        if (directions.down) mask |= 8;
        return mask;
    }
};
