import React from 'react';
import classNames from 'classnames';
import { Box, Text, as, color } from 'folds';
import * as css from './YouTubeEmbed.css';
import { tryDecodeURIComponent } from '../../utils/dom';

const linkStyles = { color: color.Success.Main };

export const YouTubeEmbed = as<'div', { videoId: string; url: string }>(
  ({ videoId, url, className, ...props }, ref) => (
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
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className={css.YouTubeLink}>
        <Text
          style={linkStyles}
          truncate
          as="a"
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          size="T200"
          priority="300"
        >
          {tryDecodeURIComponent(url)}
        </Text>
      </div>
    </Box>
  )
);
