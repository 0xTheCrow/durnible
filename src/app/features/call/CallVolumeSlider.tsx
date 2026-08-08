import React from 'react';
import { Badge, Box, ProgressBar, Text, color, config, toRem } from 'folds';
import { Range } from 'react-range';
import { CALL_VOLUME_LEVEL_MAX, CALL_VOLUME_LEVEL_MIN } from '../../state/callVolumePreferences';

const VOLUME_LEVEL_STEP = 0.01;

type CallVolumeSliderProps = {
  label: string;
  volumeLevel: number;
  isDisabled?: boolean;
  onChange: (volumeLevel: number) => void;
  onCommit: (volumeLevel: number) => void;
};
export function CallVolumeSlider({
  label,
  volumeLevel,
  isDisabled,
  onChange,
  onCommit,
}: CallVolumeSliderProps) {
  return (
    <Box direction="Column" gap="200" style={{ padding: config.space.S200, width: toRem(200) }}>
      <Box alignItems="Center" justifyContent="SpaceBetween" gap="200">
        <Text size="T200" truncate>
          {label}
        </Text>
        <Text size="T200" priority="300">
          {Math.round(volumeLevel * 100)}%
        </Text>
      </Box>
      <Range
        disabled={isDisabled}
        step={VOLUME_LEVEL_STEP}
        min={CALL_VOLUME_LEVEL_MIN}
        max={CALL_VOLUME_LEVEL_MAX}
        values={[volumeLevel]}
        onChange={(values) => onChange(values[0])}
        onFinalChange={(values) => onCommit(values[0])}
        renderTrack={(params) => (
          <div
            {...params.props}
            style={{
              ...params.props.style,
              width: '100%',
              height: toRem(16),
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {params.children}
            <ProgressBar
              style={{ width: '100%', backgroundColor: color.SurfaceVariant.ContainerActive }}
              variant="Secondary"
              size="400"
              min={CALL_VOLUME_LEVEL_MIN}
              max={CALL_VOLUME_LEVEL_MAX}
              value={volumeLevel}
              radii="300"
            />
          </div>
        )}
        renderThumb={(params) => (
          <Badge
            size="400"
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
  );
}
