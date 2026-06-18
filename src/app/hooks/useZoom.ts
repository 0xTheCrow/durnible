import { useState } from 'react';
import { ZOOM_MAX, ZOOM_MIN } from '../utils/zoom';

export const useZoom = (step: number, min = ZOOM_MIN, max = ZOOM_MAX) => {
  const [zoom, setZoom] = useState<number>(1);

  const zoomIn = () => {
    setZoom((z) => {
      const newZ = z + step;
      return newZ > max ? z : newZ;
    });
  };

  const zoomOut = () => {
    setZoom((z) => {
      const newZ = z - step;
      return newZ < min ? z : newZ;
    });
  };

  return {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
  };
};
