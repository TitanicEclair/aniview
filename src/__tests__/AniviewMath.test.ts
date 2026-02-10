/**
 * AniviewMath — Pure function unit tests
 *
 * Enable/disable: ANIVIEW_TEST_MATH=1 npm test
 * Or: npx jest --testPathPattern=AniviewMath
 */
import {
  pageIdToMatrixPos,
  calculateAxisOffset,
  getPageOffset,
  getWorldBounds,
} from '../core/AniviewMath';

// ──────────────────────────────────────────────
// pageIdToMatrixPos
// ──────────────────────────────────────────────
describe('pageIdToMatrixPos', () => {
  const ROW_3  = [[1, 1, 1]];         // 1 row, 3 cols
  const GRID_2x2 = [[1, 1], [1, 1]];  // 2 rows, 2 cols
  const SINGLE  = [[1]];              // 1 page

  test('maps ID 0 to (0,0) in a 1×3 layout', () => {
    expect(pageIdToMatrixPos(0, ROW_3)).toEqual({ r: 0, c: 0 });
  });

  test('maps ID 2 to (0,2) in a 1×3 layout', () => {
    expect(pageIdToMatrixPos(2, ROW_3)).toEqual({ r: 0, c: 2 });
  });

  test('maps ID 3 to (1,0) in a 2×2 layout', () => {
    expect(pageIdToMatrixPos(3, GRID_2x2)).toEqual({ r: 1, c: 1 });
  });

  test('maps ID 2 to (1,0) in a 2×2 layout', () => {
    expect(pageIdToMatrixPos(2, GRID_2x2)).toEqual({ r: 1, c: 0 });
  });

  test('handles single-page layout', () => {
    expect(pageIdToMatrixPos(0, SINGLE)).toEqual({ r: 0, c: 0 });
  });

  test('returns sentinel for negative ID', () => {
    expect(pageIdToMatrixPos(-1, ROW_3)).toEqual({ r: 9999, c: 9999 });
  });

  test('returns sentinel for out-of-bounds ID', () => {
    expect(pageIdToMatrixPos(5, ROW_3)).toEqual({ r: 9999, c: 9999 });
  });

  test('returns sentinel for ID exactly past max', () => {
    // 1×3 layout → max valid ID is 2
    expect(pageIdToMatrixPos(3, ROW_3)).toEqual({ r: 9999, c: 9999 });
  });
});


// ──────────────────────────────────────────────
// calculateAxisOffset
// ──────────────────────────────────────────────
describe('calculateAxisOffset', () => {
  const W = 400; // page width/height

  test('returns 0 when from === to', () => {
    expect(calculateAxisOffset(0, 0, W, [])).toBe(0);
  });

  test('returns screenWidth for 1 step with no overlap', () => {
    expect(calculateAxisOffset(0, 1, W, [0])).toBe(W);
  });

  test('returns half screenWidth when overlap is 0.5', () => {
    expect(calculateAxisOffset(0, 1, W, [0.5])).toBe(W * 0.5);
  });

  test('returns negative offset for reverse direction', () => {
    expect(calculateAxisOffset(1, 0, W, [0])).toBe(-W);
  });

  test('accumulates correctly over 3 steps with no overlap', () => {
    expect(calculateAxisOffset(0, 3, W, [0, 0, 0])).toBe(W * 3);
  });

  test('accumulates with mixed overlaps (layout)', () => {
    // uses cols: [0.5, 0.4] for 3 columns
    // Step 0→1: W * (1 - 0.5) = 200
    // Step 1→2: W * (1 - 0.4) = 240
    // Total: 440
    expect(calculateAxisOffset(0, 2, W, [0.5, 0.4])).toBe(440);
  });

  test('handles missing overlaps (treated as 0)', () => {
    // Only 1 overlap value but crossing 2 gaps
    // Step 0→1: W * (1 - 0.3) = 280
    // Step 1→2: W * (1 - 0) = 400 (missing overlap → 0)
    expect(calculateAxisOffset(0, 2, W, [0.3])).toBe(680);
  });

  test('single step with full overlap (1.0) returns 0', () => {
    expect(calculateAxisOffset(0, 1, W, [1.0])).toBe(0);
  });
});


