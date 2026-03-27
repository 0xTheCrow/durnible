import React, { useEffect } from 'react';
import { Box, Icon, IconButton, Icons, Text, color, config, toRem } from 'folds';
import { useVoiceRecording, VoiceRecordingStatus } from '../../hooks/useVoiceRecording';
import { secondsToMinutesAndSeconds } from '../../utils/common';
import * as editorCss from '../../components/editor/Editor.css';

type VoiceMessageRecorderProps = {
  onSend: (blob: Blob, mimeType: string, duration: number) => void;
  onCancel: () => void;
};

export function VoiceMessageRecorder({ onSend, onCancel }: VoiceMessageRecorderProps) {
  const { state, startRecording, stopRecording, cancelRecording } = useVoiceRecording();

  useEffect(() => {
    startRecording();
  }, [startRecording]);

  useEffect(() => {
    if (state.status === VoiceRecordingStatus.Stopped) {
      onSend(state.blob, state.mimeType, state.duration);
    } else if (state.status === VoiceRecordingStatus.Error) {
      onCancel();
    }
  }, [state, onSend, onCancel]);

  const handleCancel = () => {
    cancelRecording();
    onCancel();
  };

  const isRecording = state.status === VoiceRecordingStatus.Recording;
  const isRequesting = state.status === VoiceRecordingStatus.Requesting;
  const duration = state.status === VoiceRecordingStatus.Recording ? state.duration : 0;

  return (
    <div className={editorCss.Editor}>
      <Box alignItems="Center" gap="300" style={{ padding: `${config.space.S200}` }}>
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
              backgroundColor: isRecording
                ? color.Critical.Main
                : color.SurfaceVariant.OnContainer,
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
            <Icon src={Icons.Send} />
          </IconButton>
        </Box>
      </Box>
    </div>
  );
}
