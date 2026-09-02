import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

export const checkIsNativeMobileApp = (): boolean => Capacitor.isNativePlatform();

export const syncMobileSystemBarsStyle = (isDarkTheme: boolean): void => {
  if (!checkIsNativeMobileApp()) return;
  SystemBars.setStyle({
    style: isDarkTheme ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  });
};
