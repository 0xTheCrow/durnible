import { useCallback, useEffect, useState } from 'react';

export type MediaDevices = {
  audioInputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
};

const EMPTY_MEDIA_DEVICES: MediaDevices = {
  audioInputDevices: [],
  videoInputDevices: [],
  audioOutputDevices: [],
};

const groupDevicesByKind = (devices: MediaDeviceInfo[]): MediaDevices => ({
  audioInputDevices: devices.filter((device) => device.kind === 'audioinput'),
  videoInputDevices: devices.filter((device) => device.kind === 'videoinput'),
  audioOutputDevices: devices.filter((device) => device.kind === 'audiooutput'),
});

export const useMediaDevices = (): MediaDevices & { refreshDevices: () => Promise<void> } => {
  const [mediaDevices, setMediaDevices] = useState<MediaDevices>(EMPTY_MEDIA_DEVICES);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    setMediaDevices(groupDevicesByKind(devices));
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices) return undefined;
    refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
    };
  }, [refreshDevices]);

  return { ...mediaDevices, refreshDevices };
};
