/**
 * AniviewLock — Bitmask generation unit tests
 *
 * Enable/disable: ANIVIEW_TEST_LOCK=1 npm test
 * Or: npx jest --testPathPattern=AniviewLock
 */

import { AniviewLock } from '../core/AniviewLock';

describe('AniviewLock.mask', () => {
  test('empty object returns 0 (no locks)', () => {
    expect(AniviewLock.mask({})).toBe(0);
  });

  test('left = 1', () => {
    expect(AniviewLock.mask({ left: true })).toBe(1);
  });

  test('right = 2', () => {
    expect(AniviewLock.mask({ right: true })).toBe(2);
  });

  test('up = 4', () => {
    expect(AniviewLock.mask({ up: true })).toBe(4);
  });

  test('down = 8', () => {
    expect(AniviewLock.mask({ down: true })).toBe(8);
  });

  test('left + right = 3', () => {
    expect(AniviewLock.mask({ left: true, right: true })).toBe(3);
  });

  test('up + down = 12', () => {
    expect(AniviewLock.mask({ up: true, down: true })).toBe(12);
  });

  test('all directions = 15', () => {
    expect(AniviewLock.mask({ left: true, right: true, up: true, down: true })).toBe(15);
  });

  test('false values are ignored', () => {
    expect(AniviewLock.mask({ left: false, right: true })).toBe(2);
  });

  test('undefined values are ignored', () => {
    expect(AniviewLock.mask({ left: undefined, up: true })).toBe(4);
  });

  test('horizontal only (left + right) blocks horizontal axis', () => {
    const mask = AniviewLock.mask({ left: true, right: true });
    expect(mask & 1).toBeTruthy(); // left blocked
    expect(mask & 2).toBeTruthy(); // right blocked
    expect(mask & 4).toBeFalsy();  // up open
    expect(mask & 8).toBeFalsy();  // down open
  });
});
