import React from 'react';
import classNames from 'classnames';
import { Box, Text, as, color } from 'folds';
import * as css from './YouTubeEmbed.css';
import { useInvidiousInstance } from '../../utils/invidiousInstance';

const linkStyles = { color: color.Primary.Main };

export const YouTubeEmbed = as<'div', { videoId: string; url: string; start?: number; showEmbed?: boolean; showLink?: boolean }>(
  ({ videoId, url, start, showEmbed = true, showLink = true, className, ...props }, ref) => {
    const invidiousInstance = useInvidiousInstance();
    const embedSrc = `https://www.youtube-nocookie.com/embed/${videoId}${start ? `?start=${start}` : ''}`;
    const linkUrl = invidiousInstance
      ? `https://${invidiousInstance}/watch?v=${videoId}${start ? `&t=${start}` : ''}`
      : undefined;
    const showLinkBar = showLink && linkUrl !== undefined && linkUrl !== url;
    return (
      <Box
        shrink="No"
        direction="Column"
        className={classNames(css.YouTubeEmbed, className)}
        {...props}
        ref={ref}
      >
        {showEmbed && (
          <div className={css.YouTubeIframeContainer}>
            <iframe
              className={css.YouTubeIframe}
              src={embedSrc}
              title="YouTube video"
              allow="encrypted-media"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
              referrerPolicy="strict-origin"
            />
          </div>
        )}
        {showLinkBar && linkUrl && (
          <div className={css.YouTubeLink}>
            <Text
              style={linkStyles}
              as="a"
              href={linkUrl}
              target="_blank"
              rel="noreferrer noopener"
              size="T200"
              priority="300"
            >
              {`[Invidious] - ${linkUrl}`}
            </Text>
          </div>
        )}
      </Box>
    );
  }
);
