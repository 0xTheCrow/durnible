/* eslint-disable jsx-a11y/media-has-caption */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Chip,
  Icon,
  IconButton,
  Icons,
  ProgressBar,
  Text,
  color,
  config,
  toRem,
} from 'folds';
import { Range } from 'react-range';
import { useVoiceRecording, VoiceRecordingStatus } from '../../hooks/useVoiceRecording';
import { useMediaPlay, useMediaPlayTimeCallback, useMediaSeek } from '../../hooks/media';
import { useThrottle } from '../../hooks/useThrottle';
import { secondsToMinutesAndSeconds } from '../../utils/common';
import * as editorCss from '../../components/editor/Editor.css';

type VoiceMessageRecorderProps = {
  onSend: (blob: Blob, mimeType: string, duration: number) => void;
  onCancel: () => void;
};

type PreviewState = {
  blob: Blob;
  mimeType: string;
  duration: number;
  objectUrl: string;
};

function VoicePreview({
  preview,
  onSend,
  onDiscard,
}: {
  preview: PreviewState;
  onSend: () => void;
  onDiscard: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const getAudioRef = useCallback(() => audioRef.current, []);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(preview.duration);

  const { playing, setPlaying } = useMediaPlay(getAudioRef);
  const { seek } = useMediaSeek(getAudioRef);

  const handlePlayTime = useCallback((d: number, ct: number) => {
    if (Number.isFinite(d) && d > 0) setDuration(d);
    setCurrentTime(ct);
  }, []);
  useMediaPlayTimeCallback(
    getAudioRef,
    useThrottle(handlePlayTime, { immediate: true, wait: 200 })
  );

  return (
    <div className={editorCss.Editor}>
      <Box alignItems="Center" style={{ padding: config.space.S200 }}>
        <Box className={editorCss.EditorOptions} alignItems="Center" gap="100" shrink="No">
          <IconButton onClick={onDiscard} variant="SurfaceVariant" size="300" radii="300">
            <Icon src={Icons.Cross} />
          </IconButton>
        </Box>

        <Box
          grow="Yes"
          alignItems="Center"
          gap="300"
          style={{ minWidth: 0, padding: `0 ${config.space.S100}` }}
        >
          <Chip
            onClick={() => setPlaying(!playing)}
            variant="Secondary"
            radii="300"
            before={<Icon src={playing ? Icons.Pause : Icons.Play} size="50" filled={playing} />}
          >
            <Text size="B300">{playing ? 'Pause' : 'Play'}</Text>
          </Chip>

          <Text size="T200" style={{ flexShrink: 0 }}>
            {`${secondsToMinutesAndSeconds(currentTime)} / ${secondsToMinutesAndSeconds(duration)}`}
          </Text>

          <Range
            step={0.1}
            min={0}
            max={duration || 1}
            values={[currentTime]}
            onChange={(values) => seek(values[0])}
            renderTrack={(params) => (
              <div
                {...params.props}
                style={{
                  ...params.props.style,
                  flexGrow: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {params.children}
                <ProgressBar
                  as="div"
                  variant="Secondary"
                  size="300"
                  min={0}
                  max={duration || 1}
                  value={currentTime}
                  radii="300"
                  style={{ width: '100%' }}
                />
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
                style={{ ...params.props.style, zIndex: 0 }}
              />
            )}
          />
        </Box>

        <Box className={editorCss.EditorOptions} alignItems="Center" gap="100" shrink="No">
          <IconButton onClick={onSend} variant="SurfaceVariant" size="300" radii="300">
            <Icon src={Icons.Send} />
          </IconButton>
        </Box>
      </Box>

      <audio ref={audioRef} src={preview.objectUrl} />
    </div>
  );
}

export function VoiceMessageRecorder({ onSend, onCancel }: VoiceMessageRecorderProps) {
  const { state, startRecording, stopRecording, cancelRecording, reset } = useVoiceRecording();
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    startRecording();
  }, [startRecording]);

  useEffect(() => {
    if (state.status === VoiceRecordingStatus.Stopped) {
      const objectUrl = URL.createObjectURL(state.blob);
      setPreview({
        blob: state.blob,
        mimeType: state.mimeType,
        duration: state.duration,
        objectUrl,
      });
    } else if (state.status === VoiceRecordingStatus.Error) {
      onCancel();
    }
  }, [state, onCancel]);

  // Revoke object URL on unmount or when preview changes
  const previewObjectUrl = preview?.objectUrl;
  useEffect(
    () => () => {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    },
    [previewObjectUrl]
  );

  const handleSend = useCallback(() => {
    if (!preview) return;
    onSend(preview.blob, preview.mimeType, preview.duration);
  }, [preview, onSend]);

  const handleDiscard = useCallback(() => {
    setPreview(null);
    reset();
    onCancel();
  }, [reset, onCancel]);

  const handleCancel = useCallback(() => {
    cancelRecording();
    onCancel();
  }, [cancelRecording, onCancel]);

  if (preview) {
    return <VoicePreview preview={preview} onSend={handleSend} onDiscard={handleDiscard} />;
  }

  const isRecording = state.status === VoiceRecordingStatus.Recording;
  const isRequesting = state.status === VoiceRecordingStatus.Requesting;
  const duration = state.status === VoiceRecordingStatus.Recording ? state.duration : 0;

  return (
    <div className={editorCss.Editor}>
      <Box alignItems="Center" gap="300" style={{ padding: config.space.S200 }}>
        <Box className={editorCss.EditorOptions} alignItems="Center" gap="100" shrink="No">
          <IconButton onClick={handleCancel} variant="SurfaceVariant" size="300" radii="300">
            <Icon src={Icons.Cross} />
          </IconButton>
        </Box>

        <Box grow="Yes" alignItems="Center" gap="300" justifyContent="Center">
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: toRem(10),
              height: toRem(10),
              borderRadius: '50%',
              flexShrink: 0,
              backgroundColor: isRecording ? color.Critical.Main : color.SurfaceVariant.OnContainer,
              animation: isRecording
                ? 'voice-recording-pulse 1.2s ease-in-out infinite'
                : undefined,
            }}
          />
          <Icon src={Icons.Mic} filled={isRecording} />
          <Text size="T400">
            {isRequesting ? 'Requesting microphone…' : secondsToMinutesAndSeconds(duration)}
          </Text>
        </Box>

        <Box className={editorCss.EditorOptions} alignItems="Center" gap="100" shrink="No">
          <IconButton
            onClick={stopRecording}
            variant="SurfaceVariant"
            size="300"
            radii="300"
            disabled={!isRecording}
          >
            <Icon src={Icons.Check} />
          </IconButton>
        </Box>
      </Box>
    </div>
  );
}