// ──────────────────────────────────────────────
// getPageOffset
// ──────────────────────────────────────────────
describe('getPageOffset', () => {
  const DIMS = { width: 400, height: 800 };

  test('origin page returns (0, 0)', () => {
    const layout = [[1, 1, 1]];
    expect(getPageOffset(1, layout, DIMS, 1, [], [0, 0])).toEqual({ x: 0, y: 0 });
  });

  test('adjacent page with no overlap returns (screenWidth, 0)', () => {
    const layout = [[1, 1]];
    expect(getPageOffset(1, layout, DIMS, 0, [], [0])).toEqual({ x: 400, y: 0 });
  });

  test('page below origin returns (0, screenHeight)', () => {
    const layout = [[1], [1]];
    expect(getPageOffset(1, layout, DIMS, 0, [0], [])).toEqual({ x: 0, y: 800 });
  });

  test('page to left of origin returns negative x', () => {
    const layout = [[1, 1, 1]];
    expect(getPageOffset(0, layout, DIMS, 1, [], [0, 0])).toEqual({ x: -400, y: 0 });
  });

  test('layout: CANVAS from ROOM (overlap 0.5)', () => {
    // Layout: [[1,1,1]], origin = 1 (ROOM), cols overlap = [0.5, 0.4]
    const layout = [[1, 1, 1]];
    const offset = getPageOffset(0, layout, DIMS, 1, [], [0.5, 0.4]);
    // CANVAS (col 0) to ROOM (col 1): -W * (1 - 0.5) = -200
    expect(offset).toEqual({ x: -200, y: 0 });
  });

  test('layout: DRAWERS from ROOM (overlap 0.4)', () => {
    const layout = [[1, 1, 1]];
    const offset = getPageOffset(2, layout, DIMS, 1, [], [0.5, 0.4]);
    // DRAWERS (col 2) to ROOM (col 1): W * (1 - 0.4) = 240
    expect(offset).toEqual({ x: 240, y: 0 });
  });

  test('2×2 grid: diagonal page offset', () => {
    const layout = [[1, 1], [1, 1]];
    // Page 3 is (1,1), origin 0 is (0,0)
    const offset = getPageOffset(3, layout, DIMS, 0, [0], [0]);
    expect(offset).toEqual({ x: 400, y: 800 });
  });
});


// ──────────────────────────────────────────────
// getWorldBounds
// ──────────────────────────────────────────────
describe('getWorldBounds', () => {
  const DIMS = { width: 400, height: 800 };

  test('single page returns all zeros', () => {
    const bounds = getWorldBounds([0], [[1]], DIMS, 0, [], []);
    expect(bounds).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  });

  test('empty pages array returns all zeros', () => {
    const bounds = getWorldBounds([], [[1]], DIMS, 0, [], []);
    expect(bounds).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  });

  test('3 horizontal pages, no overlap, origin at 0', () => {
    const layout = [[1, 1, 1]];
    const bounds = getWorldBounds([0, 1, 2], layout, DIMS, 0, [], [0, 0]);
    expect(bounds.minX).toBe(0);
    expect(bounds.maxX).toBe(800); // 2 × 400
    expect(bounds.minY).toBe(0);
    expect(bounds.maxY).toBe(0);
  });

  test('3 horizontal pages, origin at center', () => {
    const layout = [[1, 1, 1]];
    const bounds = getWorldBounds([0, 1, 2], layout, DIMS, 1, [], [0, 0]);
    expect(bounds.minX).toBe(-400);
    expect(bounds.maxX).toBe(400);
  });

  test('layout bounds (overlaps, origin at ROOM)', () => {
    const layout = [[1, 1, 1]];
    const bounds = getWorldBounds([0, 1, 2], layout, DIMS, 1, [], [0.5, 0.4]);
    // CANVAS: -200, ROOM: 0, DRAWERS: +240
    expect(bounds.minX).toBe(-200);
    expect(bounds.maxX).toBe(240);
    expect(bounds.minY).toBe(0);
    expect(bounds.maxY).toBe(0);
  });

  test('2×2 grid spans both axes', () => {
    const layout = [[1, 1], [1, 1]];
    const bounds = getWorldBounds([0, 1, 2, 3], layout, DIMS, 0, [0], [0]);
    expect(bounds.minX).toBe(0);
    expect(bounds.maxX).toBe(400);
    expect(bounds.minY).toBe(0);
    expect(bounds.maxY).toBe(800);
  });

  test('overlaps reduce bounds magnitude', () => {
    const layout = [[1, 1]];
    const noOverlap = getWorldBounds([0, 1], layout, DIMS, 0, [], [0]);
    const withOverlap = getWorldBounds([0, 1], layout, DIMS, 0, [], [0.5]);
    expect(withOverlap.maxX).toBe(noOverlap.maxX * 0.5);
  });
});
