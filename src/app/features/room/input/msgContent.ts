import type { IContent, MatrixClient } from 'matrix-js-sdk';
import { MsgType } from 'matrix-js-sdk';
import to from 'await-to-js';
import type { ThumbnailContent } from '../../../../types/matrix/common';
import {
  MATRIX_BLUR_HASH_PROPERTY_NAME,
  MATRIX_SPOILER_PROPERTY_NAME,
} from '../../../../types/matrix/common';
import {
  getImageFileUrl,
  getThumbnail,
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
import { encodeBlurHash } from '../../../utils/blurHash';
import { scaleYDimension } from '../../../utils/common';

const generateThumbnailContent = async (
  mx: MatrixClient,
  img: HTMLImageElement | HTMLVideoElement,
  dimensions: [number, number],
  encrypt: boolean
): Promise<ThumbnailContent> => {
  const thumbnail = await getThumbnail(img, ...dimensions);
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
    width: dimensions[0],
    height: dimensions[1],
  });
  return thumbnailContent;
};

export const getImageMsgContent = async (
  mx: MatrixClient,
  item: UploadItem,
  mxc: string
): Promise<IContent> => {
  const { file, originalFile, encryptionInfo, metadata } = item;
  const [imgError, imageElement] = await to(loadImageElement(getImageFileUrl(originalFile)));
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
      512,
      scaleYDimension(imageElement.width, 512, imageElement.height)
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
};

export const getVideoMsgContent = async (
  mx: MatrixClient,
  item: UploadItem,
  mxc: string
): Promise<IContent> => {
  const { file, originalFile, encryptionInfo, metadata } = item;

  const [videoError, videoElement] = await to(loadVideoElement(getVideoFileUrl(originalFile)));
  if (videoError) console.warn(videoError);

  const content: IContent = {
    msgtype: MsgType.Video,
    filename: file.name,
    body: file.name,
    [MATRIX_SPOILER_PROPERTY_NAME]: metadata.markedAsSpoiler,
  };
  if (videoElement) {
    const [thumbError, thumbContent] = await to(
      generateThumbnailContent(
        mx,
        videoElement,
        getThumbnailDimensions(videoElement.videoWidth, videoElement.videoHeight),
        !!encryptionInfo
      )
    );
    if (thumbContent && thumbContent.thumbnail_info) {
      thumbContent.thumbnail_info[MATRIX_BLUR_HASH_PROPERTY_NAME] = encodeBlurHash(
        videoElement,
        512,
        scaleYDimension(videoElement.videoWidth, 512, videoElement.videoHeight)
      );
    }
    if (thumbError) console.warn(thumbError);
    content.info = {
      ...getVideoInfo(videoElement, file),
      ...thumbContent,
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
