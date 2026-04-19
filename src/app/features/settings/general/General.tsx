import type { MouseEventHandler } from 'react';
import React, { useState } from 'react';
import type { RectCords } from 'folds';
import { Box, Button, Chip, config, Icon, Icons, PopOut, Scroll, Switch, Text } from 'folds';
import FocusTrap from 'focus-trap-react';
import { Page, PageContent } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { SettingTile } from '../../../components/setting-tile';
import { KeySymbol } from '../../../utils/key-symbol';
import { isMacOS } from '../../../utils/user-agent';
import type { Theme } from '../../../hooks/useTheme';
import {
  DarkTheme,
  LightTheme,
  ThemeKind,
  useSystemThemeKind,
  useThemeNames,
  useThemes,
} from '../../../hooks/useTheme';
import { stopPropagation } from '../../../utils/keyboard';
import { SequenceCardStyle } from '../styles.css';
import {
  SelectTheme,
  ThemeSelector,
  PageZoomInput,
  SelectDateFormat,
  SelectMessageLayout,
  SelectMessageSpacing,
  SettingsPageHeader,
} from '../components';

function SystemThemePreferences() {
  const themeKind = useSystemThemeKind();
  const themeNames = useThemeNames();
  const themes = useThemes();
  const [lightThemeId, setLightThemeId] = useSetting(settingsAtom, 'lightThemeId');
  const [darkThemeId, setDarkThemeId] = useSetting(settingsAtom, 'darkThemeId');

  const lightThemes = themes.filter((theme) => theme.kind === ThemeKind.Light);
  const darkThemes = themes.filter((theme) => theme.kind === ThemeKind.Dark);

  const selectedLightTheme = lightThemes.find((theme) => theme.id === lightThemeId) ?? LightTheme;
  const selectedDarkTheme = darkThemes.find((theme) => theme.id === darkThemeId) ?? DarkTheme;

  const [ltCords, setLTCords] = useState<RectCords>();
  const [dtCords, setDTCords] = useState<RectCords>();

  const handleLightThemeMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setLTCords(evt.currentTarget.getBoundingClientRect());
  };
  const handleDarkThemeMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setDTCords(evt.currentTarget.getBoundingClientRect());
  };

  const handleLightThemeSelect = (theme: Theme) => {
    setLightThemeId(theme.id);
    setLTCords(undefined);
  };

  const handleDarkThemeSelect = (theme: Theme) => {
    setDarkThemeId(theme.id);
    setDTCords(undefined);
  };

  return (
    <Box wrap="Wrap" gap="400">
      <SettingTile
        title="Light Theme:"
        after={
          <Chip
            variant={themeKind === ThemeKind.Light ? 'Primary' : 'Secondary'}
            outlined={themeKind === ThemeKind.Light}
            radii="Pill"
            after={<Icon size="200" src={Icons.ChevronBottom} />}
            onClick={handleLightThemeMenu}
          >
            <Text size="B300">{themeNames[selectedLightTheme.id] ?? selectedLightTheme.id}</Text>
          </Chip>
        }
      />
      <PopOut
        anchor={ltCords}
        offset={5}
        position="Bottom"
        align="End"
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setLTCords(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowDown' || evt.key === 'ArrowRight',
              isKeyBackward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowUp' || evt.key === 'ArrowLeft',
              escapeDeactivates: stopPropagation,
            }}
          >
            <ThemeSelector
              themeNames={themeNames}
              themes={lightThemes}
              selected={selectedLightTheme}
              onSelect={handleLightThemeSelect}
            />
          </FocusTrap>
        }
      />
      <SettingTile
        title="Dark Theme:"
        after={
          <Chip
            variant={themeKind === ThemeKind.Dark ? 'Primary' : 'Secondary'}
            outlined={themeKind === ThemeKind.Dark}
            radii="Pill"
            after={<Icon size="200" src={Icons.ChevronBottom} />}
            onClick={handleDarkThemeMenu}
          >
            <Text size="B300">{themeNames[selectedDarkTheme.id] ?? selectedDarkTheme.id}</Text>
          </Chip>
        }
      />
      <PopOut
        anchor={dtCords}
        offset={5}
        position="Bottom"
        align="End"
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setDTCords(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowDown' || evt.key === 'ArrowRight',
              isKeyBackward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowUp' || evt.key === 'ArrowLeft',
              escapeDeactivates: stopPropagation,
            }}
          >
            <ThemeSelector
              themeNames={themeNames}
              themes={darkThemes}
              selected={selectedDarkTheme}
              onSelect={handleDarkThemeSelect}
            />
          </FocusTrap>
        }
      />
    </Box>
  );
}

