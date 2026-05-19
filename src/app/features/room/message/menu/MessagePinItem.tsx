import { Icon, Icons, MenuItem, Text, as } from 'folds';
import React from 'react';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import type { RoomPinnedEventsEventContent } from 'matrix-js-sdk/lib/types';
import { useMatrixClient } from '../../../../hooks/useMatrixClient';
import { useRoomPinnedEvents } from '../../../../hooks/useRoomPinnedEvents';
import * as css from '../styles.css';

export const MessagePinItem = as<
  'button',
  {
    room: Room;
    mEvent: MatrixEvent;
    onClose?: () => void;
  }
>(({ room, mEvent, onClose, ...props }, ref) => {
  const mx = useMatrixClient();
  const pinnedEvents = useRoomPinnedEvents(room);
  const isPinned = pinnedEvents.includes(mEvent.getId() ?? '');

  const handlePin = () => {
    const eventId = mEvent.getId();
    const pinContent: RoomPinnedEventsEventContent = {
      pinned: Array.from(pinnedEvents).filter((id) => id !== eventId),
    };
    if (!isPinned && eventId) {
      pinContent.pinned.push(eventId);
    }
    mx.sendStateEvent(room.roomId, EventType.RoomPinnedEvents, pinContent);
    onClose?.();
  };

  return (
    <MenuItem
      size="300"
      after={<Icon size="100" src={Icons.Pin} />}
      radii="300"
      onClick={handlePin}
      data-testid="message-pin-btn"
      {...props}
      ref={ref}
    >
      <Text className={css.MessageMenuItemText} as="span" size="T300" truncate>
        {isPinned ? 'Unpin Message' : 'Pin Message'}
      </Text>
    </MenuItem>
  );
});
