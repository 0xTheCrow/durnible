import type { ReactNode } from 'react';
import React, { useRef } from 'react';
import type { RectCords } from 'folds';
import { Menu, PopOut } from 'folds';
import FocusTrap from 'focus-trap-react';
import { stopPropagation } from '../../utils/keyboard';

type CallSpotlightPopOutProps = {
  anchor?: RectCords;
  onClose: () => void;
  content: ReactNode;
  children: ReactNode;
};
export function CallSpotlightPopOut({
  anchor,
  onClose,
  content,
  children,
}: CallSpotlightPopOutProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <PopOut
      anchor={anchor}
      offset={5}
      position="Top"
      align="End"
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            fallbackFocus: () => menuRef.current ?? document.body,
            onDeactivate: onClose,
            clickOutsideDeactivates: true,
            isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
            isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu ref={menuRef} tabIndex={-1}>
            {content}
          </Menu>
        </FocusTrap>
      }
    >
      {children}
    </PopOut>
  );
}
