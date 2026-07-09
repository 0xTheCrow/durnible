import { useEffect, useState } from 'react';

export type MediaLoadingData = {
  loading: boolean;
  error: boolean;
};

export const useMediaLoading = (
  getTargetElement: () => HTMLMediaElement | null
): MediaLoadingData => {
  const [loadingData, setLoadingData] = useState<MediaLoadingData>({
    loading: false,
    error: false,
  });

  useEffect(() => {
    const mediaElement = getTargetElement();
    const handleStart = () => {
      setLoadingData({
        loading: true,
        error: false,
      });
    };
    const handleStop = () => {
      setLoadingData({
        loading: false,
        error: false,
      });
    };
    const handleError = () => {
      setLoadingData({
        loading: false,
        error: true,
      });
    };
    mediaElement?.addEventListener('loadstart', handleStart);
    mediaElement?.addEventListener('loadeddata', handleStop);
    mediaElement?.addEventListener('stalled', handleStop);
    mediaElement?.addEventListener('suspend', handleStop);
    mediaElement?.addEventListener('error', handleError);
    return () => {
      mediaElement?.removeEventListener('loadstart', handleStart);
      mediaElement?.removeEventListener('loadeddata', handleStop);
      mediaElement?.removeEventListener('stalled', handleStop);
      mediaElement?.removeEventListener('suspend', handleStop);
      mediaElement?.removeEventListener('error', handleError);
    };
  }, [getTargetElement]);

  return loadingData;
};
