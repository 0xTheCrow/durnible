import React from 'react';
import classNames from 'classnames';
import { Box, Text, as, color } from 'folds';
import * as css from './SpotifyEmbed.css';
import { SpotifyEmbedInfo } from '../../utils/embeds';

const linkStyles = { color: color.Success.Main };
const TALL_TYPES = new Set(['album', 'playlist', 'artist', 'show']);

export const SpotifyEmbed = as<'div', { info: SpotifyEmbedInfo; url: string }>(
  ({ info, url, className, ...props }, ref) => {
    const isTall = TALL_TYPES.has(info.type);
    // Strip tracking params (si, utm_*) by constructing a clean embed URL
    const embedSrc = `https://open.spotify.com/embed/${info.type}/${info.id}`;
    const cleanUrl = `https://open.spotify.com/${info.type}/${info.id}`;

    return (
      <Box
        shrink="No"
        direction="Column"
        className={classNames(css.SpotifyEmbed, className)}
        {...props}
        ref={ref}
      >
        <iframe
          className={isTall ? css.SpotifyIframeTall : css.SpotifyIframe}
          src={embedSrc}
          title="Spotify player"
          allow="autoplay; encrypted-media"
          sandbox="allow-scripts allow-same-origin"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className={css.SpotifyLink}>
          <Text
            style={linkStyles}
            as="a"
            href={cleanUrl}
            target="_blank"
            rel="noreferrer noopener"
            size="T200"
            priority="300"
          >
            {`[Spotify] - ${cleanUrl}`}
          </Text>
        </div>
      </Box>
    );
  }
);
