import { useCallback, useState } from 'react';

export const useZoom = (step: number, min = 0.1, max = 5) => {
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

  const scrollStep = step / 2;
  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      setZoom((z) => {
        const newZ = event.deltaY < 0 ? z + scrollStep : z - scrollStep;
        return Math.min(max, Math.max(min, newZ));
      });
    },
    [scrollStep, min, max]
  );

  return {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    onWheel,
  };
};
