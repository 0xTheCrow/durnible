import type { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import type { MsgType } from 'matrix-js-sdk';

export const MATRIX_BLUR_HASH_PROPERTY_NAME = 'xyz.amorgan.blurhash';
export const MATRIX_SPOILER_PROPERTY_NAME = 'page.codeberg.everypizza.msc4193.spoiler';
export const MATRIX_SPOILER_REASON_PROPERTY_NAME =
  'page.codeberg.everypizza.msc4193.spoiler.reason';

export type ImageInfo = {
  w?: number;
  h?: number;
  mimetype?: string;
  size?: number;
  [MATRIX_BLUR_HASH_PROPERTY_NAME]?: string;
};

export type VideoInfo = {
  w?: number;
  h?: number;
  mimetype?: string;
  size?: number;
  duration?: number;
};

export type AudioInfo = {
  mimetype?: string;
  size?: number;
  duration?: number;
};

export type FileInfo = {
  mimetype?: string;
  size?: number;
};

export type EncryptedFile = EncryptedAttachmentInfo & {
  url: string;
};

export type ThumbnailContent = {
  thumbnail_info?: ImageInfo;
  thumbnail_file?: EncryptedFile;
  thumbnail_url?: string;
};

export type ImageContent = {
  msgtype: MsgType.Image;
  body?: string;
  filename?: string;
  url?: string;
  info?: ImageInfo & ThumbnailContent;
  file?: EncryptedFile;
  [MATRIX_SPOILER_PROPERTY_NAME]?: boolean;
  [MATRIX_SPOILER_REASON_PROPERTY_NAME]?: string;
};

export type VideoContent = {
  msgtype: MsgType.Video;
  body?: string;
  filename?: string;
  url?: string;
  info?: VideoInfo & ThumbnailContent;
  file?: EncryptedFile;
  [MATRIX_SPOILER_PROPERTY_NAME]?: boolean;
  [MATRIX_SPOILER_REASON_PROPERTY_NAME]?: string;
};

export type AudioContent = {
  msgtype: MsgType.Audio;
  body?: string;
  filename?: string;
  url?: string;
  info?: AudioInfo;
  file?: EncryptedFile;
};

export type FileContent = {
  msgtype: MsgType.File;
  body?: string;
  filename?: string;
  url?: string;
  info?: FileInfo & ThumbnailContent;
  file?: EncryptedFile;
};

export type LocationContent = {
  msgtype: MsgType.Location;
  body?: string;
  geo_uri?: string;
  info?: ThumbnailContent;
};
