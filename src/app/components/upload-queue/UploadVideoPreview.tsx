import React, { useCallback, useRef, useState } from 'react';
import { Box, Button, Icon, Icons, Text } from 'folds';

import * as css from './UploadQueue.css';
import { useMediaPlay } from '../../hooks/media';
import { Video } from '../media';

type UploadVideoPreviewProps = {
  src: string;
};

export function UploadVideoPreview({ src }: UploadVideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const getVideoRef = useCallback(() => videoRef.current, []);
  const { setPlaying } = useMediaPlay(getVideoRef);
  const [isWatching, setIsWatching] = useState(false);

  const handleWatch = () => {
    setIsWatching(true);
    setPlaying(true);
  };

  return (
    <Box className={css.UploadQueueVideoPreview}>
      <Video ref={videoRef} src={src} controls={isWatching} preload="metadata" />
      {!isWatching && (
        <Box
          className={css.UploadQueueVideoPreviewOverlay}
          alignItems="Center"
          justifyContent="Center"
        >
          <Button
            variant="Secondary"
            fill="Solid"
            radii="400"
            size="500"
            onClick={handleWatch}
            before={<Icon size="Inherit" src={Icons.Play} filled />}
          >
            <Text size="B500">Watch</Text>
          </Button>
        </Box>
      )}
    </Box>
  );
}
