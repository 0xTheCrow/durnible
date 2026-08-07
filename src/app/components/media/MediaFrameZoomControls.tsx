import React from 'react';
import { Icon, Icons, Text } from 'folds';
import * as css from '../../styles/mediaFrame.css';

export type MediaFrameZoomControlsProps = {
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (zoom: number) => void;
  testIdPrefix?: string;
};

export function MediaFrameZoomControls({
  zoom,
  zoomIn,
  zoomOut,
  setZoom,
  testIdPrefix,
}: MediaFrameZoomControlsProps) {
  return (
    <div className={css.ZoomGroup}>
      <button
        type="button"
        data-testid={testIdPrefix && `${testIdPrefix}-zoom-out`}
        className={css.ZoomButton}
        onClick={zoomOut}
        aria-label="Zoom Out"
      >
        <Icon size="100" src={Icons.Minus} />
      </button>
      <button
        type="button"
        data-testid={testIdPrefix && `${testIdPrefix}-zoom-chip`}
        className={css.ZoomChip}
        onClick={() => setZoom(zoom === 1 ? 2 : 1)}
      >
        <Text size="B300" data-testid={testIdPrefix && `${testIdPrefix}-zoom-label`}>
          {Math.round(zoom * 100)}%
        </Text>
      </button>
      <button
        type="button"
        data-testid={testIdPrefix && `${testIdPrefix}-zoom-in`}
        className={css.ZoomButton}
        onClick={zoomIn}
        aria-label="Zoom In"
      >
        <Icon size="100" src={Icons.Plus} />
      </button>
    </div>
  );
}
