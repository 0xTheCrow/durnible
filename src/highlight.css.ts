import { createVar, globalStyle } from '@vanilla-extract/css';

export const highlightBg = createVar();
export const highlightColor = createVar();

// Light theme (default) - soft blue tint from primary blue
globalStyle(':root', {
  vars: {
    [highlightBg]: '#C4D6F5',
    [highlightColor]: '#0D3076',
  },
});

// Silver - steel blue on gray
globalStyle('.silver-theme', {
  vars: {
    [highlightBg]: '#A8BBE0',
    [highlightColor]: '#0D3076',
  },
});

// Dark - vivid purple from primary violet
globalStyle('.dark-theme', {
  vars: {
    [highlightBg]: '#5A5291',
    [highlightColor]: '#E3E1F7',
  },
});

// Butter - warm cream tint
globalStyle('.butter-theme', {
  vars: {
    [highlightBg]: '#65624A',
    [highlightColor]: '#FFFBDE',
  },
});

// Abyss - bright blue from primary
globalStyle('.abyss-theme', {
  vars: {
    [highlightBg]: '#3A4870',
    [highlightColor]: '#C8DAFC',
  },
});
