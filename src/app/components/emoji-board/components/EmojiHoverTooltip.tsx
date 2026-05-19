import { Tooltip, Text } from 'folds';
import React from 'react';
import { createPortal } from 'react-dom';

type EmojiHoverTooltipProps = {
  shortcode: string;
  rect: DOMRect;
};

export function EmojiHoverTooltip({ shortcode, rect }: EmojiHoverTooltipProps) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
        transform: 'translate(-50%, -100%)',
        pointerEvents: 'none',
        // Folds PopOut hardcodes z-index Max (9999); we portal to body, so we must match it
        // to render above the emoji board. Equal z-index ties break by DOM order, and this
        // portal mounts after the popout, so the tooltip wins.
        zIndex: 9999,
      }}
    >
      <Tooltip>
        <Text size="T300">{`:${shortcode}:`}</Text>
      </Tooltip>
    </div>,
    document.body
  );
}
