import React, { useCallback, useEffect } from 'react';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { toSeekableAudio } from '../../utils/seekableAudio';
import { AudioPlayer, MediaControl } from '../media';

type UploadAudioPreviewProps = {
  file: File;
  durationMs?: number;
};

export function UploadAudioPreview({ file, durationMs }: UploadAudioPreviewProps) {
  const [srcState, loadSrc] = useAsyncCallback(
    useCallback(async () => {
      const playableContent = await toSeekableAudio(file, file.type, durationMs);
      return {
        objectUrl: URL.createObjectURL(playableContent),
        playableMimeType: playableContent.type || file.type,
      };
    }, [file, durationMs])
  );

  const objectUrl = srcState.status === AsyncStatus.Success ? srcState.data.objectUrl : undefined;
  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl]
  );

  return (
    <AudioPlayer
      src={objectUrl}
      mimeType={
        srcState.status === AsyncStatus.Success ? srcState.data.playableMimeType : undefined
      }
      durationSeconds={durationMs === undefined ? undefined : durationMs / 1000}
      isSourceLoading={srcState.status === AsyncStatus.Loading}
      onRequestSource={loadSrc}
      renderMediaControl={(props) => <MediaControl {...props} />}
    />
  );
}
