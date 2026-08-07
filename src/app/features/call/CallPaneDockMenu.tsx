import React, { useState } from 'react';
import type { IconSrc, RectCords } from 'folds';
import { Box, Icon, IconButton, Icons, Menu, MenuItem, PopOut, Text, config } from 'folds';
import FocusTrap from 'focus-trap-react';
import type { CallPaneDock } from '../../state/settings';
import { stopPropagation } from '../../utils/keyboard';

const DOCK_OPTIONS: { dock: CallPaneDock; label: string; icon: IconSrc }[] = [
  { dock: 'Left', label: 'Dock Left', icon: Icons.ArrowLeft },
  { dock: 'Right', label: 'Dock Right', icon: Icons.ArrowRight },
  { dock: 'Top', label: 'Dock Top', icon: Icons.ArrowTop },
  { dock: 'Bottom', label: 'Dock Bottom', icon: Icons.ArrowBottom },
];

type CallPaneDockMenuProps = {
  dock: CallPaneDock;
  availableDocks: CallPaneDock[];
  onDock: (dock: CallPaneDock) => void;
};
export function CallPaneDockMenu({ dock, availableDocks, onDock }: CallPaneDockMenuProps) {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const handleSelect = (nextDock: CallPaneDock) => {
    onDock(nextDock);
    setMenuAnchor(undefined);
  };

  return (
    <PopOut
      anchor={menuAnchor}
      offset={5}
      position="Bottom"
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
            <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
              {DOCK_OPTIONS.filter((option) => availableDocks.includes(option.dock)).map(
                (option) => (
                  <MenuItem
                    key={option.dock}
                    size="300"
                    variant={option.dock === dock ? 'Primary' : 'Surface'}
                    radii="300"
                    before={<Icon size="100" src={option.icon} />}
                    onClick={() => handleSelect(option.dock)}
                  >
                    <Text size="T300">{option.label}</Text>
                  </MenuItem>
                )
              )}
            </Box>
          </Menu>
        </FocusTrap>
      }
    >
      <IconButton
        size="300"
        radii="300"
        onClick={(evt) => setMenuAnchor(evt.currentTarget.getBoundingClientRect())}
        aria-pressed={!!menuAnchor}
        aria-label="Move Call Panel"
      >
        <Icon size="100" src={Icons.Category} />
      </IconButton>
    </PopOut>
  );
}
