import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

export const checkIsMobileApp = (): boolean => Capacitor.isNativePlatform();

export const syncMobileSystemBarsStyle = (isDarkTheme: boolean): void => {
  if (!checkIsMobileApp()) return;
  SystemBars.setStyle({
    style: isDarkTheme ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  });
};
