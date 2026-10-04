import React from 'react';
import { Box, Icon, IconButton, Icons, Text, color, config, toRem } from 'folds';
import { Slider } from '../../components/Slider';
import {
  CALL_VOLUME_LEVEL_MAX,
  CALL_VOLUME_LEVEL_MIN,
  CALL_VOLUME_LEVEL_STEP,
} from '../../state/callVolumePreferences';

type CallVolumeSliderProps = {
  label: string;
  thumbTestId?: string;
  volumeLevel: number;
  isDisabled?: boolean;
  isMuted?: boolean;
  muteLabel?: string;
  onToggleMute?: () => void;
  onChange: (volumeLevel: number) => void;
  onCommit: (volumeLevel: number) => void;
};
export function CallVolumeSlider({
  label,
  thumbTestId,
  volumeLevel,
  isDisabled,
  isMuted,
  muteLabel,
  onToggleMute,
  onChange,
  onCommit,
}: CallVolumeSliderProps) {
  return (
    <Box direction="Column" gap="200" style={{ padding: config.space.S200, width: toRem(200) }}>
      <Box alignItems="Center" gap="200">
        {onToggleMute && (
          <IconButton
            size="300"
            radii="300"
            fill="None"
            variant={isMuted ? 'Critical' : 'SurfaceVariant'}
            onClick={onToggleMute}
            aria-pressed={isMuted}
            aria-label={muteLabel}
          >
            <Icon size="50" src={isMuted ? Icons.VolumeMute : Icons.VolumeHigh} filled={isMuted} />
          </IconButton>
        )}
        <Box grow="Yes">
          <Text size="T200" truncate>
            {label}
          </Text>
        </Box>
        <Text size="T200" priority="300">
          {Math.round(volumeLevel * 100)}%
        </Text>
      </Box>
      <Slider
        size="400"
        isDisabled={isDisabled}
        step={CALL_VOLUME_LEVEL_STEP}
        min={CALL_VOLUME_LEVEL_MIN}
        max={CALL_VOLUME_LEVEL_MAX}
        value={volumeLevel}
        trackBackgroundColor={color.SurfaceVariant.ContainerActive}
        thumbTestId={thumbTestId}
        onChange={onChange}
        onFinalChange={onCommit}
      />
    </Box>
  );
}
