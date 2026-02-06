import React, { useCallback, useEffect, useState } from 'react';
import classNames from 'classnames';
import { Box, Icon, IconButton, Icons, Text, as, color } from 'folds';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { mxcUrlToHttp } from '../../utils/matrix';
import * as css from './YouTubeEmbed.css';
import { tryDecodeURIComponent } from '../../utils/dom';

const linkStyles = { color: color.Success.Main };

export const YouTubeEmbed = as<'div', { videoId: string; url: string; ts: number }>(
  ({ videoId, url, ts, className, ...props }, ref) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const [playing, setPlaying] = useState(false);
    const [previewStatus, loadPreview] = useAsyncCallback(
      useCallback(() => mx.getUrlPreview(url, ts), [url, ts, mx])
    );

    useEffect(() => {
      loadPreview();
    }, [loadPreview]);

    const title =
      previewStatus.status === AsyncStatus.Success
        ? previewStatus.data['og:title']
        : undefined;

    const thumbnailMxc =
      previewStatus.status === AsyncStatus.Success
        ? previewStatus.data['og:image']
        : undefined;

    const thumbnailUrl = thumbnailMxc
      ? mxcUrlToHttp(mx, thumbnailMxc, useAuthentication, 400, 225, 'scale', false)
      : undefined;

    return (
      <Box
        shrink="No"
        direction="Column"
        className={classNames(css.YouTubeEmbed, className)}
        {...props}
        ref={ref}
      >
        <div className={css.YouTubeIframeContainer}>
          {playing ? (
            <iframe
              className={css.YouTubeIframe}
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
              title={typeof title === 'string' ? title : 'YouTube video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
            />
          ) : (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <div className={css.YouTubeThumbnail} onClick={() => setPlaying(true)}>
              {thumbnailUrl && (
                <img
                  className={css.YouTubeThumbnail}
                  src={thumbnailUrl}
                  alt={typeof title === 'string' ? title : 'YouTube video'}
                />
              )}
              <IconButton
                className={css.YouTubePlayButton}
                variant="Secondary"
                radii="Pill"
                size="400"
                aria-label="Play video"
              >
                <Icon src={Icons.Play} size="400" filled />
              </IconButton>
            </div>
          )}
        </div>
        <div className={css.YouTubeLink}>
          {typeof title === 'string' && (
            <Text truncate priority="400">
              <b>{title}</b>
            </Text>
          )}
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
    );
  }
);
