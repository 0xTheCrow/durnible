import type { MouseEventHandler } from 'react';
import React, { useState } from 'react';
import type { RectCords } from 'folds';
import { Icons, Menu, PopOut } from 'folds';
import FocusTrap from 'focus-trap-react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  CALL_VOLUME_LEVEL_MIN,
  callVolumePreferencesAtom,
  setCallMasterVolumeLevelAtom,
} from '../../state/callVolumePreferences';
import { stopPropagation } from '../../utils/keyboard';
import { CallControlButton } from './CallControlButton';
import { CallVolumeSlider } from './CallVolumeSlider';

export function CallMasterVolumeMenu() {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const { masterVolumeLevel } = useAtomValue(callVolumePreferencesAtom);
  const setMasterVolumeLevel = useSetAtom(setCallMasterVolumeLevelAtom);

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
          </Menu>
        </FocusTrap>
      }
    >
      <CallControlButton
        size="400"
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
