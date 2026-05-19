import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config } from 'folds';

export const HEADER_HEIGHT = '2.25rem';

export const Frame = style([DefaultReset, { height: '100%', flexGrow: 1 }]);

export const FrameExpanded = style({
  width: '90vw',
  height: '90vh',
  '@media': {
    'screen and (max-width: 750px)': {
      width: '100vw',
    },
  },
});

export const Header = style([
  DefaultReset,
  {
    minHeight: HEADER_HEIGHT,
    height: HEADER_HEIGHT,
    paddingLeft: config.space.S300,
    paddingRight: config.space.S300,
    borderBottomWidth: config.borderWidth.B300,
    flexShrink: 0,
    gap: config.space.S300,
    '@media': {
      'screen and (max-width: 750px)': {
        gap: config.space.S200,
      },
    },
  },
]);

const edgeButtonBase = {
  alignSelf: 'stretch',
  width: HEADER_HEIGHT,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'inherit',
  transition: 'background-color 120ms ease',
  selectors: {
    '&:hover': {
      backgroundColor: color.SurfaceVariant.ContainerHover,
    },
    '&:focus-visible': {
      outline: `${config.borderWidth.B400} solid ${color.Primary.Main}`,
      outlineOffset: `calc(-1 * ${config.borderWidth.B400})`,
    },
  },
} as const;

export const HeaderEdgeButton = style([DefaultReset, edgeButtonBase]);

export const CloseButton = style([
  DefaultReset,
  edgeButtonBase,
  {
    marginLeft: `calc(-1 * ${config.space.S300})`,
  },
]);

export const Content = style([
  DefaultReset,
  {
    position: 'relative',
    backgroundColor: color.Background.Container,
    color: color.Background.OnContainer,
    overflow: 'hidden',
  },
]);

export const LoadingOverlay = style({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const PrimaryHeaderButton = style([
  DefaultReset,
  {
    alignSelf: 'stretch',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: config.space.S200,
    paddingLeft: config.space.S400,
    paddingRight: config.space.S400,
    marginRight: `calc(-1 * ${config.space.S300})`,
    '@media': {
      'screen and (max-width: 750px)': {
        paddingLeft: config.space.S200,
        paddingRight: config.space.S200,
      },
    },
    backgroundColor: color.Primary.Main,
    color: color.Primary.OnMain,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'background-color 120ms ease',
    selectors: {
      '&:hover': {
        backgroundColor: color.Primary.MainHover,
      },
      '&:focus-visible': {
        outline: `${config.borderWidth.B400} solid ${color.Primary.Main}`,
        outlineOffset: `calc(-1 * ${config.borderWidth.B400})`,
      },
    },
  },
]);
