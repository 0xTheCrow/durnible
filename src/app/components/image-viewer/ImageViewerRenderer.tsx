import React, { useCallback } from 'react';
import { useAtom } from 'jotai';
import { Modal } from 'folds';
import type { ImageViewerGalleryItem } from '../../state/imageViewer';
import { imageViewerAtom } from '../../state/imageViewer';
import { ImageViewer } from './ImageViewer';
import { ImageViewerModal } from '../../styles/Modal.css';
import { OverlayModal } from '../OverlayModal';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { decryptFile, downloadEncryptedMedia, mxcUrlToHttp } from '../../utils/matrix';
import { FALLBACK_MIMETYPE } from '../../utils/mimeTypes';

export function ImageViewerRenderer() {
  const [viewerState, setViewerState] = useAtom(imageViewerAtom);
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const open = viewerState !== undefined;

  const requestClose = () => setViewerState(undefined);

  // Resolves a gallery item's mxc URL (and decrypts if needed) into an http
  // src the viewer can display. Lives here so ImageViewer.tsx stays free of
  // matrix-client dependencies.
  const resolveSrc = useCallback(
    async (item: ImageViewerGalleryItem): Promise<string> => {
      if (item.src) return item.src;
      if (typeof item.mxcUrl !== 'string') {
        throw new Error('Gallery item missing both src and mxcUrl');
      }
      const httpUrl = mxcUrlToHttp(mx, item.mxcUrl, useAuthentication) ?? item.mxcUrl;
      const enc = item.encInfo;
      if (enc) {
        const blob = await downloadEncryptedMedia(httpUrl, (encBuf) =>
          decryptFile(encBuf, item.mimeType ?? FALLBACK_MIMETYPE, enc)
        );
        return URL.createObjectURL(blob);
      }
      return httpUrl;
    },
    [mx, useAuthentication]
  );

  return (
    <OverlayModal open={open} requestClose={requestClose}>
      <Modal className={ImageViewerModal} size="500" onContextMenu={(evt) => evt.stopPropagation()}>
        {viewerState && (
          <ImageViewer
            src={viewerState.src}
            alt={viewerState.alt}
            requestClose={requestClose}
            gallery={
              viewerState.gallery
                ? {
                    items: viewerState.gallery.items,
                    index: viewerState.gallery.index,
                    resolveSrc,
                    onNavigate: ({ src, alt, index }) =>
                      setViewerState((prev) =>
                        prev && prev.gallery
                          ? { src, alt, gallery: { items: prev.gallery.items, index } }
                          : prev
                      ),
                  }
                : undefined
            }
          />
        )}
      </Modal>
    </OverlayModal>
  );
}
