import type { ReactNode } from 'react';
import React from 'react';
import { Modal } from 'folds';
import type { Options as FocusTrapOptions } from 'focus-trap';
import { OverlayModal } from './OverlayModal';

type Modal500Props = {
  onClose: () => void;
  children: ReactNode;
  focusTrapOptions?: Partial<FocusTrapOptions>;
};
export function Modal500({ onClose, children, focusTrapOptions }: Modal500Props) {
  return (
    <OverlayModal open onClose={onClose} focusTrapOptions={focusTrapOptions}>
      <Modal size="500" variant="Background">
        {children}
      </Modal>
    </OverlayModal>
  );
}
