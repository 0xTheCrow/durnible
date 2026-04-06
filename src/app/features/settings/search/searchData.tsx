import React from 'react';
import { Switch } from 'folds';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { SettingTile } from '../../../components/setting-tile';
import { SettingsPages } from '../settingsPages';
import {
  SelectTheme,
  PageZoomInput,
  SelectDateFormat,
  SelectMessageLayout,
  SelectMessageSpacing,
} from '../components';

export type SearchEntry = {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
  page: SettingsPages;
  pageName: string;
  sectionName: string;
  Render?: React.FC;
};

// --- Appearance ---
function SystemThemeSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'useSystemTheme');
  return (
    <SettingTile
      title="System Theme"
      description="Choose between light and dark theme based on system preference."
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function MonochromeSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'monochromeMode');
  return (
    <SettingTile
      title="Monochrome Mode"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function TwitterEmojiSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'twitterEmoji');
  return (
    <SettingTile
      title="Twitter Emoji"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}

// --- Date & Time ---
function Hour24ClockSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'hour24Clock');
  return (
    <SettingTile
      title="24-Hour Time Format"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}

// --- Editor ---
function EnterForNewlineSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'enterForNewline');
  return (
    <SettingTile
      title="ENTER for Newline"
      description="Use Ctrl/Cmd + ENTER to send message and ENTER for newline."
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function MarkdownSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'isMarkdown');
  return (
    <SettingTile
      title="Markdown Formatting"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function HideActivitySetting() {
  const [value, setValue] = useSetting(settingsAtom, 'hideActivity');
  return (
    <SettingTile
      title="Hide Typing & Read Receipts"
      description="Turn off both typing status and read receipts to keep your activity private."
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function AlternateInputSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'alternateInput');
  return (
    <SettingTile
      title="Alternate Message Input"
      description="Use a simple text input instead of the rich text editor."
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}

// --- Messages ---
function LegacyUsernameColorSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'legacyUsernameColor');
  return (
    <SettingTile
      title="Legacy Username Color"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function HideMembershipSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'hideMembershipEvents');
  return (
    <SettingTile
      title="Hide Membership Change"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function HideProfileChangeSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'hideNickAvatarEvents');
  return (
    <SettingTile
      title="Hide Profile Change"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function MediaAutoLoadSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'mediaAutoLoad');
  return (
    <SettingTile
      title="Disable Media Auto Load"
      after={<Switch variant="Primary" value={!value} onChange={(v) => setValue(!v)} />}
    />
  );
}
function UrlPreviewSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'urlPreview');
  return (
    <SettingTile
      title="URL Preview"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function EncUrlPreviewSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'encUrlPreview');
  return (
    <SettingTile
      title="URL Preview in Encrypted Room"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function EmbedLinksSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'embedLinks');
  return (
    <SettingTile
      title="Show Embed Links"
      description="Show a clean, tracking-free link for each embed."
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function EmbedYouTubeSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'embedYouTube');
  return (
    <SettingTile
      title="Embed YouTube"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function EmbedSpotifySetting() {
  const [value, setValue] = useSetting(settingsAtom, 'embedSpotify');
  return (
    <SettingTile
      title="Embed Spotify"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function EmbedSoundCloudSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'embedSoundCloud');
  return (
    <SettingTile
      title="Embed SoundCloud"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function EmbedNitterSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'embedNitter');
  return (
    <SettingTile
      title="Embed Twitter / X (Nitter)"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function ShowHiddenEventsSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'showHiddenEvents');
  return (
    <SettingTile
      title="Show Hidden Events"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function UnfocusedAutoScrollSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'unfocusedAutoScroll');
  return (
    <SettingTile
      title="Auto-scroll When Unfocused"
      description="Keep auto-scrolling to new messages even when the window is not focused."
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function PauseGifsSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'pauseGifs');
  return (
    <SettingTile
      title="Play GIFs on Hover"
      description="GIFs are paused by default and only animate while hovered."
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function ReplyHighlightSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'replyHighlight');
  return (
    <SettingTile
      title="Reply & Mention Highlighting"
      description="Highlight messages that reply to you or mention you by @username."
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}

// --- Advanced ---
function SwipeGesturesSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'swipeGestures');
  return (
    <SettingTile
      title="Swipe Gestures"
      description="Enable swipe gestures on mobile and tablet."
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function PwaModeSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'pwaMode');
  return (
    <SettingTile
      title="PWA Mode"
      description="Show update notifications when a new version is available."
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}

// --- Appearance ---
function ThemeSetting() {
  return (
    <SettingTile
      title="Theme"
      description="Theme to use when system theme is not enabled."
      after={<SelectTheme />}
    />
  );
}
function PageZoomSetting() {
  return <SettingTile title="Page Zoom" after={<PageZoomInput />} />;
}

// --- Date & Time ---
function DateFormatSetting() {
  return <SelectDateFormat />;
}

// --- Messages ---
function MessageLayoutSetting() {
  return <SettingTile title="Message Layout" after={<SelectMessageLayout />} />;
}
function MessageSpacingSetting() {
  return <SettingTile title="Message Spacing" after={<SelectMessageSpacing />} />;
}

// --- Notifications ---
function NotificationSoundSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'isNotificationSounds');
  return (
    <SettingTile
      title="Notification Sound"
      description="Play sound when new messages arrive."
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}

