import type { RefObject } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Chip, Icon, Icons, Text } from 'folds';
import * as css from './TimelineOverlay.css';
import { TimelineOverlay } from './TimelineOverlay';
import { traceTimelineScroll } from './utils/scrollTrace';

export const SCROLL_AWAY_RESET_PX = 300;

export type JumpToLatestButtonProps = {
  scrollRef: RefObject<HTMLDivElement>;
  contentRef: RefObject<HTMLDivElement>;
  isInLivePaginationWindow: boolean;
  onClick: () => void;
};

type LatestMessageRowGeometry = {
  latestMessageRowTop: number;
  latestMessageRowBottom: number;
  viewportTop: number;
  viewportBottom: number;
};

const findLatestMessageRow = (contentElement: HTMLElement): Element | null => {
  let rowElement = contentElement.lastElementChild;
  while (rowElement && !rowElement.hasAttribute('data-is-message')) {
    rowElement = rowElement.previousElementSibling;
  }
  return rowElement;
};

const measureLatestMessageRowGeometry = (
  scrollElement: HTMLElement,
  contentElement: HTMLElement
): LatestMessageRowGeometry | null => {
  const latestMessageRow = findLatestMessageRow(contentElement);
  if (!latestMessageRow) return null;
  const rowRect = latestMessageRow.getBoundingClientRect();
  const viewportRect = scrollElement.getBoundingClientRect();
  return {
    latestMessageRowTop: rowRect.top,
    latestMessageRowBottom: rowRect.bottom,
    viewportTop: viewportRect.top,
    viewportBottom: viewportRect.bottom,
  };
};

const checkIsLatestMessageRowOnScreen = ({
  latestMessageRowTop,
  latestMessageRowBottom,
  viewportTop,
  viewportBottom,
}: LatestMessageRowGeometry): boolean =>
  latestMessageRowTop < viewportBottom && latestMessageRowBottom > viewportTop;

export function JumpToLatestButton({
  scrollRef,
  contentRef,
  isInLivePaginationWindow,
  onClick,
}: JumpToLatestButtonProps) {
  const [isLatestMessageRowOnScreen, setIsLatestMessageRowOnScreen] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const pendingMeasureFrameRef = useRef(0);
  const latestMessageRowGeometryRef = useRef<LatestMessageRowGeometry | null>(null);

  const handleClick = () => {
    setDismissed(true);
    onClick();
  };

  useEffect(() => {
    if (!dismissed) return undefined;
    const scrollElement = scrollRef.current;
    if (!scrollElement) return undefined;
    const handleScroll = () => {
      const distanceFromBottom =
        scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
      if (distanceFromBottom > SCROLL_AWAY_RESET_PX) {
        setDismissed(false);
      }
    };
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [dismissed, scrollRef]);

  const scheduleLatestMessageRowMeasure = useCallback(() => {
    if (pendingMeasureFrameRef.current !== 0) return;
    pendingMeasureFrameRef.current = requestAnimationFrame(() => {
      pendingMeasureFrameRef.current = 0;
      const scrollElement = scrollRef.current;
      const contentElement = contentRef.current;
      if (!scrollElement || !contentElement) return;
      const latestMessageRowGeometry = measureLatestMessageRowGeometry(
        scrollElement,
        contentElement
      );
      latestMessageRowGeometryRef.current = latestMessageRowGeometry;
      setIsLatestMessageRowOnScreen(
        latestMessageRowGeometry === null ||
          checkIsLatestMessageRowOnScreen(latestMessageRowGeometry)
      );
    });
  }, [scrollRef, contentRef]);

  useEffect(() => {
    scheduleLatestMessageRowMeasure();
  });

  useEffect(() => {
    const scrollElement = scrollRef.current;
    const contentElement = contentRef.current;
    if (!scrollElement || !contentElement) return undefined;
    const resizeObserver = new ResizeObserver(scheduleLatestMessageRowMeasure);
    resizeObserver.observe(scrollElement);
    resizeObserver.observe(contentElement);
    scrollElement.addEventListener('scroll', scheduleLatestMessageRowMeasure, { passive: true });
    return () => {
      resizeObserver.disconnect();
      scrollElement.removeEventListener('scroll', scheduleLatestMessageRowMeasure);
      cancelAnimationFrame(pendingMeasureFrameRef.current);
      pendingMeasureFrameRef.current = 0;
    };
  }, [scrollRef, contentRef, scheduleLatestMessageRowMeasure]);

  const isLatestMessageVisible = isInLivePaginationWindow && isLatestMessageRowOnScreen;
  const isButtonVisible = !isLatestMessageVisible && !dismissed;

  useEffect(() => {
    traceTimelineScroll('jumpToLatest:visibility', {
      isButtonVisible,
      isInLivePaginationWindow,
      isLatestMessageRowOnScreen,
      dismissed,
      latestMessageRowGeometry: latestMessageRowGeometryRef.current,
    });
  }, [isButtonVisible, isInLivePaginationWindow, isLatestMessageRowOnScreen, dismissed]);

  return (
    <TimelineOverlay
      className={css.JumpToLatestOverlay}
      position="Bottom"
      data-visible={isButtonVisible}
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
