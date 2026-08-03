/* eslint-disable jsx-a11y/media-has-caption */
import type { ReactNode } from 'react';
import React, { useCallback, useRef, useState } from 'react';
import {
  Badge,
  Chip,
  Icon,
  IconButton,
  Icons,
  ProgressBar,
  Spinner,
  Text,
  color,
  toRem,
} from 'folds';
import type { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import { Range } from 'react-range';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import type { AudioInfo } from '../../../../types/matrix/common';
import type { PlayTimeCallback } from '../../../hooks/media';
import {
  AUDIO_VOLUME_STORAGE_KEY,
  useMediaLoading,
  useMediaPlay,
  useMediaPlayTimeCallback,
  useMediaSeek,
  useMediaVolume,
  useMediaVolumePersistence,
} from '../../../hooks/media';
import { useThrottle } from '../../../hooks/useThrottle';
import { secondsToMinutesAndSeconds } from '../../../utils/common';
import {
  decryptFile,
  downloadEncryptedMedia,
  downloadMedia,
  mxcUrlToHttp,
} from '../../../utils/matrix';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { toSeekableAudio } from '../../../utils/seekableAudio';

const PLAY_TIME_THROTTLE_OPS = {
  wait: 500,
  immediate: true,
};

const EMPTY_TRACK_MAX_SECONDS = 1;

const THUMB_HALF_WIDTH = toRem(6);
const VOLUME_TRACK_WIDTH = toRem(96);
const PLAY_TOGGLE_MIN_WIDTH = toRem(96);
const SEEK_TRACK_HIT_HEIGHT = toRem(24);
const VOLUME_TRACK_HIT_HEIGHT = toRem(32);

type RenderMediaControlProps = {
  after: ReactNode;
  leftControl: ReactNode;
  rightControl: ReactNode;
  children: ReactNode;
};
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

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  // duration in seconds. (NOTE: info.duration is in milliseconds)
  const infoDuration = info.duration ?? 0;
  const [duration, setDuration] = useState((infoDuration >= 0 ? infoDuration : 0) / 1000);

  const getAudioRef = useCallback(() => audioRef.current, []);
  const { loading } = useMediaLoading(getAudioRef);
  const { playing, setPlaying } = useMediaPlay(getAudioRef);
  const { seek } = useMediaSeek(getAudioRef);
  const { volume, mute, setMute, setVolume } = useMediaVolume(getAudioRef);
  useMediaVolumePersistence(audioRef, AUDIO_VOLUME_STORAGE_KEY);
  const handlePlayTimeCallback: PlayTimeCallback = useCallback(
    (mediaDuration, mediaCurrentTime) => {
      if (Number.isFinite(mediaDuration) && mediaDuration > 0) setDuration(mediaDuration);
      setCurrentTime(mediaCurrentTime);
    },
    []
  );
  useMediaPlayTimeCallback(
    getAudioRef,
    useThrottle(handlePlayTimeCallback, PLAY_TIME_THROTTLE_OPS)
  );

  const handlePlay = () => {
    if (srcState.status === AsyncStatus.Success) {
      setPlaying(!playing);
    } else if (srcState.status !== AsyncStatus.Loading) {
      loadSrc();
    }
  };

  const trackMaxSeconds = Math.max(duration, currentTime, EMPTY_TRACK_MAX_SECONDS);

  return renderMediaControl({
    after: (
      <Range
        step={1}
        min={0}
        max={trackMaxSeconds}
        values={[currentTime]}
        onChange={(values) => seek(values[0])}
        renderTrack={(params) => (
          <div style={{ position: 'relative' }}>
            <ProgressBar
              as="div"
              style={{ backgroundColor: color.SurfaceVariant.ContainerLine }}
              variant="Secondary"
              size="300"
              min={0}
              max={trackMaxSeconds}
              value={currentTime}
              radii="300"
            />
            <div
              {...params.props}
              data-testid="audio-seek-track"
              style={{
                ...params.props.style,
                position: 'absolute',
                left: THUMB_HALF_WIDTH,
                right: THUMB_HALF_WIDTH,
                top: '50%',
                height: SEEK_TRACK_HIT_HEIGHT,
                transform: `translateY(-50%) ${params.props.style?.transform ?? ''}`,
              }}
            >
              {params.children}
            </div>
          </div>
        )}
        renderThumb={(params) => (
          <Badge
            size="300"
            variant="Secondary"
            fill="Solid"
            radii="Pill"
            outlined
            {...params.props}
            style={{
              ...params.props.style,
              zIndex: 0,
            }}
          />
        )}
      />
    ),
    leftControl: (
      <>
        <Chip
          onClick={handlePlay}
          variant="Secondary"
          size="500"
          radii="300"
          data-testid="audio-play-toggle"
          aria-pressed={playing}
          style={{ minWidth: PLAY_TOGGLE_MIN_WIDTH, justifyContent: 'flex-start' }}
          disabled={srcState.status === AsyncStatus.Loading}
          before={
            srcState.status === AsyncStatus.Loading || loading ? (
              <Spinner variant="Secondary" size="50" />
            ) : (
              <Icon src={playing ? Icons.Pause : Icons.Play} size="50" filled={playing} />
            )
          }
        >
          <Text size="B300">{playing ? 'Pause' : 'Play'}</Text>
        </Chip>

        <Text size="T200">{`${secondsToMinutesAndSeconds(currentTime)} / ${
          duration > 0 ? secondsToMinutesAndSeconds(duration) : '-:--'
        }`}</Text>
      </>
    ),
    rightControl: (
      <>
        <IconButton
          variant="SurfaceVariant"
          size="300"
          radii="Pill"
          onClick={() => setMute(!mute)}
          aria-pressed={mute}
        >
          <Icon src={mute ? Icons.VolumeMute : Icons.VolumeHigh} size="50" />
        </IconButton>
        <Range
          step={0.1}
          min={0}
          max={1}
          values={[volume]}
          onChange={(values) => setVolume(values[0])}
          renderTrack={(params) => (
            <div style={{ position: 'relative', width: VOLUME_TRACK_WIDTH }}>
              <ProgressBar
                style={{
                  width: '100%',
                  backgroundColor: color.SurfaceVariant.ContainerLine,
                }}
                variant="Secondary"
                size="300"
                min={0}
                max={1}
                value={volume}
                radii="300"
              />
              <div
                {...params.props}
                style={{
                  ...params.props.style,
                  position: 'absolute',
                  left: THUMB_HALF_WIDTH,
                  right: THUMB_HALF_WIDTH,
                  top: '50%',
                  height: VOLUME_TRACK_HIT_HEIGHT,
                  transform: `translateY(-50%) ${params.props.style?.transform ?? ''}`,
                }}
              >
                {params.children}
              </div>
            </div>
          )}
          renderThumb={(params) => (
            <Badge
              size="300"
              variant="Secondary"
              fill="Solid"
              radii="Pill"
              outlined
              {...params.props}
              style={{
                ...params.props.style,
                zIndex: 0,
              }}
            />
          )}
        />
      </>
    ),
    children: (
      <audio controls={false} autoPlay ref={audioRef} data-testid="audio-player">
        {srcState.status === AsyncStatus.Success && (
          <source src={srcState.data.objectUrl} type={srcState.data.playableMimeType} />
        )}
      </audio>
    ),
  });
}
