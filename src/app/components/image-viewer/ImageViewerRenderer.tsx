import React from 'react';
import { useAtom } from 'jotai';
import { Modal, Overlay, OverlayBackdrop, OverlayCenter } from 'folds';
import FocusTrap from 'focus-trap-react';
import { imageViewerAtom } from '../../state/imageViewer';
import { ImageViewer } from './ImageViewer';
import { ImageViewerModal } from '../../styles/Modal.css';
import { stopPropagation } from '../../utils/keyboard';

export function ImageViewerRenderer() {
  const [viewerState, setViewerState] = useAtom(imageViewerAtom);
  const open = viewerState !== undefined;

  const requestClose = () => setViewerState(undefined);

  return (
    <Overlay open={open} backdrop={<OverlayBackdrop />}>
      <OverlayCenter
        onPointerDown={(e: React.PointerEvent) => {
          e.preventDefault();
          e.stopPropagation();
          requestClose();
        }}
      >
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: requestClose,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Modal
            className={ImageViewerModal}
            size="500"
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
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
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
