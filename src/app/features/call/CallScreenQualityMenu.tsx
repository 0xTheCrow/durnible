import type { MouseEventHandler } from 'react';
import React, { useState } from 'react';
import type { RectCords } from 'folds';
import { Box, Chip, Icon, Icons, Menu, MenuItem, PopOut, Text, config, toRem } from 'folds';
import FocusTrap from 'focus-trap-react';
import { settingsAtom } from '../../state/settings';
import type { ScreenshareMaxFrameRate, ScreenshareResolution } from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';
import type { ScreenshareSenderStats } from '../../hooks/call/useScreenshareSenderStats';
import {
  SCREENSHARE_MAX_FRAME_RATE_OPTIONS,
  SCREENSHARE_RESOLUTIONS,
  SCREENSHARE_RESOLUTION_OPTIONS,
} from '../../plugins/call/screenshare';
import { stopPropagation } from '../../utils/keyboard';

type CallScreenQualityMenuProps = {
  senderStats?: ScreenshareSenderStats;
};
export function CallScreenQualityMenu({ senderStats }: CallScreenQualityMenuProps) {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const [resolution, setResolution] = useSetting(settingsAtom, 'screenshareResolution');
  const [maxFrameRate, setMaxFrameRate] = useSetting(settingsAtom, 'screenshareMaxFrameRate');

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

  const formatStreamLine = (
    width: number | undefined,
    height: number | undefined,
    frameRate: number | undefined
  ): string => {
    const size = width && height ? `${width}×${height}` : 'unknown';
    const rate = frameRate !== undefined ? `${Math.round(frameRate)} fps` : 'unknown';
    return `${size} · ${rate}`;
  };

  return (
    <PopOut
      anchor={menuAnchor}
      offset={5}
      position="Top"
      align="End"
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: () => setMenuAnchor(undefined),
            clickOutsideDeactivates: true,
            isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
            isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu>
            <Box
              direction="Column"
              gap="100"
              style={{ padding: config.space.S200, width: toRem(232) }}
            >
              {senderStats && (
                <Box direction="Column">
                  <Text size="T200" priority="400">
                    Capturing{' '}
                    {formatStreamLine(
                      senderStats.captureWidth,
                      senderStats.captureHeight,
                      senderStats.captureFrameRate
                    )}
                  </Text>
                  <Text size="T200" priority="400">
                    Sending{' '}
                    {formatStreamLine(
                      senderStats.frameWidth,
                      senderStats.frameHeight,
                      senderStats.framesPerSecond
                    )}
                  </Text>
                  <Text size="T200" priority="400">
                    Limited by {senderStats.qualityLimitationReason ?? 'unknown'}
                  </Text>
                </Box>
              )}

              <Text size="L400">Resolution</Text>
              {SCREENSHARE_RESOLUTION_OPTIONS.map((resolutionOption) => (
                <MenuItem
                  key={resolutionOption}
                  size="300"
                  variant={resolutionOption === resolution ? 'Primary' : 'Surface'}
                  radii="300"
                  aria-pressed={resolutionOption === resolution}
                  onClick={() => handleSelectResolution(resolutionOption)}
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
                >
                  <Text size="T300">{frameRateOption} fps</Text>
                </MenuItem>
              ))}
            </Box>
          </Menu>
        </FocusTrap>
      }
    >
      <Chip
        as="button"
        size="400"
        onClick={handleOpenMenu}
        aria-pressed={!!menuAnchor}
        aria-label="Screen Quality"
        variant="SurfaceVariant"
        radii="Pill"
        outlined
        after={<Icon size="50" src={Icons.ChevronBottom} />}
      >
        <Text size="T200">
          {SCREENSHARE_RESOLUTIONS[resolution].label} · {maxFrameRate}fps
        </Text>
      </Chip>
    </PopOut>
  );
}
