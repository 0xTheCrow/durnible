import type { IContent, MatrixClient } from 'matrix-js-sdk';
import { MsgType } from 'matrix-js-sdk';
import to from 'await-to-js';
import type { ThumbnailContent } from '../../../../types/matrix/common';
import {
  MATRIX_BLUR_HASH_PROPERTY_NAME,
  MATRIX_SPOILER_PROPERTY_NAME,
} from '../../../../types/matrix/common';
import {
  captureVideoFrame,
  getImageFileUrl,
  getThumbnailDimensions,
  getVideoFileUrl,
  loadImageElement,
  loadVideoElement,
} from '../../../utils/dom';
import {
  encryptFile,
  getImageInfo,
  getThumbnailContent,
  getVideoInfo,
  probeAudioDurationMs,
} from '../../../utils/matrix';
import type { UploadItem } from '../../../state/room/roomInputDrafts';
import { BLUR_HASH_ENCODE_WIDTH, encodeBlurHash } from '../../../utils/blurHash';
import { scaleYDimension } from '../../../utils/common';

const generateThumbnailContent = async (
  mx: MatrixClient,
  videoFrame: HTMLCanvasElement,
  encrypt: boolean
): Promise<ThumbnailContent> => {
  const thumbnail = await new Promise<Blob | null>((resolve) => {
    videoFrame.toBlob(resolve, 'image/jpeg');
  });
  if (!thumbnail) throw new Error('Can not create thumbnail!');
  const encThumbData = encrypt ? await encryptFile(thumbnail) : undefined;
  const thumbnailFile = encThumbData?.file ?? thumbnail;
  if (!thumbnailFile) throw new Error('Can not create thumbnail!');

  const data = await mx.uploadContent(thumbnailFile);
  const thumbMxc = data?.content_uri;
  if (!thumbMxc) throw new Error('Failed when uploading thumbnail!');
  const thumbnailContent = getThumbnailContent({
    thumbnail: thumbnailFile,
    encryptionInfo: encThumbData?.encryptionInfo,
    mxc: thumbMxc,
    width: videoFrame.width,
    height: videoFrame.height,
  });
  return thumbnailContent;
};

export const getImageMsgContent = async (
  mx: MatrixClient,
  item: UploadItem,
  mxc: string
): Promise<IContent> => {
  const { file, originalFile, encryptionInfo, metadata } = item;
  const imageFileUrl = getImageFileUrl(originalFile);

  try {
    const [imgError, imageElement] = await to(loadImageElement(imageFileUrl));
    if (imgError) console.warn(imgError);

    const content: IContent = {
      msgtype: MsgType.Image,
      filename: file.name,
      body: file.name,
      [MATRIX_SPOILER_PROPERTY_NAME]: metadata.markedAsSpoiler,
    };
    if (imageElement) {
      const blurHash = encodeBlurHash(
        imageElement,
        BLUR_HASH_ENCODE_WIDTH,
        scaleYDimension(imageElement.width, BLUR_HASH_ENCODE_WIDTH, imageElement.height)
      );

      content.info = {
        ...getImageInfo(imageElement, file),
        [MATRIX_BLUR_HASH_PROPERTY_NAME]: blurHash,
      };
    }
    if (encryptionInfo) {
      content.file = {
        ...encryptionInfo,
        url: mxc,
      };
    } else {
      content.url = mxc;
    }
    return content;
  } finally {
    URL.revokeObjectURL(imageFileUrl);
  }
};

export const getVideoMsgContent = async (
  mx: MatrixClient,
  item: UploadItem,
  mxc: string
): Promise<IContent> => {
  const { file, originalFile, encryptionInfo, metadata } = item;
  const videoFileUrl = getVideoFileUrl(originalFile);

  try {
    const [videoError, videoElement] = await to(loadVideoElement(videoFileUrl));
    if (videoError) console.warn(videoError);

    const content: IContent = {
      msgtype: MsgType.Video,
      filename: file.name,
      body: file.name,
      [MATRIX_SPOILER_PROPERTY_NAME]: metadata.markedAsSpoiler,
    };
    if (videoElement) {
      content.info = getVideoInfo(videoElement, file);

      const hasVideoDimensions = videoElement.videoWidth > 0 && videoElement.videoHeight > 0;
      const [captureError, videoFrame] = await to(
        captureVideoFrame(
          videoElement,
          originalFile,
          ...getThumbnailDimensions(videoElement.videoWidth, videoElement.videoHeight)
        )
      );
      if (captureError) console.warn(captureError);

      if (videoFrame) {
        const [thumbError, thumbContent] = await to(
          generateThumbnailContent(mx, videoFrame, !!encryptionInfo)
        );
        if (thumbError) console.warn(thumbError);
        content.info = { ...content.info, ...thumbContent };

        const blurHash = encodeBlurHash(
          videoFrame,
          BLUR_HASH_ENCODE_WIDTH,
          scaleYDimension(videoFrame.width, BLUR_HASH_ENCODE_WIDTH, videoFrame.height)
        );
        if (blurHash) {
          if (content.info.thumbnail_info) {
            content.info.thumbnail_info[MATRIX_BLUR_HASH_PROPERTY_NAME] = blurHash;
          } else {
            content.info[MATRIX_BLUR_HASH_PROPERTY_NAME] = blurHash;
          }
        }
      } else if (hasVideoDimensions) {
        console.warn(`Could not capture a preview frame from ${file.name}`);
      }
    }
    if (encryptionInfo) {
      content.file = {
        ...encryptionInfo,
        url: mxc,
      };
    } else {
      content.url = mxc;
    }
    return content;
  } finally {
    URL.revokeObjectURL(videoFileUrl);
  }
};

export const getAudioMsgContent = async (item: UploadItem, mxc: string): Promise<IContent> => {
  const { file, originalFile, encryptionInfo, mediaInfo } = item;
  const audioInfo = mediaInfo?.audio;
  const preset =
    audioInfo?.durationMs !== undefined && Number.isFinite(audioInfo.durationMs)
      ? Math.max(0, Math.round(audioInfo.durationMs))
      : undefined;
  const durationMs = preset ?? (await probeAudioDurationMs(originalFile));
  const content: IContent = {
    msgtype: MsgType.Audio,
    filename: file.name,
    body: file.name,
    info: {
      mimetype: file.type,
      size: file.size,
      ...(durationMs !== undefined && { duration: durationMs }),
    },
    ...(durationMs !== undefined && {
      'org.matrix.msc1767.audio': { duration: durationMs },
    }),
    ...(audioInfo?.isVoiceMessage && {
      'org.matrix.msc3245.voice': {},
    }),
  };
  if (encryptionInfo) {
    content.file = {
      ...encryptionInfo,
      url: mxc,
    };
  } else {
    content.url = mxc;
  }
  return content;
};

export const getFileMsgContent = (item: UploadItem, mxc: string): IContent => {
  const { file, encryptionInfo } = item;
  const content: IContent = {
    msgtype: MsgType.File,
    body: file.name,
    filename: file.name,
    info: {
      mimetype: file.type,
      size: file.size,
    },
  };
  if (encryptionInfo) {
    content.file = {
      ...encryptionInfo,
      url: mxc,
    };
  } else {
    content.url = mxc;
  }
  return content;
};
