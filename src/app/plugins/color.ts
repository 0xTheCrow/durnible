import chroma from 'chroma-js';
import { ThemeKind } from '../hooks/useTheme';

export const accessibleColor = (
  themeKind: ThemeKind,
  color: string,
  bypassLightness = false
): string => {
  if (!chroma.valid(color)) return color;
  if (bypassLightness) return chroma(color).hex();

  let lightness = chroma(color).lab()[0];
  if (themeKind === ThemeKind.Dark && lightness < 60) {
    lightness = 60;
  }
  if (themeKind === ThemeKind.Light && lightness > 50) {
    lightness = 50;
  }

  return chroma(color).set('lab.l', lightness).hex();
};
