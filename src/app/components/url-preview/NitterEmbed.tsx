import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { Box, Text, as, color } from 'folds';
import * as css from './NitterEmbed.css';
import { TwitterEmbedInfo, NITTER_INSTANCE } from '../../utils/embeds';

const linkStyles = { color: color.Primary.Main };

function parseHeightFromMessage(data: unknown): number | undefined {
  if (typeof data === 'number' && data > 0) return data;
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const h = obj.height ?? obj.innerHeight ?? obj.scrollHeight;
    if (typeof h === 'number' && h > 0) return h;
  }
  if (typeof data === 'string') {
    const match = data.match(/(\d+)/);
    if (match) {
      const h = parseInt(match[1], 10);
      if (h > 0) return h;
    }
  }
  return undefined;
}

export const NitterEmbed = as<'div', { info: TwitterEmbedInfo; url: string; showEmbed?: boolean; showLink?: boolean }>(
  ({ info, url, showEmbed = true, showLink = true, className, ...props }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [iframeHeight, setIframeHeight] = useState(200);

    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        if (event.source !== iframeRef.current?.contentWindow) return;
        const height = parseHeightFromMessage(event.data);
        if (height) setIframeHeight(height);
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, []);

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
            ref={iframeRef}
            className={css.NitterIframe}
            style={{ height: iframeHeight }}
            src={embedSrc}
            title="Tweet"
            allow="autoplay; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-presentation"
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
