import { useEffect, useState } from 'react';
import type { UserEventHandlerMap } from 'matrix-js-sdk';
import { UserEvent } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

export type UserProfile = {
  avatarUrl?: string;
  displayName?: string;
  bannerUrl?: string;
};

type BannerCacheEntry = { url: string | undefined; fetched: boolean; lastFetchTimestamp?: number };
const bannerCache = new Map<string, BannerCacheEntry>();

export const useUserProfile = (userId: string): UserProfile => {
  const mx = useMatrixClient();

  const [profile, setProfile] = useState<UserProfile>(() => {
    const user = mx.getUser(userId);
    return {
      avatarUrl: user?.avatarUrl,
      displayName: user?.displayName,
      bannerUrl: bannerCache.get(userId)?.url,
    };
  });

  useEffect(() => {
    const user = mx.getUser(userId);
    const onAvatarChange: UserEventHandlerMap[UserEvent.AvatarUrl] = (event, myUser) => {
      setProfile((cp) => ({
        ...cp,
        avatarUrl: myUser.avatarUrl,
      }));
    };
    const onDisplayNameChange: UserEventHandlerMap[UserEvent.DisplayName] = (event, myUser) => {
      setProfile((cp) => ({
        ...cp,
        displayName: myUser.displayName,
      }));
    };

    mx.getProfileInfo(userId).then((info) =>
      setProfile((cp) => ({
        ...cp,
        avatarUrl: info.avatar_url,
        displayName: info.displayname,
      }))
    );

    const cached = bannerCache.get(userId);
    const cacheExpired =
      cached?.lastFetchTimestamp !== undefined && Date.now() - cached.lastFetchTimestamp > 60_000;
    if (!cached?.fetched || cacheExpired) {
      mx.getExtendedProfileProperty(userId, 'banner_url')
        .then((value: unknown) => {
          const url = typeof value === 'string' && value.startsWith('mxc://') ? value : undefined;
          bannerCache.set(userId, { url, fetched: true, lastFetchTimestamp: Date.now() });
          setProfile((cp) => ({ ...cp, bannerUrl: url }));
        })
        .catch(() => {
          bannerCache.set(userId, { url: undefined, fetched: true });
        });
    }

    user?.on(UserEvent.AvatarUrl, onAvatarChange);
    user?.on(UserEvent.DisplayName, onDisplayNameChange);
    return () => {
      user?.removeListener(UserEvent.AvatarUrl, onAvatarChange);
      user?.removeListener(UserEvent.DisplayName, onDisplayNameChange);
    };
  }, [mx, userId]);

  return profile;
};

export const setBannerUrlCache = (userId: string, mxc: string | undefined) => {
  bannerCache.set(userId, { url: mxc, fetched: true });
};
