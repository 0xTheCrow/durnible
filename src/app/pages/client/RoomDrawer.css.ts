import { style } from '@vanilla-extract/css';
import { SAFE_AREA_INSET_BOTTOM, SAFE_AREA_INSET_TOP } from '../../styles/safeArea';

export const DrawerContent = style({
  height: '100%',
  paddingTop: SAFE_AREA_INSET_TOP,
  paddingBottom: SAFE_AREA_INSET_BOTTOM,
});
