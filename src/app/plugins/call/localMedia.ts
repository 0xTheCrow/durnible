export type MediaDevicePreferences = {
  audioInputDeviceId?: string;
  videoInputDeviceId?: string;
};

export const isScreenshareSupported = (): boolean =>
  typeof navigator.mediaDevices?.getDisplayMedia === 'function';

export const requestMediaPermission = async (
  constraints: MediaStreamConstraints
): Promise<boolean> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
};
