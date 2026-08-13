import React from 'react';
import { Icon, Icons, MenuItem, Text } from 'folds';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';

type PageNavLayoutMenuItemsProps = {
  isDrawerMode?: boolean;
  onClose: () => void;
};
export function PageNavLayoutMenuItems({ isDrawerMode, onClose }: PageNavLayoutMenuItemsProps) {
  const screenSize = useScreenSizeContext();
  const [isCollapsed, setIsCollapsed] = useSetting(settingsAtom, 'isPageNavCollapsed');
  const [isResizeEnabled, setIsResizeEnabled] = useSetting(settingsAtom, 'isPageNavResizeEnabled');

  if (isDrawerMode || screenSize === ScreenSize.Mobile) return null;

  return (
    <>
      <MenuItem
        onClick={() => {
          setIsResizeEnabled(!isResizeEnabled);
          onClose();
        }}
        size="300"
        after={isResizeEnabled ? <Icon size="100" src={Icons.Check} /> : undefined}
        radii="300"
        aria-pressed={isResizeEnabled}
        data-testid="page-nav-resize-toggle"
      >
        <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
          Resize Panel
        </Text>
      </MenuItem>
      <MenuItem
        onClick={() => {
          setIsCollapsed(true);
          onClose();
        }}
        size="300"
        after={<Icon size="100" src={Icons.ChevronLeft} />}
        radii="300"
        aria-disabled={isCollapsed}
        data-testid="page-nav-collapse-item"
      >
        <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
          Collapse Panel
        </Text>
      </MenuItem>
    </>
  );
}
