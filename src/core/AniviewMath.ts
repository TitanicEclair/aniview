/**
 * ANIVIEW MATH CORE
 * 
 * Pure functional implementation of Aniview's spatial logic.
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
 * Converts a linear PageID to a (Row, Column) matrix position.
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
 * Calculates the displacement between two indices on an axis, accounting for overlaps.
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
 * Calculates the (x, y) coordinates of a page relative to a default origin page.
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
 * Calculates the absolute boundaries of the virtual world.
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
