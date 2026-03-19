import React, { ReactNode } from 'react';
import { Modal } from 'folds';
import { OverlayModal } from './OverlayModal';

type Modal500Props = {
  requestClose: () => void;
  children: ReactNode;
};
export function Modal500({ requestClose, children }: Modal500Props) {
  return (
    <OverlayModal open requestClose={requestClose}>
      <Modal size="500" variant="Background">
        {children}
      </Modal>
    </OverlayModal>
  );
}
