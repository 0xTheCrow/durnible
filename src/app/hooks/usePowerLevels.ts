import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useStateEvent } from './useStateEvent';
import { StateEvent } from '../../types/matrix/room';
import { useStateEventCallback } from './useStateEventCallback';
import { useMatrixClient } from './useMatrixClient';
import { getStateEvent } from '../utils/room';

export type PowerLevelActions = 'invite' | 'redact' | 'kick' | 'ban' | 'historical';
export type PowerLevelNotificationsAction = 'room';

export type PowerLevels = {
  users_default?: number;
  state_default?: number;
  events_default?: number;
  historical?: number;
  invite?: number;
  redact?: number;
  kick?: number;
  ban?: number;

  events?: Record<string, number>;
  users?: Record<string, number>;
  notifications?: Record<string, number>;
};

export const DEFAULT_POWER_LEVELS: Required<PowerLevels> = {
  users_default: 0,
  state_default: 50,
  events_default: 0,
  invite: 0,
  redact: 50,
  kick: 50,
  ban: 50,
  historical: 0,
  events: {},
  users: {},
  notifications: {
    room: 50,
  },
};

export const fillMissingPowers = (powerLevels: PowerLevels): PowerLevels => {
  const defined = Object.fromEntries(
    Object.entries(powerLevels).filter(([, v]) => v !== undefined)
  );
  const filled: PowerLevels = { ...DEFAULT_POWER_LEVELS, ...defined };
  if (filled.notifications && typeof filled.notifications.room !== 'number') {
    filled.notifications = {
      ...filled.notifications,
      room: DEFAULT_POWER_LEVELS.notifications.room,
    };
  }
  return filled;
};

const getPowersLevelFromMatrixEvent = (mEvent?: MatrixEvent): PowerLevels => {
  const plContent = mEvent?.getContent<PowerLevels>();

  const powerLevels = !plContent ? DEFAULT_POWER_LEVELS : fillMissingPowers(plContent);

  return powerLevels;
};

export function usePowerLevels(room: Room): PowerLevels {
  const powerLevelsEvent = useStateEvent(room, StateEvent.RoomPowerLevels);
  const powerLevels: PowerLevels = useMemo(
    () => getPowersLevelFromMatrixEvent(powerLevelsEvent),
    [powerLevelsEvent]
  );

  return powerLevels;
}

export const PowerLevelsContext = createContext<PowerLevels | null>(null);

export const PowerLevelsContextProvider = PowerLevelsContext.Provider;

export const usePowerLevelsContext = (): PowerLevels => {
  const pl = useContext(PowerLevelsContext);
  if (!pl) throw new Error('PowerLevelContext is not initialized!');
  return pl;
};

export const useRoomsPowerLevels = (rooms: Room[]): Map<string, PowerLevels> => {
  const mx = useMatrixClient();
  const getRoomsPowerLevels = useCallback(() => {
    const rToPl = new Map<string, PowerLevels>();

    rooms.forEach((room) => {
      const mEvent = getStateEvent(room, StateEvent.RoomPowerLevels, '');
      rToPl.set(room.roomId, getPowersLevelFromMatrixEvent(mEvent));
    });

    return rToPl;
  }, [rooms]);

  const [roomToPowerLevels, setRoomToPowerLevels] = useState(() => getRoomsPowerLevels());

  useStateEventCallback(
    mx,
    useCallback(
      (event) => {
        const roomId = event.getRoomId();
        if (
          roomId &&
          event.getType() === StateEvent.RoomPowerLevels &&
          event.getStateKey() === '' &&
          rooms.find((r) => r.roomId === roomId)
        ) {
          setRoomToPowerLevels(getRoomsPowerLevels());
        }
      },
      [rooms, getRoomsPowerLevels]
    )
  );

  return roomToPowerLevels;
};

export type ReadPowerLevelAPI = {
  user: (powerLevels: PowerLevels, userId: string | undefined) => number;
  event: (powerLevels: PowerLevels, eventType: string | undefined) => number;
  state: (powerLevels: PowerLevels, eventType: string | undefined) => number;
  action: (powerLevels: PowerLevels, action: PowerLevelActions) => number;
  notification: (powerLevels: PowerLevels, action: PowerLevelNotificationsAction) => number;
};

