import type { Pan } from '../hooks/usePan';

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 20;

export const PAN_VISIBLE_MARGIN = 300;

export const clampZoom = (zoom: number, min = ZOOM_MIN, max = ZOOM_MAX): number =>
  Math.min(max, Math.max(min, zoom));

export const panToKeepPointFixed = (
  rect: DOMRect,
  currentZoom: number,
  currentPan: Pan,
  nextZoom: number,
  pointX: number,
  pointY: number
): Pan => {
  const originScreenX = rect.left + rect.width / 2 - currentZoom * currentPan.translateX;
  const originScreenY = rect.top + rect.height / 2 - currentZoom * currentPan.translateY;
  const factor = 1 / nextZoom - 1 / currentZoom;
  return {
    translateX: currentPan.translateX + (pointX - originScreenX) * factor,
    translateY: currentPan.translateY + (pointY - originScreenY) * factor,
  };
};

export const clampPanWithinBounds = (
  pan: Pan,
  zoom: number,
  containerRect: DOMRect,
  imageWidth: number,
  imageHeight: number,
  margin = PAN_VISIBLE_MARGIN
): Pan => {
  const scaledWidth = imageWidth * zoom;
  const scaledHeight = imageHeight * zoom;
  const marginX = Math.min(margin, scaledWidth);
  const marginY = Math.min(margin, scaledHeight);

  const containerCenterX = containerRect.left + containerRect.width / 2;
  const containerCenterY = containerRect.top + containerRect.height / 2;

  const centerMinX = containerRect.left + marginX - scaledWidth / 2;
  const centerMaxX = containerRect.right - marginX + scaledWidth / 2;
  const centerMinY = containerRect.top + marginY - scaledHeight / 2;
  const centerMaxY = containerRect.bottom - marginY + scaledHeight / 2;

  const panMinX = (centerMinX - containerCenterX) / zoom;
  const panMaxX = (centerMaxX - containerCenterX) / zoom;
  const panMinY = (centerMinY - containerCenterY) / zoom;
  const panMaxY = (centerMaxY - containerCenterY) / zoom;

  return {
    translateX: Math.min(panMaxX, Math.max(panMinX, pan.translateX)),
    translateY: Math.min(panMaxY, Math.max(panMinY, pan.translateY)),
  };
};