export const settingsSearchData: SearchEntry[] = [
  // Appearance
  {
    id: 'system-theme',
    title: 'System Theme',
    description: 'Choose between light and dark theme based on system preference.',
    keywords: ['theme', 'dark', 'light', 'appearance', 'color', 'colour'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Appearance',
    Render: SystemThemeSetting,
  },
  {
    id: 'theme',
    title: 'Theme',
    description: 'Theme to use when system theme is not enabled.',
    keywords: ['theme', 'dark', 'light', 'appearance', 'color', 'colour', 'skin'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Appearance',
    Render: ThemeSetting,
  },
  {
    id: 'monochrome-mode',
    title: 'Monochrome Mode',
    keywords: ['theme', 'appearance', 'color', 'colour', 'monochrome', 'grayscale'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Appearance',
    Render: MonochromeSetting,
  },
  {
    id: 'twitter-emoji',
    title: 'Twitter Emoji',
    keywords: ['emoji', 'twemoji', 'twitter', 'appearance'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Appearance',
    Render: TwitterEmojiSetting,
  },
  {
    id: 'page-zoom',
    title: 'Page Zoom',
    keywords: ['zoom', 'scale', 'size', 'appearance', 'accessibility'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Appearance',
    Render: PageZoomSetting,
  },
  // Date & Time
  {
    id: 'hour24-clock',
    title: '24-Hour Time Format',
    keywords: ['time', 'clock', '24h', '12h', 'format', 'date', 'am', 'pm'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Date & Time',
    Render: Hour24ClockSetting,
  },
  {
    id: 'date-format',
    title: 'Date Format',
    keywords: ['date', 'format', 'time', 'clock', 'timestamp'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Date & Time',
    Render: DateFormatSetting,
  },
  // Editor
  {
    id: 'enter-for-newline',
    title: 'ENTER for Newline',
    description: 'Use Ctrl/Cmd + ENTER to send message and ENTER for newline.',
    keywords: ['enter', 'newline', 'send', 'keyboard', 'editor', 'input', 'message', 'hotkey'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Editor',
    Render: EnterForNewlineSetting,
  },
  {
    id: 'markdown',
    title: 'Markdown Formatting',
    keywords: ['markdown', 'bold', 'italic', 'formatting', 'editor', 'markup', 'rich text'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Editor',
    Render: MarkdownSetting,
  },
  {
    id: 'hide-activity',
    title: 'Hide Typing & Read Receipts',
    description: 'Turn off both typing status and read receipts to keep your activity private.',
    keywords: ['typing', 'read receipts', 'privacy', 'activity', 'status', 'indicator', 'indicator'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Editor',
    Render: HideActivitySetting,
  },
  {
    id: 'alternate-input',
    title: 'Alternate Message Input',
    description: 'Use a simple text input instead of the rich text editor.',
    keywords: ['input', 'editor', 'text', 'simple', 'alternate', 'experimental', 'plain'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Editor',
    Render: AlternateInputSetting,
  },
  // Messages
  {
    id: 'message-layout',
    title: 'Message Layout',
    keywords: ['layout', 'message', 'bubble', 'compact', 'modern', 'appearance', 'chat'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: MessageLayoutSetting,
  },
  {
    id: 'message-spacing',
    title: 'Message Spacing',
    keywords: ['spacing', 'message', 'compact', 'comfortable', 'density', 'appearance', 'padding'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: MessageSpacingSetting,
  },
  {
    id: 'legacy-username-color',
    title: 'Legacy Username Color',
    keywords: ['username', 'color', 'colour', 'name', 'message', 'appearance'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: LegacyUsernameColorSetting,
  },
  {
    id: 'hide-membership',
    title: 'Hide Membership Change',
    keywords: ['membership', 'join', 'leave', 'events', 'hide', 'system messages'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: HideMembershipSetting,
  },
  {
    id: 'hide-profile-change',
    title: 'Hide Profile Change',
    keywords: ['profile', 'avatar', 'nickname', 'name change', 'events', 'hide'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: HideProfileChangeSetting,
  },
  {
    id: 'media-auto-load',
    title: 'Disable Media Auto Load',
    keywords: ['media', 'image', 'auto', 'load', 'autoload', 'bandwidth', 'data', 'photo'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: MediaAutoLoadSetting,
  },
  {
    id: 'url-preview',
    title: 'URL Preview',
    keywords: ['url', 'link', 'preview', 'embed', 'og', 'open graph'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: UrlPreviewSetting,
  },
  {
    id: 'enc-url-preview',
    title: 'URL Preview in Encrypted Room',
    keywords: ['url', 'link', 'preview', 'embed', 'encrypted', 'e2e', 'e2ee', 'encryption'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: EncUrlPreviewSetting,
  },
  {
    id: 'embed-links',
    title: 'Show Embed Links',
    description: 'Show a clean, tracking-free link for each embed.',
    keywords: ['embed', 'link', 'tracking', 'preview', 'card'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: EmbedLinksSetting,
  },
  {
    id: 'embed-youtube',
    title: 'Embed YouTube',
    keywords: ['youtube', 'embed', 'video', 'media', 'google'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: EmbedYouTubeSetting,
  },
  {
    id: 'embed-spotify',
    title: 'Embed Spotify',
    keywords: ['spotify', 'embed', 'music', 'audio', 'media'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: EmbedSpotifySetting,
  },
  {
    id: 'embed-soundcloud',
    title: 'Embed SoundCloud',
    keywords: ['soundcloud', 'embed', 'music', 'audio', 'media'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: EmbedSoundCloudSetting,
  },
  {
    id: 'embed-nitter',
    title: 'Embed Twitter / X (Nitter)',
    keywords: ['twitter', 'nitter', 'x', 'embed', 'social', 'media', 'tweet'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: EmbedNitterSetting,
  },
  {
    id: 'show-hidden-events',
    title: 'Show Hidden Events',
    keywords: ['hidden', 'events', 'system', 'messages', 'debug', 'developer'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: ShowHiddenEventsSetting,
  },
  {
    id: 'unfocused-autoscroll',
    title: 'Auto-scroll When Unfocused',
    description: 'Keep auto-scrolling to new messages even when the window is not focused.',
    keywords: ['scroll', 'autoscroll', 'background', 'unfocused', 'focus', 'window'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: UnfocusedAutoScrollSetting,
  },
  {
    id: 'pause-gifs',
    title: 'Play GIFs on Hover',
    description: 'GIFs are paused by default and only animate while hovered.',
    keywords: ['gif', 'animate', 'animation', 'hover', 'pause', 'media'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: PauseGifsSetting,
  },
  {
    id: 'reply-highlight',
    title: 'Reply & Mention Highlighting',
    description: 'Highlight messages that reply to you or mention you by @username.',
    keywords: ['reply', 'mention', 'highlight', 'ping', 'notification', 'at'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Messages',
    Render: ReplyHighlightSetting,
  },
  // Advanced
  {
    id: 'swipe-gestures',
    title: 'Swipe Gestures',
    description: 'Enable swipe gestures on mobile and tablet.',
    keywords: ['swipe', 'gesture', 'mobile', 'tablet', 'touch'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Advanced',
    Render: SwipeGesturesSetting,
  },
  {
    id: 'pwa-mode',
    title: 'PWA Mode',
    description: 'Show update notifications when a new version is available.',
    keywords: ['pwa', 'progressive', 'web', 'app', 'update', 'notification', 'install'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Advanced',
    Render: PwaModeSetting,
  },
  // Notifications
  {
    id: 'desktop-notifications',
    title: 'Desktop Notifications',
    description: 'Show desktop notifications when messages arrive.',
    keywords: ['notification', 'desktop', 'alert', 'popup', 'system', 'browser'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'System',
  },
  {
    id: 'notification-sound',
    title: 'Notification Sound',
    description: 'Play sound when new messages arrive.',
    keywords: ['notification', 'sound', 'audio', 'alert', 'ping', 'ding', 'beep'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'System',
    Render: NotificationSoundSetting,
  },
  {
    id: 'email-notification',
    title: 'Email Notification',
    description: 'Send notifications to your email address.',
    keywords: ['notification', 'email', 'mail', 'inbox'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'System',
  },
  {
    id: 'keyword-notifications',
    title: 'Keyword Notifications',
    description: 'Get notified when specific keywords appear in messages.',
    keywords: ['notification', 'keyword', 'word', 'custom', 'mention', 'filter'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'Keywords',
  },
  // Account
  {
    id: 'profile',
    title: 'Profile',
    description: 'Change your display name and avatar.',
    keywords: ['profile', 'name', 'avatar', 'picture', 'display name', 'account'],
    page: SettingsPages.AccountPage,
    pageName: 'Account',
    sectionName: 'Profile',
  },
  {
    id: 'contact-info',
    title: 'Contact Information',
    description: 'Manage your email and phone number.',
    keywords: ['contact', 'email', 'phone', 'account', 'identity', 'address'],
    page: SettingsPages.AccountPage,
    pageName: 'Account',
    sectionName: 'Contact',
  },
  {
    id: 'blocked-users',
    title: 'Block Users',
    description: 'Manage blocked and ignored users.',
    keywords: ['block', 'ignore', 'user', 'ban', 'mute', 'ignored'],
    page: SettingsPages.AccountPage,
    pageName: 'Account',
    sectionName: 'Block Users',
  },
  // Devices
  {
    id: 'devices',
    title: 'Manage Devices',
    description: 'View and manage your logged-in sessions.',
    keywords: ['device', 'session', 'logout', 'login', 'security', 'sessions'],
    page: SettingsPages.DevicesPage,
    pageName: 'Devices',
    sectionName: 'Devices',
  },
  {
    id: 'local-backup',
    title: 'Local Backup',
    description: 'Backup and restore your encryption keys.',
    keywords: ['backup', 'encryption', 'keys', 'security', 'e2e', 'cross-signing', 'export'],
    page: SettingsPages.DevicesPage,
    pageName: 'Devices',
    sectionName: 'Security',
  },
  // Emojis & Stickers
  {
    id: 'emoji-packs',
    title: 'Emoji & Sticker Packs',
    description: 'Manage custom emoji and sticker packs.',
    keywords: ['emoji', 'sticker', 'pack', 'custom', 'emote', 'reaction'],
    page: SettingsPages.EmojisStickersPage,
    pageName: 'Emojis & Stickers',
    sectionName: 'Packs',
  },
];
