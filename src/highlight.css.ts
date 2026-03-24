import { createVar, globalStyle } from '@vanilla-extract/css';

export const highlightBg = createVar();
export const highlightColor = createVar();

// Light theme (default) - soft blue tint from primary blue
globalStyle(':root', {
  vars: {
    [highlightBg]: '#D4E2F8',
    [highlightColor]: '#0D3076',
  },
});

// Silver - steel blue on gray
globalStyle('.silver-theme', {
  vars: {
    [highlightBg]: '#B8C7E5',
    [highlightColor]: '#0D3076',
  },
});

// Dark - soft purple from primary violet
globalStyle('.dark-theme', {
  vars: {
    [highlightBg]: '#413C65',
    [highlightColor]: '#E3E1F7',
  },
});

// Butter - warm cream tint
globalStyle('.butter-theme', {
  vars: {
    [highlightBg]: '#4D4B3A',
    [highlightColor]: '#FFFBDE',
  },
});

// Abyss - cool blue from primary
globalStyle('.abyss-theme', {
  vars: {
    [highlightBg]: '#252D45',
    [highlightColor]: '#C8DAFC',
  },
});
