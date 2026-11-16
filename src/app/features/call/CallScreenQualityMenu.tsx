import type { MouseEventHandler, ReactNode } from 'react';
import React, { useState } from 'react';
import type { RectCords } from 'folds';
import { Box, Chip, Icon, Icons, MenuItem, Text, config, toRem } from 'folds';
import type { LocalAudioTrack, LocalVideoTrack } from 'livekit-client';
import { settingsAtom } from '../../state/settings';
import type {
  ScreenshareAudioBitrateKbps,
  ScreenshareMaxFrameRate,
  ScreenshareResolution,
} from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';
import { useCallVideoSenderStats } from '../../hooks/call/useCallVideoSenderStats';
import {
  SCREENSHARE_AUDIO_BITRATE_KBPS_OPTIONS,
  SCREENSHARE_MAX_FRAME_RATE_OPTIONS,
  SCREENSHARE_RESOLUTIONS,
  SCREENSHARE_RESOLUTION_OPTIONS,
  formatKilobitsPerSecond,
  formatScreenshareStreamLine,
} from '../../plugins/call/screenshare';
import { CallSpotlightPopOut } from './CallSpotlightPopOut';

type ScreenshareSenderStatsSummaryProps = {
  videoTrack?: LocalVideoTrack;
  audioTrack?: LocalAudioTrack;
  isScreenshareAudioEnabled: boolean;
};
export function ScreenshareSenderStatsSummary({
  videoTrack,
  audioTrack,
  isScreenshareAudioEnabled,
}: ScreenshareSenderStatsSummaryProps) {
  const senderStats = useCallVideoSenderStats(videoTrack, audioTrack);

  const formatAudioLine = (): string => {
    if (!isScreenshareAudioEnabled) return 'not shared';
    if (senderStats?.audioBitsPerSecond === undefined) return 'unknown';
    return formatKilobitsPerSecond(senderStats.audioBitsPerSecond);
  };

  return (
    <>
      {senderStats && (
        <>
          <Text size="T200" priority="400">
            Capturing{' '}
            {formatScreenshareStreamLine(
              senderStats.captureWidth,
              senderStats.captureHeight,
              senderStats.captureFrameRate
            )}
          </Text>
          <Text size="T200" priority="400">
            Sending{' '}
            {formatScreenshareStreamLine(
              senderStats.frameWidth,
              senderStats.frameHeight,
              senderStats.framesPerSecond
            )}
          </Text>
          <Text size="T200" priority="400">
            Limited by {senderStats.qualityLimitationReason ?? 'unknown'}
          </Text>
        </>
      )}
      <Text size="T200" priority="400">
        Audio {formatAudioLine()}
      </Text>
    </>
  );
}

type CallScreenQualityMenuProps = {
  stats?: ReactNode;
};
export function CallScreenQualityMenu({ stats }: CallScreenQualityMenuProps) {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const [resolution, setResolution] = useSetting(settingsAtom, 'screenshareResolution');
  const [maxFrameRate, setMaxFrameRate] = useSetting(settingsAtom, 'screenshareMaxFrameRate');
  const [audioBitrateKbps, setAudioBitrateKbps] = useSetting(
    settingsAtom,
    'screenshareAudioBitrateKbps'
  );

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  const handleSelectResolution = (nextResolution: ScreenshareResolution) => {
    setResolution(nextResolution);
    setMenuAnchor(undefined);
  };
  const handleSelectMaxFrameRate = (nextMaxFrameRate: ScreenshareMaxFrameRate) => {
    setMaxFrameRate(nextMaxFrameRate);
    setMenuAnchor(undefined);
  };
  const handleSelectAudioBitrate = (nextAudioBitrateKbps: ScreenshareAudioBitrateKbps) => {
    setAudioBitrateKbps(nextAudioBitrateKbps);
    setMenuAnchor(undefined);
  };

  return (
    <CallSpotlightPopOut
      anchor={menuAnchor}
      onClose={() => setMenuAnchor(undefined)}
      content={
        <Box direction="Column" gap="100" style={{ padding: config.space.S200, width: toRem(232) }}>
          {stats && <Box direction="Column">{stats}</Box>}

          <Text size="L400">Resolution</Text>
          {SCREENSHARE_RESOLUTION_OPTIONS.map((resolutionOption) => (
            <MenuItem
              key={resolutionOption}
              size="300"
              variant={resolutionOption === resolution ? 'Primary' : 'Surface'}
              radii="300"
              aria-pressed={resolutionOption === resolution}
              onClick={() => handleSelectResolution(resolutionOption)}
              data-testid="screenshare-resolution-option"
              data-value={resolutionOption}
            >
              <Text size="T300">{SCREENSHARE_RESOLUTIONS[resolutionOption].label}</Text>
            </MenuItem>
          ))}

          <Text size="L400">Max frame rate</Text>
          {SCREENSHARE_MAX_FRAME_RATE_OPTIONS.map((frameRateOption) => (
            <MenuItem
              key={frameRateOption}
              size="300"
              variant={frameRateOption === maxFrameRate ? 'Primary' : 'Surface'}
              radii="300"
              aria-pressed={frameRateOption === maxFrameRate}
              onClick={() => handleSelectMaxFrameRate(frameRateOption)}
              data-testid="screenshare-frame-rate-option"
              data-value={frameRateOption}
            >
              <Text size="T300">{frameRateOption} fps</Text>
            </MenuItem>
          ))}

          <Text size="L400">Audio bitrate</Text>
          {SCREENSHARE_AUDIO_BITRATE_KBPS_OPTIONS.map((audioBitrateOption) => (
            <MenuItem
              key={audioBitrateOption}
              size="300"
              variant={audioBitrateOption === audioBitrateKbps ? 'Primary' : 'Surface'}
              radii="300"
              aria-pressed={audioBitrateOption === audioBitrateKbps}
              onClick={() => handleSelectAudioBitrate(audioBitrateOption)}
              data-testid="screenshare-audio-bitrate-option"
              data-value={audioBitrateOption}
            >
              <Text size="T300">{audioBitrateOption} kbps</Text>
            </MenuItem>
          ))}
        </Box>
      }
    >
      <Chip
        as="button"
        size="400"
        onClick={handleOpenMenu}
        aria-pressed={!!menuAnchor}
        aria-label="Screen Quality"
        data-testid="screenshare-quality-menu"
        variant="SurfaceVariant"
        radii="Pill"
        outlined
        after={<Icon size="50" src={Icons.ChevronBottom} />}
      >
        <Text size="T200">
          {SCREENSHARE_RESOLUTIONS[resolution].label} · {maxFrameRate}fps
        </Text>
      </Chip>
    </CallSpotlightPopOut>
  );
}
