import { useEffect, useMemo, useState } from 'react';
import { User, UserEvent, UserEventHandlerMap } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';
import { useTranslation } from '../internationalization';

export enum Presence {
  Online = 'online',
  Unavailable = 'unavailable',
  Offline = 'offline',
}

export type UserPresence = {
  presence: Presence;
  status?: string;
  active: boolean;
  lastActiveTs?: number;
};

const getUserPresence = (user: User): UserPresence => ({
  presence: user.presence as Presence,
  status: user.presenceStatusMsg,
  active: user.currentlyActive,
  lastActiveTs: user.getLastActiveTs(),
});

export const useUserPresence = (userId: string): UserPresence | undefined => {
  const mx = useMatrixClient();
  const user = mx.getUser(userId);

  const [presence, setPresence] = useState(() => (user ? getUserPresence(user) : undefined));

  useEffect(() => {
    const updatePresence: UserEventHandlerMap[UserEvent.Presence] = (event, u) => {
      if (u.userId === user?.userId) {
        setPresence(getUserPresence(user));
      }
    };
    user?.on(UserEvent.Presence, updatePresence);
    user?.on(UserEvent.CurrentlyActive, updatePresence);
    user?.on(UserEvent.LastPresenceTs, updatePresence);
    return () => {
      user?.removeListener(UserEvent.Presence, updatePresence);
      user?.removeListener(UserEvent.CurrentlyActive, updatePresence);
      user?.removeListener(UserEvent.LastPresenceTs, updatePresence);
    };
  }, [user]);

  return presence;
};

export const usePresenceLabel = (): Record<Presence, string> => {
  const [t] = useTranslation();
  return useMemo(
    () => ({
      [Presence.Online]: t.Presence.online,
      [Presence.Unavailable]: t.Presence.unavailable,
      [Presence.Offline]: t.Presence.offline,
    }),
    [t.Presence.online, t.Presence.unavailable, t.Presence.offline]
  );
};
