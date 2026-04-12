import type { StyleRule } from '@vanilla-extract/css';
import { keyframes } from '@vanilla-extract/css';
import { color } from 'folds';

const shimmerKeyframes = keyframes({
  '0%': { backgroundPosition: '200% 0' },
  '100%': { backgroundPosition: '-200% 0' },
});

export const skeletonShimmer: StyleRule = {
  backgroundColor: color.SurfaceVariant.Container,
  backgroundImage: `linear-gradient(90deg, ${color.SurfaceVariant.Container} 0%, ${color.SurfaceVariant.ContainerHover} 50%, ${color.SurfaceVariant.Container} 100%)`,
  backgroundSize: '200% 100%',
  backgroundRepeat: 'no-repeat',
  animation: `${shimmerKeyframes} 1.5s ease-in-out infinite`,
};
