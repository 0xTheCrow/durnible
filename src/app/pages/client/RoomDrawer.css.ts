import { style } from '@vanilla-extract/css';

export const DrawerContent = style({
  height: '100%',
  paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top, 0px))',
  paddingBottom: 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))',
});
