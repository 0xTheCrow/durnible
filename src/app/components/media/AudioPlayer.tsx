/* eslint-disable jsx-a11y/media-has-caption */
import type { ReactNode } from 'react';
import React, { useCallback, useRef, useState } from 'react';
import { Chip, Icon, IconButton, Icons, Spinner, Text, color, toRem } from 'folds';
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
import { Slider } from '../Slider';

const PLAY_TIME_THROTTLE_OPS = {
  wait: 500,
  immediate: true,
};

const EMPTY_TRACK_MAX_SECONDS = 1;

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
      <Slider
        size="300"
        step={1}
        min={0}
        max={trackMaxSeconds}
        value={currentTime}
        hitHeight={SEEK_TRACK_HIT_HEIGHT}
        trackBackgroundColor={color.SurfaceVariant.ContainerLine}
        trackTestId="audio-seek-track"
        onChange={seek}
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
        <div style={{ width: VOLUME_TRACK_WIDTH }}>
          <Slider
            size="300"
            step={0.1}
            min={0}
            max={1}
            value={volume}
            hitHeight={VOLUME_TRACK_HIT_HEIGHT}
            trackBackgroundColor={color.SurfaceVariant.ContainerLine}
            onChange={setVolume}
          />
        </div>
      </>
    ),
    children: (
      <audio controls={false} autoPlay ref={audioRef} data-testid="audio-player">
        {src && <source src={src} type={mimeType} />}
      </audio>
    ),
  });
}
