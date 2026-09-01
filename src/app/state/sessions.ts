import { syncDesktopMediaAuth } from '../platform/desktop';

export type Session = {
  baseUrl: string;
  userId: string;
  deviceId: string;
  accessToken: string;
  expiresInMs?: number;
  refreshToken?: string;
};

export function setStoredSession(
  accessToken: string,
  deviceId: string,
  userId: string,
  baseUrl: string
) {
  localStorage.setItem('cinny_access_token', accessToken);
  localStorage.setItem('cinny_device_id', deviceId);
  localStorage.setItem('cinny_user_id', userId);
  localStorage.setItem('cinny_hs_base_url', baseUrl);
  syncDesktopMediaAuth();
}
export const removeStoredSession = () => {
  localStorage.removeItem('cinny_hs_base_url');
  localStorage.removeItem('cinny_user_id');
  localStorage.removeItem('cinny_device_id');
  localStorage.removeItem('cinny_access_token');
  syncDesktopMediaAuth();
};
export const getStoredSession = (): Session | undefined => {
  const baseUrl = localStorage.getItem('cinny_hs_base_url');
  const userId = localStorage.getItem('cinny_user_id');
  const deviceId = localStorage.getItem('cinny_device_id');
  const accessToken = localStorage.getItem('cinny_access_token');

  if (baseUrl && userId && deviceId && accessToken) {
    const session: Session = {
      baseUrl,
      userId,
      deviceId,
      accessToken,
    };

    return session;
  }

  return undefined;
};

export const getStoredAccessToken = (): string | undefined =>
  localStorage.getItem('cinny_access_token') ?? undefined;