export const readPowerLevel: ReadPowerLevelAPI = {
  user: (powerLevels, userId) => {
    const { users_default: usersDefault, users } = powerLevels;

    if (userId && users && typeof users[userId] === 'number') {
      return users[userId];
    }
    return usersDefault ?? DEFAULT_POWER_LEVELS.users_default;
  },
  event: (powerLevels, eventType) => {
    const { events, events_default: eventsDefault } = powerLevels;
    if (events && eventType && typeof events[eventType] === 'number') {
      return events[eventType];
    }
    return eventsDefault ?? DEFAULT_POWER_LEVELS.events_default;
  },
  state: (powerLevels, eventType) => {
    const { events, state_default: stateDefault } = powerLevels;
    if (events && eventType && typeof events[eventType] === 'number') {
      return events[eventType];
    }
    return stateDefault ?? DEFAULT_POWER_LEVELS.state_default;
  },
  action: (powerLevels, action) => {
    const powerLevel = powerLevels[action];
    if (typeof powerLevel === 'number') {
      return powerLevel;
    }
    return DEFAULT_POWER_LEVELS[action];
  },
  notification: (powerLevels, action) => {
    const powerLevel = powerLevels.notifications?.[action];
    if (typeof powerLevel === 'number') {
      return powerLevel;
    }
    return DEFAULT_POWER_LEVELS.notifications[action];
  },
};

export const useGetMemberPowerLevel = (powerLevels: PowerLevels) => {
  const callback = useCallback(
    (userId?: string): number => readPowerLevel.user(powerLevels, userId),
    [powerLevels]
  );

  return callback;
};

/**
 * Permissions
 */

type DefaultPermissionLocation = {
  user: true;
  key?: string;
};

type ActionPermissionLocation = {
  action: true;
  key: PowerLevelActions;
};

type EventPermissionLocation = {
  state?: true;
  key?: string;
};

type NotificationPermissionLocation = {
  notification: true;
  key: PowerLevelNotificationsAction;
};

export type PermissionLocation =
  | DefaultPermissionLocation
  | ActionPermissionLocation
  | EventPermissionLocation
  | NotificationPermissionLocation;

type ResolvedLocation =
  | { field: 'users' | 'events' | 'notifications'; subKey: string }
  | { field: keyof PowerLevels; subKey?: undefined };

// Maps a PermissionLocation to its position in the PowerLevels object:
// either a top-level field (e.g. "ban") or a nested record entry (e.g. events["m.room.message"]).
const resolveLocation = (location: PermissionLocation): ResolvedLocation => {
  if ('user' in location) {
    if (typeof location.key === 'string') return { field: 'users', subKey: location.key };
    return { field: 'users_default' };
  }
  if ('action' in location) return { field: location.key };
  if ('notification' in location) return { field: 'notifications', subKey: location.key };
  if ('state' in location) {
    if (typeof location.key === 'string') return { field: 'events', subKey: location.key };
    return { field: 'state_default' };
  }
  if (typeof location.key === 'string') return { field: 'events', subKey: location.key };
  return { field: 'events_default' };
};

export const getPermissionPower = (
  powerLevels: PowerLevels,
  location: PermissionLocation
): number => {
  const { field, subKey } = resolveLocation(location);
  if (subKey !== undefined) {
    return (
      (powerLevels[field] as Record<string, number> | undefined)?.[subKey] ??
      (DEFAULT_POWER_LEVELS[field] as Record<string, number>)[subKey] ??
      0
    );
  }
  return (powerLevels[field] as number | undefined) ?? (DEFAULT_POWER_LEVELS[field] as number);
};

export const applyPermissionPower = (
  powerLevels: PowerLevels,
  location: PermissionLocation,
  power: number
): PowerLevels => {
  const { field, subKey } = resolveLocation(location);
  if (subKey !== undefined) {
    return {
      ...powerLevels,
      [field]: { ...(powerLevels[field] as Record<string, number>), [subKey]: power },
    };
  }
  return { ...powerLevels, [field]: power };
};
