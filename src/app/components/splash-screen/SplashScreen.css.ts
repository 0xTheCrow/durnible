import { style } from '@vanilla-extract/css';
import { color, config } from 'folds';

export const SplashScreen = style({
  minHeight: '100%',
  backgroundColor: color.Background.Container,
  color: color.Background.OnContainer,
});

export const SplashScreenFooter = style({
  padding: config.space.S400,
});

export const SplashScreenOverlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: config.zIndex.Max,
  opacity: 1,
  transition: 'opacity 100ms ease-out',
  selectors: {
    '&[data-visible="false"]': {
      opacity: 0,
      pointerEvents: 'none',
    },
  },
});
