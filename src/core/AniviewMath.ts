/**
 * Pure spatial math helpers used by config, gesture, and bake flows.
 */

export interface MatrixPos {
  r: number;
  c: number;
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Converts a linear page id to matrix row/column indices.
 *
 * @param pageId - Numeric page id.
 * @param layout - Active layout matrix.
 * @returns Matrix position for the page id, or sentinel out-of-range values.
 */
export function pageIdToMatrixPos(pageId: number, layout: number[][]): MatrixPos {
  'worklet';
  const rowLength = Math.max(1, layout[0]?.length || 0);
  const numRows = layout.length;
  const maxPage = numRows * rowLength - 1;
  
  if (pageId < 0 || pageId > maxPage) {
    return { r: 9999, c: 9999 };
  }

  return {
    r: Math.floor(pageId / rowLength),
    c: pageId % rowLength
  };
}

/**
 * Calculates axis displacement between two indices while honoring overlap ratios.
 *
 * @param from - Origin index.
 * @param to - Target index.
 * @param size - Axis size in pixels.
 * @param overlaps - Per-gap overlap ratios for the axis.
 * @returns Signed axis displacement.
 */
export function calculateAxisOffset(
  from: number, 
  to: number, 
  size: number, 
  overlaps: number[]
): number {
  'worklet';
  if (from === to) return 0;
  const direction = to > from ? 1 : -1;
  let totalOffset = 0;
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  for (let i = start; i < end; i++) {
    const overlapRatio = overlaps[i] || 0;
    totalOffset += size * (1 - overlapRatio);
  }
  return totalOffset * direction;
}

/**
 * Computes world-space offset for a page relative to a default origin page.
 *
 * @param pageId - Target page id.
 * @param layout - Active layout matrix.
 * @param contextDims - Viewport dimensions.
 * @param defaultPage - Origin page id.
 * @param rowOverlaps - Row overlap ratios.
 * @param colOverlaps - Column overlap ratios.
 * @returns `{ x, y }` world offset for the target page.
 */
export function getPageOffset(
  pageId: number,
  layout: number[][],
  contextDims: { width: number; height: number },
  defaultPage: number,
  rowOverlaps: number[],
  colOverlaps: number[]
): { x: number; y: number } {
  'worklet';
  const target = pageIdToMatrixPos(pageId, layout);
  const origin = pageIdToMatrixPos(defaultPage, layout);
  
  return {
    x: calculateAxisOffset(origin.c, target.c, contextDims.width, colOverlaps),
    y: calculateAxisOffset(origin.r, target.r, contextDims.height, rowOverlaps)
  };
}

/**
 * Computes min/max world bounds across all active pages.
 *
 * @param pages - Active page ids.
 * @param layout - Active layout matrix.
 * @param contextDims - Viewport dimensions.
 * @param defaultPage - Origin page id.
 * @param rowOverlaps - Row overlap ratios.
 * @param colOverlaps - Column overlap ratios.
 * @returns World boundary extents.
 */
export function getWorldBounds(
  pages: number[],
  layout: number[][],
  contextDims: { width: number; height: number },
  defaultPage: number,
  rowOverlaps: number[],
  colOverlaps: number[]
): WorldBounds {
  'worklet';
  if (pages.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  
  const firstOffset = getPageOffset(pages[0], layout, contextDims, defaultPage, rowOverlaps, colOverlaps);
  let minX = firstOffset.x, maxX = firstOffset.x, minY = firstOffset.y, maxY = firstOffset.y;

  for (let i = 1; i < pages.length; i++) {
    const offset = getPageOffset(pages[i], layout, contextDims, defaultPage, rowOverlaps, colOverlaps);
    minX = Math.min(minX, offset.x);
    maxX = Math.max(maxX, offset.x);
    minY = Math.min(minY, offset.y);
    maxY = Math.max(maxY, offset.y);
  }

  return { minX, maxX, minY, maxY };
}
