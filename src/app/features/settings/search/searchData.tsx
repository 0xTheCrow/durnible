import React from 'react';
import { Box, Switch, Button, Text } from 'folds';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { SettingTile } from '../../../components/setting-tile';
import { clearCacheAndReload } from '../../../../client/initMatrix';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { SettingsPages } from '../settingsPages';
import type { SettingsSearchEntry } from '../../../components/settings-search';
import {
  MicrophoneDeviceSetting,
  MicrophoneInputFloorSetting,
  CameraDeviceSetting,
  SpeakerDeviceSetting,
  PreJoinScreenSetting,
  DeviceAccessCard,
} from '../voice-video';
import { KEYBIND_CATEGORY_LABEL, keybindMeta } from '../../../state/keybinds';
import {
  SelectTheme,
  PageZoomInput,
  SelectDateFormat,
  SelectMessageLayout,
  SelectMessageSpacing,
  SelectNotificationSound,
} from '../components';

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
function EmojiSearchAutoFocusSetting() {
  const [desktopValue, setDesktopValue] = useSetting(settingsAtom, 'emojiSearchAutoFocusDesktop');
  const [mobileValue, setMobileValue] = useSetting(settingsAtom, 'emojiSearchAutoFocusMobile');
  return (
    <>
      <SettingTile
        title="Emoji Search Auto Focus"
        description="Focus the emoji board search input when opened."
      />
      <Box direction="Column" gap="100">
        <SettingTile
          title="Desktop"
          after={<Switch variant="Primary" value={desktopValue} onChange={setDesktopValue} />}
        />
        <SettingTile
          title="Mobile"
          after={<Switch variant="Primary" value={mobileValue} onChange={setMobileValue} />}
        />
      </Box>
    </>
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
  const [value, setValue] = useSetting(settingsAtom, 'isMarkdownEnabled');
  return (
    <SettingTile
      title="Markdown Formatting"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function EditorToolbarGestureSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'isEditorToolbarGestureRequired');
  return (
    <SettingTile
      title="Aa Formatting Toolbar Long Press"
      description="Require a long press or double tap on the Aa button to open the formatting toolbar. Touch input only."
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
  const [value, setValue] = useSetting(settingsAtom, 'isNotificationSoundEnabled');
  return (
    <SettingTile
      title="Notification Sound"
      description="Play sound when new messages arrive."
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}
function MessageNotificationSoundSetting() {
  const [isNotificationSoundEnabled] = useSetting(settingsAtom, 'isNotificationSoundEnabled');
  const [messageNotificationSoundId, setMessageNotificationSoundId] = useSetting(
    settingsAtom,
    'messageNotificationSoundId'
  );
  return (
    <SettingTile
      title="Message Sound"
      description="Sound played when a new message arrive."
      after={
        <SelectNotificationSound
          soundId={messageNotificationSoundId}
          disabled={!isNotificationSoundEnabled}
          onSelect={setMessageNotificationSoundId}
        />
      }
    />
  );
}
function InviteNotificationSoundSetting() {
  const [isNotificationSoundEnabled] = useSetting(settingsAtom, 'isNotificationSoundEnabled');
  const [inviteNotificationSoundId, setInviteNotificationSoundId] = useSetting(
    settingsAtom,
    'inviteNotificationSoundId'
  );
  return (
    <SettingTile
      title="Invite Sound"
      description="Sound played when a new invitation arrive."
      after={
        <SelectNotificationSound
          soundId={inviteNotificationSoundId}
          disabled={!isNotificationSoundEnabled}
          onSelect={setInviteNotificationSoundId}
        />
      }
    />
  );
}

// --- Developer Tools ---
function DeveloperToolsSetting() {
  const [value, setValue] = useSetting(settingsAtom, 'developerTools');
  return (
    <SettingTile
      title="Enable Developer Tools"
      after={<Switch variant="Primary" value={value} onChange={setValue} />}
    />
  );
}

// --- About ---
function ClearCacheSetting() {
  const mx = useMatrixClient();
  return (
    <SettingTile
      title="Clear Cache & Reload"
      description="Clear all your locally stored data and reload from server."
      after={
        <Button
          onClick={() => clearCacheAndReload(mx)}
          variant="Secondary"
          fill="Soft"
          size="300"
          radii="300"
          outlined
        >
          <Text size="B300">Clear Cache</Text>
        </Button>
      }
    />
  );
}

const keybindSearchEntries: SettingsSearchEntry<SettingsPages>[] = keybindMeta.map((meta) => ({
  id: `keybind-${meta.id}`,
  title: meta.label,
  description: `Keyboard shortcut for ${meta.label.toLowerCase()}.`,
  keywords: [
    'keybind',
    'keyboard',
    'shortcut',
    'hotkey',
    'bind',
    KEYBIND_CATEGORY_LABEL[meta.category],
  ],
  page: SettingsPages.KeybindsPage,
  pageName: 'Keybinds',
  sectionName: KEYBIND_CATEGORY_LABEL[meta.category],
}));

export const settingsSearchData: SettingsSearchEntry<SettingsPages>[] = [
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
    id: 'emoji-search-auto-focus',
    title: 'Emoji Search Auto Focus',
    description: 'Focus the emoji board search input when opened.',
    keywords: ['emoji', 'search', 'focus', 'autofocus', 'keyboard', 'board', 'sticker'],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Appearance',
    Render: EmojiSearchAutoFocusSetting,
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
    id: 'editor-toolbar-gesture',
    title: 'Aa Formatting Toolbar Long Press',
    description:
      'Require a long press or double tap on the Aa button to open the formatting toolbar. Touch input only.',
    keywords: [
      'aa',
      'toolbar',
      'formatting',
      'long press',
      'double tap',
      'gesture',
      'touch',
      'editor',
    ],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Editor',
    Render: EditorToolbarGestureSetting,
  },
  {
    id: 'hide-activity',
    title: 'Hide Typing & Read Receipts',
    description: 'Turn off both typing status and read receipts to keep your activity private.',
    keywords: [
      'typing',
      'read receipts',
      'privacy',
      'activity',
      'status',
      'indicator',
      'indicator',
    ],
    page: SettingsPages.GeneralPage,
    pageName: 'General',
    sectionName: 'Editor',
    Render: HideActivitySetting,
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
    id: 'message-notification-sound',
    title: 'Message Sound',
    description: 'Sound played when a new message arrive.',
    keywords: ['notification', 'sound', 'audio', 'message', 'tone', 'chime', 'ping', 'ringtone'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'System',
    Render: MessageNotificationSoundSetting,
  },
  {
    id: 'invite-notification-sound',
    title: 'Invite Sound',
    description: 'Sound played when a new invitation arrive.',
    keywords: [
      'notification',
      'sound',
      'audio',
      'invite',
      'invitation',
      'tone',
      'chime',
      'ringtone',
    ],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'System',
    Render: InviteNotificationSoundSetting,
  },
  /*
  {
    id: 'email-notification',
    title: 'Email Notification',
    description: 'Send notifications to your email address.',
    keywords: ['notification', 'email', 'mail', 'inbox'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'System',
  },
  */
  {
    id: 'keyword-notifications',
    title: 'Keyword Messages',
    description: 'Get notified when specific keywords appear in messages.',
    keywords: ['notification', 'keyword', 'word', 'custom', 'mention', 'filter'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'Keyword Messages',
  },
  {
    id: 'all-messages-direct',
    title: '1-to-1 Chats',
    description: 'Notification level for direct messages.',
    keywords: ['notification', 'direct', 'dm', '1-to-1', 'chat', 'mute', 'default'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'All Messages',
  },
  {
    id: 'all-messages-direct-encrypted',
    title: '1-to-1 Chats (Encrypted)',
    description: 'Notification level for encrypted direct messages.',
    keywords: ['notification', 'direct', 'dm', '1-to-1', 'chat', 'encrypted', 'e2e', 'mute'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'All Messages',
  },
  {
    id: 'all-messages-rooms',
    title: 'Rooms',
    description: 'Notification level for room messages.',
    keywords: ['notification', 'room', 'group', 'mute', 'default'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'All Messages',
  },
  {
    id: 'all-messages-rooms-encrypted',
    title: 'Rooms (Encrypted)',
    description: 'Notification level for encrypted room messages.',
    keywords: ['notification', 'room', 'group', 'encrypted', 'e2e', 'mute'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'All Messages',
  },
  {
    id: 'special-messages-user-id',
    title: 'Mention User ID',
    description: 'Get notified when someone mentions your user ID.',
    keywords: ['notification', 'mention', 'ping', 'user id', 'matrix id', 'highlight'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'Special Messages',
  },
  {
    id: 'special-messages-displayname',
    title: 'Contains Displayname',
    description: 'Get notified when a message contains your display name.',
    keywords: ['notification', 'mention', 'ping', 'displayname', 'display name', 'highlight'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'Special Messages',
  },
  {
    id: 'special-messages-username',
    title: 'Contains Username',
    description: 'Get notified when a message contains your username.',
    keywords: ['notification', 'mention', 'ping', 'username', 'highlight'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'Special Messages',
  },
  {
    id: 'special-messages-mention-room',
    title: 'Mention @room',
    description: 'Get notified when someone pings the whole room.',
    keywords: ['notification', 'mention', 'ping', 'room', 'everyone', 'highlight'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'Special Messages',
  },
  {
    id: 'special-messages-contains-room',
    title: 'Contains @room',
    description: 'Get notified when a message contains @room.',
    keywords: ['notification', 'mention', 'ping', 'room', 'everyone', 'highlight'],
    page: SettingsPages.NotificationPage,
    pageName: 'Notifications',
    sectionName: 'Special Messages',
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
    description: 'Manage your email.',
    keywords: ['contact', 'email', 'account', 'identity', 'address'],
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
  {
    id: 'matrix-id',
    title: 'Matrix ID',
    description: 'Your full Matrix user ID.',
    keywords: ['matrix id', 'mxid', 'user id', 'username', 'account', 'copy', 'address'],
    page: SettingsPages.AccountPage,
    pageName: 'Account',
    sectionName: 'Matrix ID',
  },
  // Devices
  {
    id: 'device-verification',
    title: 'Device Verification',
    description: 'To verify device identity and grant access to encrypted messages.',
    keywords: [
      'device',
      'verify',
      'verification',
      'cross-signing',
      'security',
      'encryption',
      'e2e',
      'trust',
    ],
    page: SettingsPages.DevicesPage,
    pageName: 'Devices',
    sectionName: 'Security',
  },
  {
    id: 'current-device',
    title: 'Current Device',
    description: 'Name, ID and encryption keys of the device you are signed in on.',
    keywords: ['device', 'session', 'current', 'rename', 'device name', 'keys', 'fingerprint'],
    page: SettingsPages.DevicesPage,
    pageName: 'Devices',
    sectionName: 'Current',
  },
  {
    id: 'other-devices',
    title: 'Other Devices',
    description: 'View and sign out of your other logged-in sessions.',
    keywords: [
      'device',
      'session',
      'sessions',
      'logout',
      'sign out',
      'login',
      'security',
      'manage',
    ],
    page: SettingsPages.DevicesPage,
    pageName: 'Devices',
    sectionName: 'Others',
  },
  {
    id: 'device-dashboard',
    title: 'Device Dashboard',
    description: 'Manage your devices on OIDC dashboard.',
    keywords: ['device', 'dashboard', 'oidc', 'session', 'manage', 'account'],
    page: SettingsPages.DevicesPage,
    pageName: 'Devices',
    sectionName: 'Others',
  },
  {
    id: 'export-keys',
    title: 'Export Messages Data',
    description: 'Export your encryption keys to a file.',
    keywords: ['backup', 'export', 'encryption', 'keys', 'security', 'e2e', 'download', 'megolm'],
    page: SettingsPages.DevicesPage,
    pageName: 'Devices',
    sectionName: 'Local Backup',
  },
  {
    id: 'import-keys',
    title: 'Import Messages Data',
    description: 'Restore your encryption keys from a file.',
    keywords: ['backup', 'import', 'restore', 'encryption', 'keys', 'security', 'e2e', 'megolm'],
    page: SettingsPages.DevicesPage,
    pageName: 'Devices',
    sectionName: 'Local Backup',
  },
  // Emojis & Stickers
  {
    id: 'default-pack',
    title: 'Default Pack',
    description: 'Your personal emoji and sticker pack.',
    keywords: ['emoji', 'sticker', 'pack', 'custom', 'emote', 'reaction', 'personal', 'default'],
    page: SettingsPages.EmojisStickersPage,
    pageName: 'Emojis & Stickers',
    sectionName: 'Default Pack',
  },
  {
    id: 'favorite-packs',
    title: 'Favorite Packs',
    description: 'Pick emojis and stickers pack from rooms to use in all rooms.',
    keywords: ['emoji', 'sticker', 'pack', 'custom', 'emote', 'reaction', 'favorite', 'global'],
    page: SettingsPages.EmojisStickersPage,
    pageName: 'Emojis & Stickers',
    sectionName: 'Favorite Packs',
  },
  // Keybinds
  {
    id: 'keybinds',
    title: 'Customize Keyboard Shortcuts',
    description: 'Customize keybinds for sending messages, text formatting, and global actions.',
    keywords: [
      'keybind',
      'keybinds',
      'keyboard',
      'shortcut',
      'shortcuts',
      'hotkey',
      'hotkeys',
      'bind',
      'remap',
      'reset',
    ],
    page: SettingsPages.KeybindsPage,
    pageName: 'Keybinds',
    sectionName: 'Options',
  },
  ...keybindSearchEntries,
  // Developer Tools
  {
    id: 'enable-developer-tools',
    title: 'Enable Developer Tools',
    description: 'Show developer options such as access token, account data and room state.',
    keywords: ['developer', 'debug', 'advanced', 'tools', 'json', 'raw'],
    page: SettingsPages.DeveloperToolsPage,
    pageName: 'Developer Tools',
    sectionName: 'Options',
    Render: DeveloperToolsSetting,
  },
  {
    id: 'access-token',
    title: 'Access Token',
    description: 'Copy access token to clipboard.',
    keywords: ['access token', 'token', 'developer', 'api', 'debug', 'copy', 'credential'],
    page: SettingsPages.DeveloperToolsPage,
    pageName: 'Developer Tools',
    sectionName: 'Options',
  },
  {
    id: 'global-account-data',
    title: 'Account Data',
    description: 'Global account data events stored on your account.',
    keywords: ['account data', 'global', 'json', 'developer', 'debug', 'raw', 'events'],
    page: SettingsPages.DeveloperToolsPage,
    pageName: 'Developer Tools',
    sectionName: 'Account Data',
  },
  // About
  {
    id: 'clear-cache',
    title: 'Clear Cache & Reload',
    description: 'Clear all your locally stored data and reload from server.',
    keywords: [
      'cache',
      'clear',
      'reload',
      'reset',
      'storage',
      'data',
      'refresh',
      'sync',
      'stuck',
      'unread',
    ],
    page: SettingsPages.AboutPage,
    pageName: 'About',
    sectionName: 'Options',
    Render: ClearCacheSetting,
  },
  // Voice & Video
  {
    id: 'microphone-device',
    title: 'Microphone',
    description: 'Microphone to use in voice and video calls.',
    keywords: ['call', 'voice', 'audio', 'microphone', 'mic', 'device', 'input'],
    page: SettingsPages.VoiceVideoPage,
    pageName: 'Voice & Video',
    sectionName: 'Devices',
    Render: MicrophoneDeviceSetting,
  },
  {
    id: 'microphone-input-floor',
    title: 'Input Floor',
    description:
      'Audio quieter than the cutoff is not sent to the call. The bar shows your current input volume.',
    keywords: [
      'call',
      'voice',
      'audio',
      'microphone',
      'mic',
      'input',
      'floor',
      'cutoff',
      'threshold',
      'sensitivity',
      'gate',
      'noise',
      'volume',
      'level',
    ],
    page: SettingsPages.VoiceVideoPage,
    pageName: 'Voice & Video',
    sectionName: 'Devices',
    Render: MicrophoneInputFloorSetting,
  },
  {
    id: 'camera-device',
    title: 'Camera',
    description: 'Camera to use in video calls.',
    keywords: ['call', 'video', 'camera', 'webcam', 'device', 'input'],
    page: SettingsPages.VoiceVideoPage,
    pageName: 'Voice & Video',
    sectionName: 'Devices',
    Render: CameraDeviceSetting,
  },
  {
    id: 'speaker-device',
    title: 'Speaker',
    description: 'Audio output to use in voice and video calls.',
    keywords: ['call', 'voice', 'audio', 'speaker', 'headphone', 'device', 'output', 'sound'],
    page: SettingsPages.VoiceVideoPage,
    pageName: 'Voice & Video',
    sectionName: 'Devices',
    Render: SpeakerDeviceSetting,
  },
  {
    id: 'call-pre-join-screen',
    title: 'Pre-Join Screen',
    description: 'Review your devices on a pre-join screen instead of joining calls instantly.',
    keywords: ['call', 'voice', 'video', 'join', 'pre-join', 'prejoin', 'preview', 'lobby'],
    page: SettingsPages.VoiceVideoPage,
    pageName: 'Voice & Video',
    sectionName: 'Calls',
    Render: PreJoinScreenSetting,
  },
  {
    id: 'device-access',
    title: 'Device Access',
    description: 'Allow microphone and camera access to see your device names.',
    keywords: [
      'device',
      'access',
      'permission',
      'microphone',
      'camera',
      'allow',
      'browser',
      'call',
    ],
    page: SettingsPages.VoiceVideoPage,
    pageName: 'Voice & Video',
    sectionName: 'Devices',
    Render: DeviceAccessCard,
    hasOwnCard: true,
  },
];
