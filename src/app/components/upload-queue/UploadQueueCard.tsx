import React, { useEffect } from 'react';
import {
  Box,
  Chip,
  Icon,
  IconButton,
  Icons,
  ProgressBar,
  Spinner,
  Text,
  color,
  percent,
} from 'folds';

import * as css from './UploadQueue.css';
import { UploadStatus, useBindUploadAtom } from '../../state/upload';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaConfig } from '../../hooks/useMediaConfig';
import { useObjectURL } from '../../hooks/useObjectURL';
import type { UploadContent } from '../../utils/matrix';
import { bytesToSize, getFileTypeIcon } from '../../utils/common';
import type { UploadItem, UploadMetadata } from '../../state/room/roomInputDrafts';
import { roomUploadAtomFamily } from '../../state/room/roomInputDrafts';

type UploadQueueCardProps = {
  fileItem: UploadItem;
  setMetadata: (fileItem: UploadItem, metadata: UploadMetadata) => void;
  onRemove: (file: UploadContent) => void;
};

export function UploadQueueCard({ fileItem, setMetadata, onRemove }: UploadQueueCardProps) {
  const mx = useMatrixClient();
  const mediaConfig = useMediaConfig();
  const allowSize = mediaConfig['m.upload.size'] || Infinity;

  const uploadAtom = roomUploadAtomFamily(fileItem.file);
  const { metadata, originalFile } = fileItem;
  const { upload, startUpload, cancelUpload } = useBindUploadAtom(
    mx,
    uploadAtom,
    !!fileItem.encInfo
  );
  const { file } = upload;
  const fileSizeExceeded = file.size >= allowSize;

  const isImage = originalFile.type.startsWith('image');
  const isVideo = originalFile.type.startsWith('video');
  const previewUrl = useObjectURL(isImage || isVideo ? originalFile : undefined);

  useEffect(() => {
    if (
      upload.status === UploadStatus.Idle &&
      !fileSizeExceeded &&
      !fileItem.isEncrypting &&
      fileItem.isEncryptionSuccessful !== false
    ) {
      startUpload();
    }
  }, [
    upload.status,
    fileSizeExceeded,
    fileItem.isEncrypting,
    fileItem.isEncryptionSuccessful,
    startUpload,
  ]);

  const handleRemove = () => {
    cancelUpload();
    onRemove(file);
  };

  const handleSpoiler = () => {
    setMetadata(fileItem, { ...metadata, markedAsSpoiler: !metadata.markedAsSpoiler });
  };

  const encryptionFailed = fileItem.isEncryptionSuccessful === false;
  const uploadFailed = upload.status === UploadStatus.Error;
  const showErrorOverlay = encryptionFailed || uploadFailed || fileSizeExceeded;
  const showRetry = uploadFailed && isImage;

  const loadedBytes =
    upload.status === UploadStatus.Loading
      ? upload.progress.loaded
      : upload.status === UploadStatus.Success
      ? file.size
      : 0;

  const errorMessage = encryptionFailed
    ? fileItem.encryptError ?? 'Encryption failed'
    : uploadFailed
    ? upload.error.message
    : fileSizeExceeded
    ? `${bytesToSize(file.size)} exceeds ${bytesToSize(allowSize)} limit`
    : undefined;

  const showProgress =
    !showErrorOverlay &&
    (upload.status === UploadStatus.Loading ||
      upload.status === UploadStatus.Idle ||
      fileItem.isEncrypting);

  return (
    <Box className={css.UploadQueueCard}>
      <Box className={css.UploadQueueThumbnail}>
        {isImage && previewUrl && (
          <img
            className={css.UploadQueueThumbnailMedia}
            alt={originalFile.name}
            src={previewUrl}
            style={metadata.markedAsSpoiler ? { filter: 'blur(24px)' } : undefined}
          />
        )}
        {isVideo && previewUrl && (
          <video
            className={css.UploadQueueThumbnailMedia}
            src={previewUrl}
            style={metadata.markedAsSpoiler ? { filter: 'blur(24px)' } : undefined}
          />
        )}
        {!isImage && !isVideo && (
          <Icon size="600" src={getFileTypeIcon(Icons, originalFile.type)} />
        )}

        {showProgress && (
          <Box className={css.UploadQueueOverlay}>
            {fileItem.isEncrypting ? (
              <>
                <Spinner variant="Secondary" size="400" />
                <Text size="L400" align="Center">
                  Encrypting…
                </Text>
              </>
            ) : (
              <Box direction="Column" gap="100" style={{ width: '100%' }}>
                <ProgressBar
                  variant="Secondary"
                  size="300"
                  min={0}
                  max={file.size}
                  value={loadedBytes}
                />
                <Text size="L400" align="Center">
                  {`${Math.round(percent(0, file.size, loadedBytes))}%`}
                </Text>
                <Text size="L400" align="Center">
                  {bytesToSize(loadedBytes)} / {bytesToSize(file.size)}
                </Text>
              </Box>
            )}
          </Box>
        )}

        {showErrorOverlay && (
          <Box className={css.UploadQueueErrorOverlay}>
            <Icon size="400" src={Icons.Warning} />
            <Text className={css.UploadQueueErrorMessage} size="T200" align="Center">
              {errorMessage}
            </Text>
            {showRetry && (
              <Chip
                as="button"
                onClick={startUpload}
                aria-label="Retry Upload"
                variant="Critical"
                radii="Pill"
                outlined
              >
                <Text size="B300">Retry</Text>
              </Chip>
            )}
          </Box>
        )}

        {(isImage || isVideo) && !showErrorOverlay && !showProgress && (
          <Box className={css.UploadQueueSpoilerChip}>
            <Chip
              as="button"
              onClick={handleSpoiler}
              variant={metadata.markedAsSpoiler ? 'Warning' : 'Secondary'}
              fill="Soft"
              radii="Pill"
              aria-pressed={metadata.markedAsSpoiler}
              before={<Icon src={Icons.EyeBlind} size="50" />}
            >
              <Text size="B300">Spoiler</Text>
            </Chip>
          </Box>
        )}

        <Box className={css.UploadQueueActions}>
          <IconButton
            onClick={handleRemove}
            aria-label="Cancel Upload"
            variant="SurfaceVariant"
            radii="300"
            size="300"
          >
            <Icon src={Icons.Delete} size="100" />
          </IconButton>
        </Box>

        {!showErrorOverlay &&
          (fileItem.isEncryptionSuccessful || upload.status === UploadStatus.Success) && (
            <Box className={css.UploadQueueStatusIcons}>
              {fileItem.isEncryptionSuccessful && (
                <Icon style={{ color: color.Success.Main }} src={Icons.Lock} size="100" />
              )}
              {upload.status === UploadStatus.Success && (
                <Icon style={{ color: color.Success.Main }} src={Icons.Check} size="100" />
              )}
            </Box>
          )}
      </Box>

      <Text size="T200" truncate>
        {originalFile.name}
      </Text>
    </Box>
  );
}
