import { style } from '@vanilla-extract/css';
import type { RecipeVariants } from '@vanilla-extract/recipes';
import { recipe } from '@vanilla-extract/recipes';
import { DefaultReset, color, toRem } from 'folds';

// Mirrors the MAX_HEIGHT used by MImage so a multi-image grid is never
// shorter than a single image would be at full size.
const SINGLE_IMAGE_MAX_HEIGHT_REM = toRem(400);

// Per-count layouts:
//   2 → 2 cols × 1 row, side by side
//   3 → 2 cols × 2 rows, first cell spans both rows (1 | 2/3 stacked)
//   4 → 2 cols × 2 rows, evenly tiled
//   5 → 3 cols × 2 rows, first cell spans both rows (1 | 2x2 sub-grid)
//   6 → 3 cols × 2 rows, evenly tiled
export const ImageGrid = recipe({
  base: [
    DefaultReset,
    {
      display: 'grid',
      gap: toRem(12),
      // Width is set inline by ImageGrid.tsx based on the natural dimensions
      // of the contained images (mirroring MImage's per-image width logic).
      maxWidth: '100%',
      minHeight: SINGLE_IMAGE_MAX_HEIGHT_REM,
      // Rows divide the available height equally so cells fill the grid
      // instead of leaving dead space below a single short row.
      gridAutoRows: '1fr',
    },
  ],
  variants: {
    count: {
      2: { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: '1fr' },
      3: { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' },
      4: { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' },
      5: { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' },
      6: { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' },
    },
  },
});

export type ImageGridVariants = RecipeVariants<typeof ImageGrid>;

export const ImageGridCell = style([
  DefaultReset,
  {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: color.SurfaceVariant.Container,
  },
]);

// Applied to the first cell when there's an odd number of images so it
// occupies its own column at full grid height while the remaining images
// tile to its right.
export const ImageGridCellSpanFullColumn = style({
  gridColumn: 1,
  gridRow: '1 / span 2',
});