function Appearance() {
  const [systemTheme, setSystemTheme] = useSetting(settingsAtom, 'useSystemTheme');
  const [monochromeMode, setMonochromeMode] = useSetting(settingsAtom, 'monochromeMode');
  const [twitterEmoji, setTwitterEmoji] = useSetting(settingsAtom, 'twitterEmoji');
  const [emojiSearchAutoFocusMobile, setEmojiSearchAutoFocusMobile] = useSetting(
    settingsAtom,
    'emojiSearchAutoFocusMobile'
  );
  const [emojiSearchAutoFocusDesktop, setEmojiSearchAutoFocusDesktop] = useSetting(
    settingsAtom,
    'emojiSearchAutoFocusDesktop'
  );

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Appearance</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="System Theme"
          description="Choose between light and dark theme based on system preference."
          after={<Switch variant="Primary" value={systemTheme} onChange={setSystemTheme} />}
        />
        {systemTheme && <SystemThemePreferences />}
      </SequenceCard>

      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Theme"
          description="Theme to use when system theme is not enabled."
          after={<SelectTheme disabled={systemTheme} />}
        />
      </SequenceCard>

      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Monochrome Mode"
          after={<Switch variant="Primary" value={monochromeMode} onChange={setMonochromeMode} />}
        />
      </SequenceCard>

      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Twitter Emoji"
          after={<Switch variant="Primary" value={twitterEmoji} onChange={setTwitterEmoji} />}
        />
      </SequenceCard>

      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Emoji Search Auto Focus"
          description="Focus the emoji board search input when opened."
        />
        <Box direction="Column" gap="100">
          <SettingTile
            title="Desktop"
            after={
              <Switch
                variant="Primary"
                value={emojiSearchAutoFocusDesktop}
                onChange={setEmojiSearchAutoFocusDesktop}
              />
            }
          />
          <SettingTile
            title="Mobile"
            after={
              <Switch
                variant="Primary"
                value={emojiSearchAutoFocusMobile}
                onChange={setEmojiSearchAutoFocusMobile}
              />
            }
          />
        </Box>
      </SequenceCard>

      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile title="Page Zoom" after={<PageZoomInput />} />
      </SequenceCard>
    </Box>
  );
}

function DateAndTime() {
  const [hour24Clock, setHour24Clock] = useSetting(settingsAtom, 'hour24Clock');

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Date & Time</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="24-Hour Time Format"
          after={<Switch variant="Primary" value={hour24Clock} onChange={setHour24Clock} />}
        />
      </SequenceCard>

      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SelectDateFormat />
      </SequenceCard>
    </Box>
  );
}

function Editor() {
  const [enterForNewline, setEnterForNewline] = useSetting(settingsAtom, 'enterForNewline');
  const [isMarkdown, setIsMarkdown] = useSetting(settingsAtom, 'isMarkdown');
  const [hideActivity, setHideActivity] = useSetting(settingsAtom, 'hideActivity');

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Editor</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="ENTER for Newline"
          description={`Use ${
            isMacOS() ? KeySymbol.Command : 'Ctrl'
          } + ENTER to send message and ENTER for newline.`}
          after={<Switch variant="Primary" value={enterForNewline} onChange={setEnterForNewline} />}
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Markdown Formatting"
          after={<Switch variant="Primary" value={isMarkdown} onChange={setIsMarkdown} />}
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Hide Typing & Read Receipts"
          description="Turn off both typing status and read receipts to keep your activity private."
          after={<Switch variant="Primary" value={hideActivity} onChange={setHideActivity} />}
        />
      </SequenceCard>
    </Box>
  );
}

