import React from 'react';
import classNames from 'classnames';
import { Box, Text, as, color } from 'folds';
import * as css from './NitterEmbed.css';
import type { TwitterEmbedInfo } from '../../utils/embeds';
import { useNitterInstance } from '../../utils/nitterInstance';

const linkStyles = { color: color.Primary.Main };

// Nitter's /embed endpoint serves a static HTML page with the tweet rendered
// inside <div class="tweet-embed"> (see src/views/tweet.nim → renderTweetEmbed).
// Nitter has no postMessage / iframe-resizer support — that's an open feature
// request (zedeus/nitter#536) and the embed PR (#515) explicitly notes embeds
// don't auto-adjust to height. So the "official" embedding approach is simply
// an iframe with a fixed size, which is what we do here.
export const NitterEmbed = as<
  'div',
  { info: TwitterEmbedInfo; url: string; showEmbed?: boolean; showLink?: boolean }
>(({ info, url, showEmbed = true, showLink = true, className, ...props }, ref) => {
  const instance = useNitterInstance();

  const embedSrc = instance
    ? `https://${instance}/${info.user}/status/${info.id}/embed`
    : undefined;
  const nitterUrl = instance ? `https://${instance}/${info.user}/status/${info.id}` : undefined;
  const showLinkBar = showLink && nitterUrl !== undefined && nitterUrl !== url;

  return (
    <Box
      shrink="No"
      direction="Column"
      className={classNames(css.NitterEmbed, className)}
      {...props}
      ref={ref}
    >
      {showEmbed &&
        (instance ? (
          <iframe
            className={css.NitterIframe}
            src={embedSrc}
            title="Tweet"
            // No allow-scripts: Nitter's video player doesn't work in our
            // setup anyway, and dropping JS execution removes the bulk of the
            // attack surface (no fingerprinting, no tracker beacons, no
            // script-driven APIs at all). allow-popups stays so anchor links
            // inside the tweet still open in a new tab when clicked.
            sandbox="allow-popups"
            loading="lazy"
            referrerPolicy="strict-origin"
          />
        ) : (
          <Box className={css.NitterIframe} alignItems="Center" justifyContent="Center">
            <Text size="T200" priority="300">
              Resolving Nitter instance…
            </Text>
          </Box>
        ))}
      {showLinkBar && nitterUrl && (
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
});
