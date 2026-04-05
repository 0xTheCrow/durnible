import React from 'react';
import classNames from 'classnames';
import { Box, Text, as, color } from 'folds';
import * as css from './YouTubeEmbed.css';

const linkStyles = { color: color.Success.Main };

export const YouTubeEmbed = as<'div', { videoId: string; url: string; ts: number }>(
  ({ videoId, url, ts, className, ...props }, ref) => {
    return (
      <Box
        shrink="No"
        direction="Column"
        className={classNames(css.YouTubeEmbed, className)}
        {...props}
        ref={ref}
      >
        <div className={css.YouTubeIframeContainer}>
        <iframe
          className={css.YouTubeIframe}
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title="YouTube video"
          allow="encrypted-media"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="no-referrer"
        />
        </div>
        <div className={css.YouTubeLink}>
          <Text
            style={linkStyles}
            as="a"
            href={`https://inv.nadeko.net/watch?v=${videoId}`}
            target="_blank"
            rel="noreferrer noopener"
            size="T200"
            priority="300"
          >
            {`[Invidious] - https://inv.nadeko.net/watch?v=${videoId}`}
          </Text>
        </div>
      </Box>
    );
  }
);