function Messages() {
  const [legacyUsernameColor, setLegacyUsernameColor] = useSetting(
    settingsAtom,
    'legacyUsernameColor'
  );
  const [hideMembershipEvents, setHideMembershipEvents] = useSetting(
    settingsAtom,
    'hideMembershipEvents'
  );
  const [hideNickAvatarEvents, setHideNickAvatarEvents] = useSetting(
    settingsAtom,
    'hideNickAvatarEvents'
  );
  const [pauseGifs, setPauseGifs] = useSetting(settingsAtom, 'pauseGifs');
  const [mediaAutoLoad, setMediaAutoLoad] = useSetting(settingsAtom, 'mediaAutoLoad');
  const [urlPreview, setUrlPreview] = useSetting(settingsAtom, 'urlPreview');
  const [encUrlPreview, setEncUrlPreview] = useSetting(settingsAtom, 'encUrlPreview');
  const [embedYouTube, setEmbedYouTube] = useSetting(settingsAtom, 'embedYouTube');
  const [embedSpotify, setEmbedSpotify] = useSetting(settingsAtom, 'embedSpotify');
  const [embedSoundCloud, setEmbedSoundCloud] = useSetting(settingsAtom, 'embedSoundCloud');
  const [embedNitter, setEmbedNitter] = useSetting(settingsAtom, 'embedNitter');
  const [embedLinks, setEmbedLinks] = useSetting(settingsAtom, 'embedLinks');
  const [showEmbedToggles, setShowEmbedToggles] = useState(false);
  const [showHiddenEvents, setShowHiddenEvents] = useSetting(settingsAtom, 'showHiddenEvents');
  const [unfocusedAutoScroll, setUnfocusedAutoScroll] = useSetting(
    settingsAtom,
    'unfocusedAutoScroll'
  );
  const [replyHighlight, setReplyHighlight] = useSetting(settingsAtom, 'replyHighlight');

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Messages</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile title="Message Layout" after={<SelectMessageLayout />} />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile title="Message Spacing" after={<SelectMessageSpacing />} />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Legacy Username Color"
          after={
            <Switch
              variant="Primary"
              value={legacyUsernameColor}
              onChange={setLegacyUsernameColor}
            />
          }
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Hide Membership Change"
          after={
            <Switch
              variant="Primary"
              value={hideMembershipEvents}
              onChange={setHideMembershipEvents}
            />
          }
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Hide Profile Change"
          after={
            <Switch
              variant="Primary"
              value={hideNickAvatarEvents}
              onChange={setHideNickAvatarEvents}
            />
          }
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Disable Media Auto Load"
          after={
            <Switch
              variant="Primary"
              value={!mediaAutoLoad}
              onChange={(v) => setMediaAutoLoad(!v)}
            />
          }
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Url Preview"
          after={<Switch variant="Primary" value={urlPreview} onChange={setUrlPreview} />}
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Url Preview in Encrypted Room"
          after={<Switch variant="Primary" value={encUrlPreview} onChange={setEncUrlPreview} />}
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Show Embed Links"
          description="Show a clean, tracking-free link for each embed. Enables link cards even when embeds are off."
          after={<Switch variant="Primary" value={embedLinks} onChange={setEmbedLinks} />}
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Embed Types"
          description="Toggle individual embed types."
          after={
            <Button
              onClick={() => setShowEmbedToggles(!showEmbedToggles)}
              variant="Secondary"
              fill="Soft"
              size="300"
              radii="300"
              outlined
              before={
                <Icon
                  src={showEmbedToggles ? Icons.ChevronTop : Icons.ChevronBottom}
                  size="100"
                  filled
                />
              }
            >
              <Text size="B300">{showEmbedToggles ? 'Collapse' : 'Expand'}</Text>
            </Button>
          }
        />
        {showEmbedToggles && (
          <Box direction="Column" gap="100" style={{ paddingTop: config.space.S100 }}>
            <SettingTile
              title="YouTube"
              after={<Switch variant="Primary" value={embedYouTube} onChange={setEmbedYouTube} />}
            />
            <SettingTile
              title="Spotify"
              after={<Switch variant="Primary" value={embedSpotify} onChange={setEmbedSpotify} />}
            />
            <SettingTile
              title="SoundCloud"
              after={
                <Switch variant="Primary" value={embedSoundCloud} onChange={setEmbedSoundCloud} />
              }
            />
            <SettingTile
              title="Twitter / X (Nitter)"
              after={<Switch variant="Primary" value={embedNitter} onChange={setEmbedNitter} />}
            />
          </Box>
        )}
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Show Hidden Events"
          after={
            <Switch variant="Primary" value={showHiddenEvents} onChange={setShowHiddenEvents} />
          }
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Auto-scroll When Unfocused"
          description="Keep auto-scrolling to new messages even when the window is not focused."
          after={
            <Switch
              variant="Primary"
              value={unfocusedAutoScroll}
              onChange={setUnfocusedAutoScroll}
            />
          }
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Play GIFs on Hover"
          description="GIFs are paused by default and only animate while hovered."
          after={<Switch variant="Primary" value={pauseGifs} onChange={setPauseGifs} />}
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Reply & Mention Highlighting"
          description="Highlight messages that reply to you or mention you by @username."
          after={<Switch variant="Primary" value={replyHighlight} onChange={setReplyHighlight} />}
        />
      </SequenceCard>
    </Box>
  );
}

function Advanced() {
  const [pwaMode, setPwaMode] = useSetting(settingsAtom, 'pwaMode');
  const [swipeGestures, setSwipeGestures] = useSetting(settingsAtom, 'swipeGestures');

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Advanced</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Swipe Gestures"
          description="Enable swipe gestures on mobile and tablet, such as swiping to open the room drawer."
          after={<Switch variant="Primary" value={swipeGestures} onChange={setSwipeGestures} />}
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="PWA Mode"
          description="Show update notifications when a new version is available."
          after={<Switch variant="Primary" value={pwaMode} onChange={setPwaMode} />}
        />
      </SequenceCard>
    </Box>
  );
}

type GeneralProps = {
  onBack: () => void;
  onClose: () => void;
};
export function General({ onBack, onClose }: GeneralProps) {
  return (
    <Page>
      <SettingsPageHeader title="General" onBack={onBack} onClose={onClose} />
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <Appearance />
              <DateAndTime />
              <Editor />
              <Messages />
              <Advanced />
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
