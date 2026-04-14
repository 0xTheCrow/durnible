import { UAParser } from 'ua-parser-js';

const parsed = UAParser(window.navigator.userAgent);

const MOBILE_OR_TABLET =
  parsed.device.type === 'mobile' ||
  parsed.device.type === 'tablet' ||
  parsed.os.name === 'Android' ||
  parsed.os.name === 'iOS';

const IS_MAC_OS = parsed.os.name === 'Mac OS';

export const ua = () => parsed;

export const isMacOS = (): boolean => IS_MAC_OS;

export const mobileOrTablet = (): boolean => MOBILE_OR_TABLET;
