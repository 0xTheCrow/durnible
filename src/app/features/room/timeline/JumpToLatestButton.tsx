import type { RefObject } from 'react';
import React, { useEffect, useState } from 'react';
import { Chip, Icon, Icons, Text } from 'folds';
import * as css from './RoomTimeline.css';
import { TimelineOverlay } from './TimelineOverlay';

export const SCROLL_AWAY_RESET_PX = 300;

export type JumpToLatestButtonProps = {
  scrollRef: RefObject<HTMLDivElement>;
  // null when the caller has nothing to track (not live-linked, range not at
  // newest, or no rendered events). In that case we don't observe anything and
  // let the button surface based on the other gates (atBottom, autoScrolling).
  // Identified by event id rather than range index so that filtered events
  // (redactions) don't leave us observing a detached node.
  lastMessageId: string | null;
  atBottom: boolean;
  autoScrolling: boolean;
  onClick: () => void;
};

export function JumpToLatestButton({
  scrollRef,
  lastMessageId,
  atBottom,
  autoScrolling,
  onClick,
}: JumpToLatestButtonProps) {
  const [lastMsgVisible, setLastMsgVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const handleClick = () => {
    setDismissed(true);
    onClick();
  };

  useEffect(() => {
    if (!dismissed) return undefined;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return undefined;
    const handleScroll = () => {
      const distanceFromBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
      if (distanceFromBottom > SCROLL_AWAY_RESET_PX) {
        setDismissed(false);
      }
    };
    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', handleScroll);
  }, [dismissed, scrollRef]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || lastMessageId === null) {
      setLastMsgVisible(false);
      return undefined;
    }
    const lastEl = scrollEl.querySelector(
      `[data-message-id="${CSS.escape(lastMessageId)}"]`
    ) as HTMLElement | null;
    if (!lastEl) {
      setLastMsgVisible(false);
      return undefined;
    }

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
  }, [lastMessageId, scrollRef]);

  return (
    <TimelineOverlay
      className={css.JumpToLatestOverlay}
      position="Bottom"
      data-visible={!atBottom && !lastMsgVisible && !autoScrolling && !dismissed}
      data-testid="jump-to-latest-overlay"
    >
      <Chip
        variant="SurfaceVariant"
        radii="Pill"
        outlined
        before={<Icon size="50" src={Icons.ArrowBottom} />}
        onClick={handleClick}
        data-testid="jump-to-latest-button"
      >
        <Text size="L400">Jump to Latest</Text>
      </Chip>
    </TimelineOverlay>
  );
}
