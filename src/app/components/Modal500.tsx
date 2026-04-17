import type { ReactNode } from 'react';
import React from 'react';
import { Modal } from 'folds';
import { OverlayModal } from './OverlayModal';

type Modal500Props = {
  onClose: () => void;
  children: ReactNode;
};
export function Modal500({ onClose, children }: Modal500Props) {
  return (
    <OverlayModal open onClose={onClose}>
      <Modal size="500" variant="Background">
        {children}
      </Modal>
    </OverlayModal>
  );
}
