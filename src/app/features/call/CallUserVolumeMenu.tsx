import React from 'react';
import type { RectCords } from 'folds';
import { Box, Icon, Icons, Menu, MenuItem, PopOut, Text, config } from 'folds';
import FocusTrap from 'focus-trap-react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  callVolumePreferencesAtom,
  getCallUserVolumePreference,
  setCallUserVolumePreferenceAtom,
} from '../../state/callVolumePreferences';
import { stopPropagation } from '../../utils/keyboard';
import { CallVolumeSlider } from './CallVolumeSlider';

type CallUserVolumeMenuProps = {
  userId: string;
  displayName: string;
  isScreenshareAudioEnabled: boolean;
  anchor: RectCords;
  onClose: () => void;
};
export function CallUserVolumeMenu({
  userId,
  displayName,
  isScreenshareAudioEnabled,
  anchor,
  onClose,
}: CallUserVolumeMenuProps) {
  const volumePreferences = useAtomValue(callVolumePreferencesAtom);
  const setUserVolumePreference = useSetAtom(setCallUserVolumePreferenceAtom);
  const { volumeLevel, isMuted, screenshareVolumeLevel, isScreenshareMuted } =
    getCallUserVolumePreference(volumePreferences, userId);

  return (
    <PopOut
      anchor={anchor}
      offset={anchor.width === 0 ? 0 : undefined}
      position="Bottom"
      align={anchor.width === 0 ? 'Start' : 'End'}
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: onClose,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu>
            <Box direction="Column" style={{ padding: config.space.S100 }}>
              <MenuItem
                size="300"
                variant={isMuted ? 'Critical' : 'Surface'}
                radii="300"
                before={<Icon size="100" src={isMuted ? Icons.VolumeMute : Icons.VolumeHigh} />}
                aria-pressed={isMuted}
                onClick={() =>
                  setUserVolumePreference({
                    userId,
                    preference: { isMuted: !isMuted },
                    isCommit: true,
                  })
                }
              >
                <Text size="T300">{isMuted ? 'Unmute' : 'Mute'}</Text>
              </MenuItem>
              <CallVolumeSlider
                label={displayName}
                volumeLevel={volumeLevel}
                isDisabled={isMuted}
                onChange={(nextVolumeLevel) =>
                  setUserVolumePreference({
                    userId,
                    preference: { volumeLevel: nextVolumeLevel },
                    isCommit: false,
                  })
                }
                onCommit={(nextVolumeLevel) =>
                  setUserVolumePreference({
                    userId,
                    preference: { volumeLevel: nextVolumeLevel },
                    isCommit: true,
                  })
                }
              />
              {isScreenshareAudioEnabled && (
                <>
                  <MenuItem
                    size="300"
                    variant={isScreenshareMuted ? 'Critical' : 'Surface'}
                    radii="300"
                    before={
                      <Icon
                        size="100"
                        src={isScreenshareMuted ? Icons.VolumeMute : Icons.VolumeHigh}
                      />
                    }
                    aria-pressed={isScreenshareMuted}
                    onClick={() =>
                      setUserVolumePreference({
                        userId,
                        preference: { isScreenshareMuted: !isScreenshareMuted },
                        isCommit: true,
                      })
                    }
                  >
                    <Text size="T300">{isScreenshareMuted ? 'Unmute Screen' : 'Mute Screen'}</Text>
                  </MenuItem>
                  <CallVolumeSlider
                    label={`${displayName}'s Screen`}
                    volumeLevel={screenshareVolumeLevel}
                    isDisabled={isScreenshareMuted}
                    onChange={(nextVolumeLevel) =>
                      setUserVolumePreference({
                        userId,
                        preference: { screenshareVolumeLevel: nextVolumeLevel },
                        isCommit: false,
                      })
                    }
                    onCommit={(nextVolumeLevel) =>
                      setUserVolumePreference({
                        userId,
                        preference: { screenshareVolumeLevel: nextVolumeLevel },
                        isCommit: true,
                      })
                    }
                  />
                </>
              )}
            </Box>
          </Menu>
        </FocusTrap>
      }
    />
  );
}
