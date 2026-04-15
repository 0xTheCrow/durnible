import { atom } from 'jotai';
import type { EncryptedFile } from '../../types/matrix/common';

/**
 * One image in a viewer gallery. `src` may be undefined when the viewer is
 * opened for an item that hasn't been loaded yet — in that case the viewer
 * resolves it lazily from `mxcUrl` (+ `encInfo` for encrypted media) when
 * the user navigates to it.
 */
export type ImageViewerGalleryItem = {
  src?: string;
  alt: string;
  mxcUrl?: string;
  encInfo?: EncryptedFile;
  mimeType?: string;
};

export type ImageViewerData = {
  /** Resolved http(s) src of the currently displayed image. */
  src: string;
  /** Alt text / filename of the currently displayed image. */
  alt: string;
  /**
   * Optional gallery context. When set, the viewer renders prev/next arrow
   * controls and `index` is the current position within `items`.
   */
  gallery?: {
    items: ImageViewerGalleryItem[];
    index: number;
  };
};

export const imageViewerAtom = atom<ImageViewerData | undefined>(undefined);
