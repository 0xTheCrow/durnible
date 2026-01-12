import { style } from '@vanilla-extract/css';
import { color, config } from 'folds';

export const WidgetOverlay = style({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 1000,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: config.space.S400,
});

export const WidgetContainer = style({
  position: 'relative',
  width: '100%',
  height: '100%',
  maxWidth: '1400px',
  maxHeight: '900px',
  backgroundColor: color.Background.Container,
  borderRadius: config.radii.R400,
  overflow: 'hidden',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  display: 'flex',
  flexDirection: 'column',
});

export const WidgetHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: config.space.S200,
  borderBottom: `1px solid ${color.Background.ContainerLine}`,
  backgroundColor: color.Background.Container,
});

export const WidgetTitle = style({
  fontWeight: 600,
  fontSize: '14px',
  color: color.Background.OnContainer,
});

export const WidgetIframe = style({
  flex: 1,
  border: 'none',
  width: '100%',
  height: '100%',
});

export const LoadingContainer = style({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: config.space.S300,
});
