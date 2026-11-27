import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { STANDALONE_DISPLAY_MEDIA_QUERY } from '../../styles/safeArea';

export const checkIsNativeMobileApp = (): boolean => Capacitor.isNativePlatform();

export const checkIsInstalledApp = (): boolean =>
  checkIsNativeMobileApp() || window.matchMedia(STANDALONE_DISPLAY_MEDIA_QUERY).matches;

export const syncMobileSystemBarsStyle = (isDarkTheme: boolean): void => {
  if (!checkIsNativeMobileApp()) return;
  SystemBars.setStyle({
    style: isDarkTheme ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  });
};
