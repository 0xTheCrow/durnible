import React from 'react';
import classNames from 'classnames';
import { Box, Text, as, color } from 'folds';
import * as css from './NitterEmbed.css';
import { TwitterEmbedInfo, NITTER_INSTANCE } from '../../utils/embeds';

const linkStyles = { color: color.Primary.Main };

export const NitterEmbed = as<'div', { info: TwitterEmbedInfo; url: string; showEmbed?: boolean; showLink?: boolean }>(
  ({ info, url, showEmbed = true, showLink = true, className, ...props }, ref) => {
    const embedSrc = `https://${NITTER_INSTANCE}/${info.user}/status/${info.id}/embed`;
    const nitterUrl = `https://${NITTER_INSTANCE}/${info.user}/status/${info.id}`;
    const showLinkBar = showLink && nitterUrl !== url;

    return (
      <Box
        shrink="No"
        direction="Column"
        className={classNames(css.NitterEmbed, className)}
        {...props}
        ref={ref}
      >
        {showEmbed && (
          <iframe
            className={css.NitterIframe}
            src={embedSrc}
            title="Tweet"
            allow=""
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}
        {showLinkBar && (
          <div className={css.NitterLink}>
            <Text
              style={linkStyles}
              as="a"
              href={nitterUrl}
              target="_blank"
              rel="noreferrer noopener"
              size="T200"
              priority="300"
            >
              {`[Nitter] - ${nitterUrl}`}
            </Text>
          </div>
        )}
      </Box>
    );
  }
);
