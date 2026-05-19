import { useCallback, useState } from 'react';
import type { Room } from 'matrix-js-sdk';
import type { StateEvent } from '../../types/matrix/room';
import { useStateEventCallback } from './useStateEventCallback';
import { getStateEvents } from '../utils/room';

export const useStateEvents = (room: Room, eventType: StateEvent) => {
  const [events, setEvents] = useState(() => getStateEvents(room, eventType));
  const [prev, setPrev] = useState({ room, eventType });
  if (prev.room !== room || prev.eventType !== eventType) {
    setPrev({ room, eventType });
    setEvents(getStateEvents(room, eventType));
  }

  useStateEventCallback(
    room.client,
    useCallback(
      (stateEvent) => {
        if (stateEvent.getRoomId() === room.roomId && stateEvent.getType() === eventType) {
          setEvents(getStateEvents(room, eventType));
        }
      },
      [room, eventType]
    )
  );

  return events;
};
