import type { ReactNode } from 'react';
import React, { useCallback, useEffect } from 'react';
import type { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import type { AudioInfo } from '../../../../types/matrix/common';
import type { RenderMediaControlProps } from '../../media';
import { AudioPlayer } from '../../media';
import {
  decryptFile,
  downloadEncryptedMedia,
  downloadMedia,
  mxcUrlToHttp,
} from '../../../utils/matrix';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { toSeekableAudio } from '../../../utils/seekableAudio';

export type AudioContentProps = {
  mimeType: string;
  url: string;
  info: AudioInfo;
  encryptionInfo?: EncryptedAttachmentInfo;
  renderMediaControl: (props: RenderMediaControlProps) => ReactNode;
};
export function AudioContent({
  mimeType,
  url,
  info,
  encryptionInfo,
  renderMediaControl,
}: AudioContentProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const [srcState, loadSrc] = useAsyncCallback(
    useCallback(async () => {
      const mediaUrl = mxcUrlToHttp(mx, url, useAuthentication) ?? url;
      const fileContent = encryptionInfo
        ? await downloadEncryptedMedia(mediaUrl, (encBuf) =>
            decryptFile(encBuf, mimeType, encryptionInfo)
          )
        : await downloadMedia(mediaUrl);
      const playableContent = await toSeekableAudio(fileContent, mimeType, info.duration);
      return {
        objectUrl: URL.createObjectURL(playableContent),
        playableMimeType: playableContent.type || mimeType,
      };
    }, [mx, url, useAuthentication, mimeType, encryptionInfo, info.duration])
  );

  const objectUrl = srcState.status === AsyncStatus.Success ? srcState.data.objectUrl : undefined;
  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl]
  );

  // duration in seconds. (NOTE: info.duration is in milliseconds)
  const infoDuration = info.duration ?? 0;

  return (
    <AudioPlayer
      src={objectUrl}
      mimeType={
        srcState.status === AsyncStatus.Success ? srcState.data.playableMimeType : undefined
      }
      durationSeconds={(infoDuration >= 0 ? infoDuration : 0) / 1000}
      isSourceLoading={srcState.status === AsyncStatus.Loading}
      onRequestSource={loadSrc}
      renderMediaControl={renderMediaControl}
    />
  );
}
