import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { Box, Text, as, color } from 'folds';
import * as css from './NitterEmbed.css';
import { TwitterEmbedInfo } from '../../utils/embeds';
import { useNitterInstance } from '../../utils/nitterInstance';

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
    const instance = useNitterInstance();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [iframeHeight, setIframeHeight] = useState(460);

    // Try reading the iframe content height on load. Works only for same-origin
    // instances; cross-origin throws SecurityError which we silently swallow.
    const handleLoad = () => {
      try {
        const doc =
          iframeRef.current?.contentDocument ??
          iframeRef.current?.contentWindow?.document;
        if (doc) {
          const h = doc.documentElement.scrollHeight || doc.body?.scrollHeight;
          if (h > 0) setIframeHeight(h);
        }
      } catch {
        // cross-origin SecurityError — keep default height
      }
    };

    // Bonus listener for Nitter forks that do send resize postMessage events.
    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        if (event.source !== iframeRef.current?.contentWindow) return;
        const height = parseHeightFromMessage(event.data);
        if (height) setIframeHeight(height);
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, []);

    const embedSrc = instance
      ? `https://${instance}/${info.user}/status/${info.id}/embed`
      : undefined;
    const nitterUrl = instance
      ? `https://${instance}/${info.user}/status/${info.id}`
      : undefined;
    const showLinkBar = showLink && nitterUrl !== undefined && nitterUrl !== url;

    return (
      <Box
        shrink="No"
        direction="Column"
        className={classNames(css.NitterEmbed, className)}
        {...props}
        ref={ref}
      >
        {showEmbed && (
          instance ? (
            <iframe
              ref={iframeRef}
              className={css.NitterIframe}
              style={{ height: iframeHeight }}
              src={embedSrc}
              title="Tweet"
              allow="autoplay; fullscreen; picture-in-picture"
              sandbox="allow-scripts allow-popups allow-presentation"
              loading="lazy"
              referrerPolicy="strict-origin"
              onLoad={handleLoad}
            />
          ) : (
            <Box className={css.NitterIframe} alignItems="Center" justifyContent="Center">
              <Text size="T200" priority="300">Resolving Nitter instance…</Text>
            </Box>
          )
        )}
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
  }
);
