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
import type { CallParticipantSnapshot } from '../../hooks/call/useCallParticipantSnapshots';
import { resolveCallParticipant } from '../../utils/call';
import { stopPropagation } from '../../utils/keyboard';
import { CallControlButton } from './CallControlButton';
import { CallVolumeSlider } from './CallVolumeSlider';

type CallScreenshareVolumeSliderProps = {
  room: Room;
  participantSnapshot: CallParticipantSnapshot;
  memberships: CallMembership[];
};
function CallScreenshareVolumeSlider({
  room,
  participantSnapshot,
  memberships,
}: CallScreenshareVolumeSliderProps) {
  const volumePreferences = useAtomValue(callVolumePreferencesAtom);
  const setUserVolumePreference = useSetAtom(setCallUserVolumePreferenceAtom);
  const { userId, displayName } = resolveCallParticipant(
    room,
    participantSnapshot.participant.identity,
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
  participantSnapshots: CallParticipantSnapshot[];
  memberships: CallMembership[];
  size?: ComponentProps<typeof CallControlButton>['size'];
  iconSize?: ComponentProps<typeof CallControlButton>['iconSize'];
};
export function CallMasterVolumeMenu({
  room,
  participantSnapshots,
  memberships,
  size = '400',
  iconSize,
}: CallMasterVolumeMenuProps) {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const { masterVolumeLevel } = useAtomValue(callVolumePreferencesAtom);
  const setMasterVolumeLevel = useSetAtom(setCallMasterVolumeLevelAtom);

  const screenshareParticipantSnapshots = participantSnapshots.filter(
    (participantSnapshot) =>
      !participantSnapshot.participant.isLocal && participantSnapshot.isScreenshareAudioEnabled
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
            {screenshareParticipantSnapshots.map((participantSnapshot) => (
              <CallScreenshareVolumeSlider
                key={participantSnapshot.key}
                room={room}
                participantSnapshot={participantSnapshot}
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
