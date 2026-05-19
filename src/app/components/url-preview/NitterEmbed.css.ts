import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const NitterEmbed = style([
  DefaultReset,
  {
    width: toRem(520),
    maxWidth: '100%',
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
    borderRadius: config.radii.R300,
    overflow: 'hidden',
  },
]);

export const NitterIframe = style([
  DefaultReset,
  {
    width: '100%',
    // Fixed height — Nitter doesn't expose tweet dimensions (no postMessage
    // resize support), so we pick a compact value that fits short/text-only
    // tweets without much wasted space. Taller tweets (media, quotes, long
    // text) overflow and the browser provides an in-iframe scrollbar so the
    // rest of the post is still reachable.
    height: toRem(400),
    border: 'none',
    display: 'block',
  },
]);

export const NitterLink = style([
  DefaultReset,
  {
    padding: config.space.S200,
  },
]);
