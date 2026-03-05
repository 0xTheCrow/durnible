import { useEffect, useState } from 'react';
import { UserEvent, UserEventHandlerMap } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

export type UserProfile = {
  avatarUrl?: string;
  displayName?: string;
  bannerUrl?: string;
};

const bannerUrlCache = new Map<string, string>();

export const useUserProfile = (userId: string): UserProfile => {
  const mx = useMatrixClient();

  const [profile, setProfile] = useState<UserProfile>(() => {
    const user = mx.getUser(userId);
    return {
      avatarUrl: user?.avatarUrl,
      displayName: user?.displayName,
      bannerUrl: bannerUrlCache.get(userId),
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

    mx.getExtendedProfileProperty(userId, 'banner_url')
      .then((value: unknown) => {
        if (typeof value === 'string' && value.startsWith('mxc://')) {
          bannerUrlCache.set(userId, value);
          setProfile((cp) => ({ ...cp, bannerUrl: value }));
        } else {
          bannerUrlCache.delete(userId);
          setProfile((cp) => ({ ...cp, bannerUrl: undefined }));
        }
      })
      .catch(() => {
        // Server doesn't support MSC4133 or property not set
      });

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
  if (mxc) {
    bannerUrlCache.set(userId, mxc);
  } else {
    bannerUrlCache.delete(userId);
  }
};
