import { atom } from 'jotai';

export const SETTINGS_STORAGE_KEY = 'settings';
export type DateFormat = 'D MMM YYYY' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY/MM/DD' | '';
export type MessageSpacing = '0' | '100' | '200' | '300' | '400' | '500';
export enum MessageLayout {
  Modern = 0,
  Compact = 1,
  Bubble = 2,
}

export type TimelineSliderRange = 'day' | 'week' | 'month' | '3months' | '6months' | 'year' | 'all';

export type CallPaneDock = 'Left' | 'Right' | 'Top' | 'Bottom';

export type NotificationSoundId =
  | 'stealth'
  | 'low-key'
  | 'exuberant'
  | 'attention'
  | 'chime'
  | 'melody';

export type ScreenshareResolution = '720p' | '1080p' | '1440p';
export type ScreenshareMaxFrameRate = 15 | 30 | 60;

export interface Settings {
  themeId?: string;
  useSystemTheme: boolean;
  lightThemeId?: string;
  darkThemeId?: string;
  monochromeMode?: boolean;
  editorToolbar: boolean;
  isEditorToolbarGestureRequired: boolean;
  twitterEmoji: boolean;
  emojiSearchAutoFocusMobile: boolean;
  emojiSearchAutoFocusDesktop: boolean;
  pageZoom: number;
  hideActivity: boolean;

  isPeopleDrawer: boolean;
  memberSortFilterIndex: number;
  enterForNewline: boolean;
  messageLayout: MessageLayout;
  messageSpacing: MessageSpacing;
  hideMembershipEvents: boolean;
  hideNickAvatarEvents: boolean;
  mediaAutoLoad: boolean;
  urlPreview: boolean;
  encUrlPreview: boolean;
  embedYouTube: boolean;
  embedSpotify: boolean;
  embedSoundCloud: boolean;
  embedLinks: boolean;
  showHiddenEvents: boolean;
  legacyUsernameColor: boolean;
  unfocusedAutoScroll: boolean;
  pauseGifs: boolean;
  pauseGifImages: boolean;
  pauseGifStickers: boolean;
  pauseGifEmojis: boolean;
  gifShowNsfw: boolean;
  gifShowHidden: boolean;
  gifRandomFeatured: boolean;
  replyHighlight: boolean;

  showNotifications: boolean;
  isNotificationSoundEnabled: boolean;
  messageNotificationSoundId: NotificationSoundId;
  inviteNotificationSoundId: NotificationSoundId;

  hour24Clock: boolean;
  dateFormatString: string;

  developerTools: boolean;

  swipeGestures: boolean;

  pwaMode: boolean;

  timelineSliderRange: TimelineSliderRange;

  pageNavWidth: number;
  isPageNavCollapsed: boolean;
  isPageNavResizeEnabled: boolean;

  preferredAudioInputDeviceId?: string;
  preferredVideoInputDeviceId?: string;
  preferredAudioOutputDeviceId?: string;
  microphoneInputFloorLevel: number;
  screenshareResolution: ScreenshareResolution;
  screenshareMaxFrameRate: ScreenshareMaxFrameRate;
  showCallPreJoinScreen: boolean;
  callPaneDock: CallPaneDock;
  callPaneWidth: number;
  callPaneHeight: number;
}

const defaultSettings: Settings = {
  themeId: undefined,
  useSystemTheme: true,
  lightThemeId: undefined,
  darkThemeId: undefined,
  monochromeMode: false,
  editorToolbar: false,
  isEditorToolbarGestureRequired: false,
  twitterEmoji: false,
  emojiSearchAutoFocusMobile: false,
  emojiSearchAutoFocusDesktop: true,
  pageZoom: 100,
  hideActivity: true,

  isPeopleDrawer: true,
  memberSortFilterIndex: 0,
  enterForNewline: false,
  messageLayout: 0,
  messageSpacing: '400',
  hideMembershipEvents: false,
  hideNickAvatarEvents: true,
  mediaAutoLoad: true,
  urlPreview: true,
  encUrlPreview: false,
  embedYouTube: true,
  embedSpotify: true,
  embedSoundCloud: true,
  embedLinks: true,
  showHiddenEvents: false,
  legacyUsernameColor: false,
  unfocusedAutoScroll: false,
  pauseGifs: false,
  pauseGifImages: true,
  pauseGifStickers: true,
  pauseGifEmojis: true,
  gifShowNsfw: false,
  gifShowHidden: false,
  gifRandomFeatured: false,
  replyHighlight: true,

  showNotifications: true,
  isNotificationSoundEnabled: true,
  messageNotificationSoundId: 'stealth',
  inviteNotificationSoundId: 'stealth',

  hour24Clock: false,
  dateFormatString: 'D MMM YYYY',

  developerTools: false,

  swipeGestures: true,

  pwaMode: false,

  timelineSliderRange: 'day',

  pageNavWidth: 256,
  isPageNavCollapsed: false,
  isPageNavResizeEnabled: false,

  preferredAudioInputDeviceId: undefined,
  preferredVideoInputDeviceId: undefined,
  preferredAudioOutputDeviceId: undefined,
  microphoneInputFloorLevel: 0,
  screenshareResolution: '1080p',
  screenshareMaxFrameRate: 30,
  showCallPreJoinScreen: false,
  callPaneDock: 'Top',
  callPaneWidth: 360,
  callPaneHeight: 420,
};

type LegacySettings = Settings & {
  isNotificationSounds?: boolean;
};

export const getSettings = () => {
  const settings = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (settings === null) return defaultSettings;
  const storedSettings = JSON.parse(settings) as LegacySettings;
  return {
    ...defaultSettings,
    ...storedSettings,
    isNotificationSoundEnabled:
      storedSettings.isNotificationSoundEnabled ??
      storedSettings.isNotificationSounds ??
      defaultSettings.isNotificationSoundEnabled,
  };
};

export const setSettings = (settings: Settings) => {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

const baseSettings = atom<Settings>(getSettings());
export const settingsAtom = atom<Settings, [Settings], undefined>(
  (get) => get(baseSettings),
  (get, set, update) => {
    set(baseSettings, update);
    setSettings(update);
  }
);
