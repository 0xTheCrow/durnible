import React from 'react';
import classNames from 'classnames';
import { Box, Text, as, color } from 'folds';
import * as css from './SoundCloudEmbed.css';
import { SoundCloudEmbedInfo } from '../../utils/embeds';

const linkStyles = { color: color.Primary.Main };

export const SoundCloudEmbed = as<'div', { info: SoundCloudEmbedInfo; url: string; showEmbed?: boolean; showLink?: boolean }>(
  ({ info, url, showEmbed = true, showLink = true, className, ...props }, ref) => {
    const showLinkBar = showLink && info.cleanUrl !== url;
    const embedSrc =
      `https://w.soundcloud.com/player/?url=${encodeURIComponent(info.cleanUrl)}` +
      `&auto_play=false&hide_related=true&show_comments=false` +
      `&show_user=true&show_reposts=false&show_teaser=false&visual=false`;

    return (
      <Box
        shrink="No"
        direction="Column"
        className={classNames(css.SoundCloudEmbed, className)}
        {...props}
        ref={ref}
      >
        {showEmbed && (
          <iframe
            className={info.isSet ? css.SoundCloudIframeTall : css.SoundCloudIframe}
            src={embedSrc}
            title="SoundCloud player"
            allow="autoplay"
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}
        {showLinkBar && (
          <div className={css.SoundCloudLink}>
            <Text
              style={linkStyles}
              as="a"
              href={info.cleanUrl}
              target="_blank"
              rel="noreferrer noopener"
              size="T200"
              priority="300"
            >
              {`[SoundCloud] - ${info.cleanUrl}`}
            </Text>
          </div>
        )}
      </Box>
    );
  }
);
