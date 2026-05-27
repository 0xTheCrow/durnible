import type { CSSProperties } from 'react';
import React from 'react';
import { Badge, Box, Text } from 'folds';
import { EmojiBoardTab } from '../types';
import { gifServerEnabled } from '../../../utils/gifServer';
import * as css from './styles.css';

const tabStyle: CSSProperties = {
  cursor: 'pointer',
  flex: '1 1 0',
  justifyContent: 'center',
};

export function EmojiBoardTabs({
  tab,
  onTabChange,
}: {
  tab: EmojiBoardTab;
  onTabChange: (tab: EmojiBoardTab) => void;
}) {
  const emojiActive = tab === EmojiBoardTab.Emoji;
  const stickerActive = tab === EmojiBoardTab.Sticker;
  const gifActive = tab === EmojiBoardTab.Gif;
  return (
    <Box gap="100" grow="Yes">
      <Badge
        className={css.EmojiBoardTabBtn}
        data-tab-active={emojiActive}
        style={tabStyle}
        as="button"
        variant="Secondary"
        fill={emojiActive ? 'Solid' : 'None'}
        size="500"
        onClick={() => onTabChange(EmojiBoardTab.Emoji)}
      >
        <Text as="span" size="L400">
          Emojis
        </Text>
      </Badge>
      {gifServerEnabled && (
        <Badge
          className={css.EmojiBoardTabBtn}
          data-tab-active={gifActive}
          style={tabStyle}
          as="button"
          variant="Secondary"
          fill={gifActive ? 'Solid' : 'None'}
          size="500"
          onClick={() => onTabChange(EmojiBoardTab.Gif)}
        >
          <Text as="span" size="L400">
            GIFs
          </Text>
        </Badge>
      )}
      <Badge
        className={css.EmojiBoardTabBtn}
        data-tab-active={stickerActive}
        style={tabStyle}
        as="button"
        variant="Secondary"
        fill={stickerActive ? 'Solid' : 'None'}
        size="500"
        onClick={() => onTabChange(EmojiBoardTab.Sticker)}
      >
        <Text as="span" size="L400">
          Stickers
        </Text>
      </Badge>
    </Box>
  );
}
