import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config } from 'folds';
import { Header, HeaderEdgeButton } from '../../styles/mediaFrame.css';

export { PrimaryHeaderButton as PdfViewerDownloadButton } from '../../styles/mediaFrame.css';

export const PdfViewerFooter = style([
  Header,
  {
    borderTopWidth: config.borderWidth.B300,
    borderBottomWidth: 0,
    justifyContent: 'space-between',
  },
]);

const pageButtonBase = {
  width: 'auto',
  paddingLeft: config.space.S400,
  paddingRight: config.space.S400,
  gap: config.space.S200,
  selectors: {
    '&:disabled': {
      cursor: 'default',
      opacity: 0.3,
    },
  },
} as const;

export const PdfViewerPrevPageButton = style([
  HeaderEdgeButton,
  pageButtonBase,
  {
    marginLeft: `calc(-1 * ${config.space.S300})`,
  },
]);

export const PdfViewerNextPageButton = style([
  HeaderEdgeButton,
  pageButtonBase,
  {
    marginRight: `calc(-1 * ${config.space.S300})`,
  },
]);

export const PdfViewerContent = style([
  DefaultReset,
  {
    margin: 'auto',
    display: 'inline-block',
    backgroundColor: color.Surface.Container,
    color: color.Surface.OnContainer,
  },
]);
