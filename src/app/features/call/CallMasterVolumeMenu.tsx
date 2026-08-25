import type { ComponentProps, MouseEventHandler } from 'react';
import React, { useState } from 'react';
import type { Room } from 'matrix-js-sdk';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';
import type { RectCords } from 'folds';
import { Icons, Menu, PopOut } from 'folds';
import FocusTrap from 'focus-trap-react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  CALL_VOLUME_LEVEL_MIN,
  callVolumePreferencesAtom,
  getCallUserVolumePreference,
  setCallMasterVolumeLevelAtom,
  setCallUserVolumePreferenceAtom,
} from '../../state/callVolumePreferences';
import type { CallParticipantEntry } from '../../hooks/call/useCallParticipantEntries';
import { resolveCallParticipant } from '../../utils/call';
import { stopPropagation } from '../../utils/keyboard';
import { CallControlButton } from './CallControlButton';
import { CallVolumeSlider } from './CallVolumeSlider';

type CallScreenshareVolumeSliderProps = {
  room: Room;
  entry: CallParticipantEntry;
  memberships: CallMembership[];
};
function CallScreenshareVolumeSlider({
  room,
  entry,
  memberships,
}: CallScreenshareVolumeSliderProps) {
  const volumePreferences = useAtomValue(callVolumePreferencesAtom);
  const setUserVolumePreference = useSetAtom(setCallUserVolumePreferenceAtom);
  const { userId, displayName } = resolveCallParticipant(
    room,
    entry.participant.identity,
    memberships
  );

  if (!userId) return null;
  const { screenshareVolumeLevel, isScreenshareMuted } = getCallUserVolumePreference(
    volumePreferences,
    userId
  );

  return (
    <CallVolumeSlider
      label={`${displayName}'s Screen`}
      volumeLevel={screenshareVolumeLevel}
      isDisabled={isScreenshareMuted}
      isMuted={isScreenshareMuted}
      muteLabel={isScreenshareMuted ? 'Unmute Screen' : 'Mute Screen'}
      onToggleMute={() =>
        setUserVolumePreference({
          userId,
          preference: { isScreenshareMuted: !isScreenshareMuted },
          isCommit: true,
        })
      }
      onChange={(volumeLevel) =>
        setUserVolumePreference({
          userId,
          preference: { screenshareVolumeLevel: volumeLevel },
          isCommit: false,
        })
      }
      onCommit={(volumeLevel) =>
        setUserVolumePreference({
          userId,
          preference: { screenshareVolumeLevel: volumeLevel },
          isCommit: true,
        })
      }
    />
  );
}

type CallMasterVolumeMenuProps = {
  room: Room;
  entries: CallParticipantEntry[];
  memberships: CallMembership[];
  size?: ComponentProps<typeof CallControlButton>['size'];
  iconSize?: ComponentProps<typeof CallControlButton>['iconSize'];
};
export function CallMasterVolumeMenu({
  room,
  entries,
  memberships,
  size = '400',
  iconSize,
}: CallMasterVolumeMenuProps) {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const { masterVolumeLevel } = useAtomValue(callVolumePreferencesAtom);
  const setMasterVolumeLevel = useSetAtom(setCallMasterVolumeLevelAtom);

  const screenshareEntries = entries.filter(
    (entry) => !entry.participant.isLocal && entry.isScreenshareAudioEnabled
  );

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  return (
    <PopOut
      anchor={menuAnchor}
      offset={5}
      position="Top"
      align="Center"
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: () => setMenuAnchor(undefined),
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu>
            <CallVolumeSlider
              label="Call Volume"
              volumeLevel={masterVolumeLevel}
              onChange={(volumeLevel) => setMasterVolumeLevel({ volumeLevel, isCommit: false })}
              onCommit={(volumeLevel) => setMasterVolumeLevel({ volumeLevel, isCommit: true })}
            />
            {screenshareEntries.map((entry) => (
              <CallScreenshareVolumeSlider
                key={entry.key}
                room={room}
                entry={entry}
                memberships={memberships}
              />
            ))}
          </Menu>
        </FocusTrap>
      }
    >
      <CallControlButton
        size={size}
        iconSize={iconSize}
        radii="Pill"
        variant="SurfaceVariant"
        onClick={handleOpenMenu}
        aria-pressed={!!menuAnchor}
        label="Call Volume"
        icon={masterVolumeLevel === CALL_VOLUME_LEVEL_MIN ? Icons.VolumeMute : Icons.VolumeHigh}
      />
    </PopOut>
  );
}
