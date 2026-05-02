import type { MutableRefObject, RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Room } from 'matrix-js-sdk';

export type ScrollAnchor =
  | { kind: 'bottom' }
  | {
      kind: 'event';
      eventId: string;
      align: 'start' | 'end' | 'center';
      offset?: number;
    };

export type ApplyAnchor = (anchor: ScrollAnchor, behavior: 'instant' | 'smooth') => void;

export type UseJumpToLatestOptions = {
  room: Room;
  viewingLatest: boolean;
  autoPinEnabled?: boolean;
  initiallyAtBottom?: boolean;
  // Provided by the consumer. Called when the hook needs to apply an anchor:
  // either an explicit setAnchor() from the consumer, or a re-application
  // after content size changes. The hook stores the latest function via the
  // ref so it can be defined after the hook is called (avoids a circular
  // dependency with useVirtualPaginator).
  applyAnchorRef: MutableRefObject<ApplyAnchor>;
};

export type UseJumpToLatest = {
  scrollRef: RefObject<HTMLDivElement>;
  contentRef: RefObject<HTMLDivElement>;
  lastMessageRef: (node: HTMLElement | null) => void;
  isAtBottom: boolean;
  isAtBottomRef: MutableRefObject<boolean>;
  // False until the IntersectionObserver has produced its first reading.
  // Use to delay button visibility decisions on initial mount so the button
  // doesn't flash before the observer has caught up.
  hasObserved: boolean;
  setAnchor: (anchor: ScrollAnchor, behavior?: 'instant' | 'smooth') => void;
  clearAnchor: () => void;
};

export function useJumpToLatest({
  room: _room,
  viewingLatest,
  autoPinEnabled = true,
  initiallyAtBottom = true,
  applyAnchorRef,
}: UseJumpToLatestOptions): UseJumpToLatest {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [isAtBottom, setIsAtBottomState] = useState(initiallyAtBottom);
  const isAtBottomRef = useRef(initiallyAtBottom);
  const [hasObserved, setHasObserved] = useState(false);

  const [lastMessageNode, setLastMessageNode] = useState<HTMLElement | null>(null);
  const lastMessageRef = useCallback((node: HTMLElement | null) => {
    setLastMessageNode(node);
  }, []);

  const autoPinEnabledRef = useRef(autoPinEnabled);
  autoPinEnabledRef.current = autoPinEnabled;

  // Single source of truth for "where the user wants to be." Set explicitly
  // by the consumer (e.g. on permalink, jump-to-reply, jump-to-unread) and
  // implicitly by the IntersectionObserver (intersecting → 'bottom'). Drives
  // re-scrolls when content shifts under the user.
  const anchorRef = useRef<ScrollAnchor | null>(null);

  // Pending scroll request as state. setAnchor stores the request; a layout
  // effect picks it up and applies it on the post-render DOM. This batches
  // with other setState calls (e.g. setTimeline in handleJumpToLatest) so
  // the scroll runs on the new geometry, not the stale geometry at call
  // time. Single scroll, no double-pin flash.
  type AnchorRequest = { anchor: ScrollAnchor; behavior: 'instant' | 'smooth' };
  const [pendingRequest, setPendingRequest] = useState<AnchorRequest | null>(null);

  const setAnchor = useCallback(
    (anchor: ScrollAnchor, behavior: 'instant' | 'smooth' = 'instant') => {
      anchorRef.current = anchor;
      setPendingRequest({ anchor, behavior });
    },
    []
  );

  const clearAnchor = useCallback(() => {
    anchorRef.current = null;
  }, []);

  useLayoutEffect(() => {
    if (!pendingRequest) return;
    applyAnchorRef.current(pendingRequest.anchor, pendingRequest.behavior);
  }, [pendingRequest, applyAnchorRef]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return undefined;
    if (!viewingLatest) return undefined;
    if (!lastMessageNode) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.find((e) => e.target === lastMessageNode);
        if (!entry) return;
        setHasObserved(true);
        const next = entry.isIntersecting;
        if (next) {
          // Last message visible — user is at the bottom. Adopt the 'bottom'
          // anchor unless an explicit event anchor is in effect (e.g. user
          // permalinked to the last message; respect their explicit intent).
          if (!anchorRef.current || anchorRef.current.kind === 'bottom') {
            anchorRef.current = { kind: 'bottom' };
          }
        } else if (anchorRef.current?.kind === 'bottom') {
          // Last message no longer visible — release the bottom anchor.
          anchorRef.current = null;
        }
        if (isAtBottomRef.current === next) return;
        isAtBottomRef.current = next;
        setIsAtBottomState(next);
      },
      { root: scrollEl }
    );
    observer.observe(lastMessageNode);
    return () => observer.disconnect();
  }, [lastMessageNode, viewingLatest]);

  // Re-apply the current anchor when content or viewport size changes.
  // Range expansions, image loads, reactions, and window/keyboard resizes
  // all flow through here. The 'bottom' anchor is gated on autoPinEnabled
  // so unfocusedAutoScroll=false is honored; explicit event anchors apply
  // unconditionally because the consumer set them with intent.
  //
  // We deliberately do NOT skip the first observer callback. The
  // consumer's initial setAnchor flows through pendingRequest and runs in
  // a layout effect; that scroll uses whatever scrollHeight exists at
  // that moment, which can pre-date a follow-up commit (reactions, image
  // aspect-ratio reservations, embed sizing). Re-applying when the
  // observer reports the post-commit size catches that growth. When the
  // anchor matches the current geometry the apply is a no-op, so the
  // extra call is harmless.
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return undefined;

    const observer = new ResizeObserver(() => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      if (anchor.kind === 'bottom' && !autoPinEnabledRef.current) return;
      applyAnchorRef.current(anchor, 'instant');
    });
    observer.observe(scrollEl);
    const contentEl = contentRef.current;
    if (contentEl) observer.observe(contentEl);
    return () => observer.disconnect();
  }, [applyAnchorRef]);

  // User-driven scroll input releases an event anchor — they've signaled
  // intent to leave the anchored target. The 'bottom' anchor is left to
  // the IntersectionObserver to manage; touching it here would cause it
  // to drop on any wheel input, even tiny ones that keep the user at the
  // bottom (auto-pin would then fail to re-engage on the next message).
  // mousedown covers native scrollbar-thumb drags, which don't fire wheel
  // or touchmove.
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return undefined;
    const handleUserInput = () => {
      if (anchorRef.current?.kind === 'event') {
        anchorRef.current = null;
      }
    };
    scrollEl.addEventListener('wheel', handleUserInput, { passive: true });
    scrollEl.addEventListener('touchmove', handleUserInput, { passive: true });
    scrollEl.addEventListener('mousedown', handleUserInput);
    return () => {
      scrollEl.removeEventListener('wheel', handleUserInput);
      scrollEl.removeEventListener('touchmove', handleUserInput);
      scrollEl.removeEventListener('mousedown', handleUserInput);
    };
  }, []);

  return {
    scrollRef,
    contentRef,
    lastMessageRef,
    isAtBottom,
    isAtBottomRef,
    hasObserved,
    setAnchor,
    clearAnchor,
  };
}
