import React from 'react';
import { Chip, Icon, Icons, Text } from 'folds';
import * as css from './RoomTimeline.css';
import { TimelineOverlay } from './TimelineOverlay';

export type JumpToLatestButtonProps = {
  visible: boolean;
  onClick: () => void;
};

export function JumpToLatestButton({ visible, onClick }: JumpToLatestButtonProps) {
  return (
    <TimelineOverlay
      className={css.JumpToLatestOverlay}
      position="Bottom"
      data-visible={visible}
      data-testid="jump-to-latest-overlay"
    >
      <Chip
        variant="SurfaceVariant"
        radii="Pill"
        outlined
        before={<Icon size="50" src={Icons.ArrowBottom} />}
        onClick={onClick}
        data-testid="jump-to-latest-button"
      >
        <Text size="L400">Jump to Latest</Text>
      </Chip>
    </TimelineOverlay>
  );
}
