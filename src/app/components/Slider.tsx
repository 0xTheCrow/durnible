import type { ComponentProps } from 'react';
import React from 'react';
import { Badge, ProgressBar, toRem } from 'folds';
import { Range } from 'react-range';

type SliderSize = '300' | '400';

const THUMB_DIAMETER_PX: Record<SliderSize, number> = {
  '300': 12,
  '400': 16,
};

type SliderProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  size: SliderSize;
  isDisabled?: boolean;
  hitHeight?: string;
  fillValue?: number;
  fillVariant?: ComponentProps<typeof ProgressBar>['variant'];
  trackBackgroundColor?: string;
  thumbTestId?: string;
  trackTestId?: string;
  onChange: (value: number) => void;
  onFinalChange?: (value: number) => void;
};
export function Slider({
  value,
  min,
  max,
  step,
  size,
  isDisabled,
  hitHeight,
  fillValue,
  fillVariant,
  trackBackgroundColor,
  thumbTestId,
  trackTestId,
  onChange,
  onFinalChange,
}: SliderProps) {
  const thumbDiameter = toRem(THUMB_DIAMETER_PX[size]);
  const thumbInset = toRem(THUMB_DIAMETER_PX[size] / 2);

  return (
    <Range
      disabled={isDisabled}
      step={step}
      min={min}
      max={max}
      values={[value]}
      onChange={(values) => onChange(values[0])}
      onFinalChange={onFinalChange && ((values) => onFinalChange(values[0]))}
      renderTrack={(params) => (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            height: thumbDiameter,
          }}
        >
          <ProgressBar
            as="div"
            style={{ width: '100%', backgroundColor: trackBackgroundColor }}
            variant={fillVariant}
            size={size}
            min={min}
            max={max}
            value={fillValue ?? value}
            radii="300"
          />
          <div
            {...params.props}
            data-testid={trackTestId}
            style={{
              ...params.props.style,
              position: 'absolute',
              left: thumbInset,
              right: thumbInset,
              top: '50%',
              height: hitHeight ?? thumbDiameter,
              transform: `translateY(-50%) ${params.props.style?.transform ?? ''}`,
            }}
          >
            {params.children}
          </div>
        </div>
      )}
      renderThumb={(params) => (
        <Badge
          size={size}
          variant="Secondary"
          fill="Solid"
          radii="Pill"
          outlined
          data-testid={thumbTestId}
          {...params.props}
          style={{ ...params.props.style, zIndex: 0 }}
        />
      )}
    />
  );
}
