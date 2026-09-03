import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.durnible.app',
  appName: 'Durnible',
  webDir: 'dist',
  android: { path: 'platform/mobile/android' },
};

export default config;
