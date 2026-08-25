import type { MouseEventHandler } from 'react';
import React, { useState } from 'react';
import type { RectCords } from 'folds';
import { Box, Button, config, Icon, Icons, Menu, MenuItem, PopOut, Text } from 'folds';
import FocusTrap from 'focus-trap-react';
import type { NotificationSoundId } from '../../../state/settings';
import { stopPropagation } from '../../../utils/keyboard';
import {
  NOTIFICATION_SOUND_OPTIONS,
  getNotificationSoundName,
  getNotificationSoundUrl,
} from '../../../plugins/notificationSounds';

type SelectNotificationSoundProps = {
  soundId: NotificationSoundId;
  disabled?: boolean;
  onSelect: (soundId: NotificationSoundId) => void;
};

export function SelectNotificationSound({
  soundId,
  disabled,
  onSelect,
}: SelectNotificationSoundProps) {
  const [menuCords, setMenuCords] = useState<RectCords>();

  const handleMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuCords(evt.currentTarget.getBoundingClientRect());
  };

  const handleSelect = (selectedSoundId: NotificationSoundId) => {
    onSelect(selectedSoundId);
    setMenuCords(undefined);

    const previewAudio = new Audio(getNotificationSoundUrl(selectedSoundId));
    previewAudio.play();
  };

  return (
    <>
      <Button
        size="300"
        variant="Secondary"
        outlined
        fill="Soft"
        radii="300"
        disabled={disabled}
        after={<Icon size="300" src={Icons.ChevronBottom} />}
        onClick={handleMenu}
      >
        <Text size="T300">{getNotificationSoundName(soundId)}</Text>
      </Button>
      <PopOut
        anchor={menuCords}
        offset={5}
        position="Bottom"
        align="End"
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setMenuCords(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowDown' || evt.key === 'ArrowRight',
              isKeyBackward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowUp' || evt.key === 'ArrowLeft',
              escapeDeactivates: stopPropagation,
            }}
          >
            <Menu>
              <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                {NOTIFICATION_SOUND_OPTIONS.map((optionSoundId) => (
                  <MenuItem
                    key={optionSoundId}
                    size="300"
                    variant={soundId === optionSoundId ? 'Primary' : 'Surface'}
                    radii="300"
                    onClick={() => handleSelect(optionSoundId)}
                  >
                    <Text size="T300">{getNotificationSoundName(optionSoundId)}</Text>
                  </MenuItem>
                ))}
              </Box>
            </Menu>
          </FocusTrap>
        }
      />
    </>
  );
}
