import { useCallback, useEffect, useState } from 'react';

export type MediaSeekData = {
  seeking: boolean;
  seekable?: TimeRanges;
};
export type MediaSeekControl = {
  seek: (time: number) => void;
};

export const useMediaSeek = (
  getTargetElement: () => HTMLMediaElement | null
): MediaSeekData & MediaSeekControl => {
  const [seekData, setSeekData] = useState<MediaSeekData>({
    seeking: false,
    seekable: undefined,
  });

  const seek = useCallback(
    (time: number) => {
      const mediaElement = getTargetElement();
      if (!mediaElement) return;
      if (!Number.isFinite(time)) return;
      mediaElement.currentTime = time;
    },
    [getTargetElement]
  );

  useEffect(() => {
    const mediaElement = getTargetElement();
    const handleChange = () => {
      if (!mediaElement) return;
      setSeekData({
        seeking: mediaElement.seeking,
        seekable: mediaElement.seekable,
      });
    };
    mediaElement?.addEventListener('loadedmetadata', handleChange);
    mediaElement?.addEventListener('seeked', handleChange);
    mediaElement?.addEventListener('seeking', handleChange);
    return () => {
      mediaElement?.removeEventListener('loadedmetadata', handleChange);
      mediaElement?.removeEventListener('seeked', handleChange);
      mediaElement?.removeEventListener('seeking', handleChange);
    };
  }, [getTargetElement]);

  return {
    ...seekData,
    seek,
  };
};
