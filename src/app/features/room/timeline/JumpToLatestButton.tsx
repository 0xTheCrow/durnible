import type { RefObject } from 'react';
import React, { useEffect, useState } from 'react';
import { Chip, Icon, Icons, Text } from 'folds';
import * as css from './RoomTimeline.css';
import { TimelineOverlay } from './TimelineOverlay';

export type JumpToLatestButtonProps = {
  scrollRef: RefObject<HTMLDivElement>;
  // null when the caller has nothing to track (not live-linked, range not at
  // newest, or empty range). In that case we don't observe anything and let
  // the button surface based on the other gates (atBottom, autoScrolling).
  lastMessageIndex: number | null;
  atBottom: boolean;
  autoScrolling: boolean;
  onClick: () => void;
};

export function JumpToLatestButton({
  scrollRef,
  lastMessageIndex,
  atBottom,
  autoScrolling,
  onClick,
}: JumpToLatestButtonProps) {
  const [lastMsgVisible, setLastMsgVisible] = useState(true);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || lastMessageIndex === null || lastMessageIndex < 0) {
      setLastMsgVisible(false);
      return undefined;
    }
    const lastEl = scrollEl.querySelector(
      `[data-message-item="${lastMessageIndex}"]`
    ) as HTMLElement | null;
    if (!lastEl) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.find((e) => e.target === lastEl);
        if (entry) {
          setLastMsgVisible(entry.isIntersecting);
        }
      },
      { root: scrollEl }
    );
    observer.observe(lastEl);
    return () => observer.disconnect();
  }, [lastMessageIndex, scrollRef]);

  return (
    <TimelineOverlay
      className={css.JumpToLatestOverlay}
      position="Bottom"
      data-visible={!atBottom && !lastMsgVisible && !autoScrolling}
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
