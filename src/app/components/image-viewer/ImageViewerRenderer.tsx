import React from 'react';
import { useAtom } from 'jotai';
import { Modal } from 'folds';
import { imageViewerAtom } from '../../state/imageViewer';
import { ImageViewer } from './ImageViewer';
import { ImageViewerModal } from '../../styles/Modal.css';
import { OverlayModal } from '../OverlayModal';

export function ImageViewerRenderer() {
  const [viewerState, setViewerState] = useAtom(imageViewerAtom);
  const open = viewerState !== undefined;

  const requestClose = () => setViewerState(undefined);

  return (
    <OverlayModal
      open={open}
      requestClose={requestClose}
    >
      <Modal
        className={ImageViewerModal}
        size="500"
        onContextMenu={(evt: any) => evt.stopPropagation()}
      >
        {viewerState && (
          <ImageViewer
            src={viewerState.src}
            alt={viewerState.alt}
            requestClose={requestClose}
          />
        )}
      </Modal>
    </OverlayModal>
  );
}
