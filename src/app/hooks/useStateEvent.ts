import { useCallback, useState } from 'react';
import type { Room } from 'matrix-js-sdk';
import { useStateEventCallback } from './useStateEventCallback';
import { getStateEvent } from '../utils/room';
import type { StateEvent } from '../../types/matrix/room';

export const useStateEvent = (room: Room, eventType: StateEvent, stateKey = '') => {
  const [event, setEvent] = useState(() => getStateEvent(room, eventType, stateKey));
  const [prev, setPrev] = useState({ room, eventType, stateKey });
  if (prev.room !== room || prev.eventType !== eventType || prev.stateKey !== stateKey) {
    setPrev({ room, eventType, stateKey });
    setEvent(getStateEvent(room, eventType, stateKey));
  }

  useStateEventCallback(
    room.client,
    useCallback(
      (stateEvent) => {
        if (
          stateEvent.getRoomId() === room.roomId &&
          stateEvent.getType() === eventType &&
          stateEvent.getStateKey() === stateKey
        ) {
          setEvent(getStateEvent(room, eventType, stateKey));
        }
      },
      [room, eventType, stateKey]
    )
  );

  return event;
};
