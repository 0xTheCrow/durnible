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
import { Range } from 'react-range';
import type { PlayTimeCallback } from '../../hooks/media';
import {
  AUDIO_VOLUME_STORAGE_KEY,
  useMediaLoading,
  useMediaPlay,
  useMediaPlayTimeCallback,
  useMediaSeek,
  useMediaVolume,
  useMediaVolumePersistence,
} from '../../hooks/media';
import { useThrottle } from '../../hooks/useThrottle';
import { secondsToMinutesAndSeconds } from '../../utils/common';

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

export type RenderMediaControlProps = {
  after: ReactNode;
  leftControl: ReactNode;
  rightControl: ReactNode;
  children: ReactNode;
};

export type AudioPlayerProps = {
  src?: string;
  mimeType?: string;
  durationSeconds?: number;
  isSourceLoading?: boolean;
  onRequestSource?: () => void;
  renderMediaControl: (props: RenderMediaControlProps) => ReactNode;
};

export function AudioPlayer({
  src,
  mimeType,
  durationSeconds,
  isSourceLoading,
  onRequestSource,
  renderMediaControl,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);

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
    if (src) {
      setPlaying(!playing);
    } else if (!isSourceLoading) {
      onRequestSource?.();
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
          disabled={isSourceLoading}
          before={
            isSourceLoading || loading ? (
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
        {src && <source src={src} type={mimeType} />}
      </audio>
    ),
  });
}
