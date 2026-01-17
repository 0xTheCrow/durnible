import { useCallback, useEffect, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { isKeyHotkey } from 'is-hotkey';
import { EventTimeline, MatrixEvent } from 'matrix-js-sdk';


type ItemIndex = number;

export type TimelineSelectableItem = {
  eventId: string;
  itemIndex: ItemIndex;
};

export type TimelineSelectionAction = {
  hotkey: string;
  requiresSelection?: boolean;
  clearsSelection?: boolean;
  exitsNav?: boolean;
  handler?: (eventId?: string) => void;
};

/**
 * Keyboard navigation/selection helper for room timelines.
 *
 * Notes:
 * - `shouldRenderEvent` should match the render logic, or selection may land on hidden events.
 * - `scrollToItem` is expected to support `align: 'center'` and `behavior: 'instant'`.
 */
type TimelineSelectionContext = {
  timelineNavMode: boolean;
  linkedTimelines: EventTimeline[];
  shouldRenderEvent: (mEvent: MatrixEvent) => boolean;
  scrollToItem: (
    itemIndex: ItemIndex,
    opts: { behavior: ScrollBehavior; align: string; stopInView: boolean }
  ) => void;
  onExitTimelineNav: () => void;
  isEditableActive?: () => boolean;
  /**
   * Increment when timeline contents change without a new linkedTimelines reference
   * (e.g. redactions/edits that cause in-place updates).
   */
  timelineRevision?: number;
};

const buildSelectableItems = (
  linkedTimelines: TimelineSelectionContext['linkedTimelines'],
  shouldRenderEvent: TimelineSelectionContext['shouldRenderEvent']
): TimelineSelectableItem[] => {
  const selectable: TimelineSelectableItem[] = [];
  let baseIndex = 0;

  // Walk linked timelines and map each event to its absolute index.
  linkedTimelines.forEach((timeline) => {
    const events = timeline.getEvents();
    for (let index = 0; index < events.length; index += 1) {
      const mEvent = events[index];
      const eventId = mEvent.getId();
      if (eventId && shouldRenderEvent(mEvent)) {
        selectable.push({ eventId, itemIndex: baseIndex + index });
      }
    }
    baseIndex += events.length;
  });

  return selectable;
};

const isSelectableEventId = (
  eventId: string,
  linkedTimelines: TimelineSelectionContext['linkedTimelines'],
  shouldRenderEvent: TimelineSelectionContext['shouldRenderEvent']
): boolean => {
  for (let timelineIndex = linkedTimelines.length - 1; timelineIndex >= 0; timelineIndex -= 1) {
    const timeline = linkedTimelines[timelineIndex];
    const events = timeline.getEvents();
    for (let eventIndex = events.length - 1; eventIndex >= 0; eventIndex -= 1) {
      const mEvent = events[eventIndex];
      if (mEvent.getId() === eventId) {
        return shouldRenderEvent(mEvent);
      }
    }
  }
  return false;
};

export const useRoomTimelineNav = (
  context: TimelineSelectionContext,
  actions: TimelineSelectionAction[]
) => {
  const {
    timelineNavMode,
    linkedTimelines,
    shouldRenderEvent,
    scrollToItem,
    onExitTimelineNav,
    isEditableActive,
    timelineRevision,
  } = context;
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();

  const getSelectableItems = useCallback(() => {
    // Build from live timeline data so selection doesn't depend on the virtualized range.
    if (timelineRevision === -1) return [];
    return buildSelectableItems(linkedTimelines, shouldRenderEvent);
  }, [linkedTimelines, shouldRenderEvent, timelineRevision]);

  useEffect(() => {
    if (!selectedEventId) return;
    if (timelineNavMode) return;
    if (!isSelectableEventId(selectedEventId, linkedTimelines, shouldRenderEvent)) {
      setSelectedEventId(undefined);
    }
  }, [selectedEventId, timelineNavMode, linkedTimelines, shouldRenderEvent, getSelectableItems]);

  const handleKeyDown = useCallback(
    (evt: KeyboardEvent | ReactKeyboardEvent) => {
      const hotkeyEvent = 'nativeEvent' in evt ? evt.nativeEvent : evt;
      // Ignore modified shortcuts; these are handled elsewhere (e.g. browser/app shortcuts).
      if (hotkeyEvent.metaKey || hotkeyEvent.ctrlKey || hotkeyEvent.altKey) return;
      // Only handle nav keys when nav mode is active or a selection already exists.
      if (!timelineNavMode && !selectedEventId) return;

      if (isKeyHotkey(['arrowup', 'arrowdown'], hotkeyEvent)) {
        // Build a deterministic list from live timeline data, not the rendered range.
        const selectableItems = getSelectableItems();
        if (selectableItems.length === 0) return;
        const moveUp = isKeyHotkey('arrowup', hotkeyEvent);
        const currentIndex = selectedEventId
          ? selectableItems.findIndex((item) => item.eventId === selectedEventId)
          : -1;
        let nextIndex = 0;
        // No current selection: jump to the start/end depending on direction.
        if (currentIndex === -1) {
          nextIndex = moveUp ? selectableItems.length - 1 : 0;
        } else {
          // Step one item within bounds.
          const delta = moveUp ? -1 : 1;
          nextIndex = Math.min(
            Math.max(currentIndex + delta, 0),
            selectableItems.length - 1
          );
        }
        const nextItem = selectableItems[nextIndex];

        if (nextItem) {
          setSelectedEventId(nextItem.eventId);
          scrollToItem(nextItem.itemIndex, {
            behavior: 'instant',
            align: 'center',
            stopInView: true,
          });
          if (timelineNavMode) onExitTimelineNav();
        }

        evt.preventDefault();
        evt.stopPropagation();
        return;
      }

      // Non-arrow hotkeys (e.g. reply) that operate on the current selection.
      const action = actions.find(
        ({ hotkey, requiresSelection }) =>
          isKeyHotkey(hotkey, hotkeyEvent) && (!requiresSelection || !!selectedEventId)
      );
      if (action) {
        evt.preventDefault();
        evt.stopPropagation();
        action.handler?.(selectedEventId);
        if (action.clearsSelection) setSelectedEventId(undefined);
        if (action.exitsNav) onExitTimelineNav();
        return;
      }

      // If the user started typing into an editor, drop selection to avoid stealing keys.
      if (selectedEventId && isEditableActive?.()) {
        setSelectedEventId(undefined);
      }
    },
    [
      actions,
      isEditableActive,
      getSelectableItems,
      onExitTimelineNav,
      scrollToItem,
      selectedEventId,
      timelineNavMode,
    ]
  );

  return {
    selectedEventId,
    setSelectedEventId,
    handleKeyDown,
  };
};
