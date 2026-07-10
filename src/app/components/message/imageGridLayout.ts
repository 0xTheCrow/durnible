// Mirrors MImage's MAX_HEIGHT.
export const SINGLE_IMAGE_MAX_HEIGHT = 400;
export const GRID_MIN_WIDTH = 400;
// Must match `gap` in ImageGrid.css.ts.
export const GRID_GAP = 12;
export const STACK_MAX_WIDTH = 500;
// Cells are square, so capping width caps height at the same limit MImage uses.
export const MOBILE_STACK_MAX_WIDTH = SINGLE_IMAGE_MAX_HEIGHT;

export const GRID_MAX_CELLS = 6;

export type Count = 2 | 3 | 4 | 5 | 6;

export const stackColumnsForCount: Record<Count, number> = { 2: 1, 3: 2, 4: 2, 5: 2, 6: 2 };

export const stackRowsForCount: Record<Count, number> = { 2: 2, 3: 2, 4: 2, 5: 3, 6: 3 };

export const gridColumnsForCount: Record<Count, number> = { 2: 2, 3: 2, 4: 2, 5: 3, 6: 3 };
