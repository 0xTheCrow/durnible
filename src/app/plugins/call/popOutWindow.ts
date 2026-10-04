import { checkIsDesktopApp } from '../../platform/desktop';

type DocumentPictureInPictureOptions = {
  width?: number;
  height?: number;
  disallowReturnToOpener?: boolean;
};

type DocumentPictureInPicture = {
  window: Window | null;
  requestWindow: (options?: DocumentPictureInPictureOptions) => Promise<Window>;
};

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export const CALL_POP_OUT_WINDOW_NAME_PREFIX = 'durnible-call-pop-out-';

const POP_OUT_WINDOW_WIDTH_PX = 480;
const DEFAULT_ASPECT_RATIO = 16 / 9;

export type PopOutWindowSize = { width: number; height: number };

export const getPopOutWindowSize = (videoElement: HTMLVideoElement): PopOutWindowSize => {
  const { videoWidth, videoHeight } = videoElement;
  const aspectRatio =
    videoWidth > 0 && videoHeight > 0 ? videoWidth / videoHeight : DEFAULT_ASPECT_RATIO;
  return {
    width: POP_OUT_WINDOW_WIDTH_PX,
    height: Math.round(POP_OUT_WINDOW_WIDTH_PX / aspectRatio),
  };
};

export const checkCanOpenPopOutWindow = (): boolean =>
  checkIsDesktopApp() || window.documentPictureInPicture !== undefined;

export const openPopOutWindow = async ({
  width,
  height,
}: PopOutWindowSize): Promise<Window | null> => {
  if (checkIsDesktopApp()) {
    return window.open(
      '',
      `${CALL_POP_OUT_WINDOW_NAME_PREFIX}${crypto.randomUUID()}`,
      `width=${width},height=${height}`
    );
  }
  if (!window.documentPictureInPicture) return null;
  return window.documentPictureInPicture.requestWindow({
    width,
    height,
    disallowReturnToOpener: true,
  });
};

export const copyDocumentStyles = (targetDocument: Document): void => {
  document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((styleNode) => {
    targetDocument.head.appendChild(styleNode.cloneNode(true));
  });
  targetDocument.body.setAttribute('class', document.body.className);
};
