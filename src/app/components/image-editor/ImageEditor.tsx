import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Icon, Icons, Text } from 'folds';
import type { CropperRef } from 'react-advanced-cropper';
import { Cropper } from 'react-advanced-cropper';
import 'react-advanced-cropper/dist/style.css';
import * as css from './ImageEditor.css';
import { loadImageElement } from '../../utils/dom';
import { MediaFrame } from '../media';

function CropIcon() {
  return (
    <>
      <path
        d="M7 2 L7 17 L22 17"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="square"
      />
      <path
        d="M2 7 L17 7 L17 22"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="square"
      />
    </>
  );
}

const CANVAS_OUTPUT_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const pickOutputMimeType = (source: string | undefined): string => {
  if (source && CANVAS_OUTPUT_MIME_TYPES.has(source)) return source;
  return 'image/png';
};

const renderRotatedCanvas = async (
  url: string,
  rotation: number
): Promise<HTMLCanvasElement | null> => {
  const img = await loadImageElement(url);
  const imageWidth = img.naturalWidth;
  const imageHeight = img.naturalHeight;
  const isQuarter = rotation === 90 || rotation === 270;
  const canvasWidth = isQuarter ? imageHeight : imageWidth;
  const canvasHeight = isQuarter ? imageWidth : imageHeight;
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.translate(canvasWidth / 2, canvasHeight / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -imageWidth / 2, -imageHeight / 2);
  return canvas;
};

export type ImageEditorProps = {
  name: string;
  url: string;
  mimeType?: string;
  onClose: () => void;
  onSave?: (file: File) => void;
};

export function ImageEditor({ name, url, mimeType, onClose, onSave }: ImageEditorProps) {
  const cropperRef = useRef<CropperRef>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLImageElement>(null);
  const [cropMode, setCropMode] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [quarterTurnScale, setQuarterTurnScale] = useState(1);

  const measureQuarterTurnScale = useCallback(() => {
    const preview = previewRef.current;
    const content = contentRef.current;
    if (!preview || !content) return;
    const { offsetWidth: previewWidth, offsetHeight: previewHeight } = preview;
    if (previewWidth === 0 || previewHeight === 0) return;
    const scale = Math.min(
      content.clientWidth / previewHeight,
      content.clientHeight / previewWidth,
      1
    );
    setQuarterTurnScale(scale);
  }, []);

  useLayoutEffect(() => {
    if (!cropMode) measureQuarterTurnScale();
  }, [cropMode, measureQuarterTurnScale]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;
    const observer = new ResizeObserver(measureQuarterTurnScale);
    observer.observe(content);
    return () => observer.disconnect();
  }, [measureQuarterTurnScale]);

  const rotateCropImage = (angle: number) => {
    const before = cropperRef.current?.getCoordinates();
    const image = cropperRef.current?.getImage();
    const state = cropperRef.current?.getState();
    if (!before || !image || !state) {
      cropperRef.current?.rotateImage(angle, { transitions: false });
      return;
    }
    const quarterTurned = Math.abs(Math.round(state.transforms.rotate / 90)) % 2 === 1;
    const transformedWidth = quarterTurned ? image.height : image.width;
    const transformedHeight = quarterTurned ? image.width : image.height;
    const centerX = before.left + before.width / 2;
    const centerY = before.top + before.height / 2;
    const rotatedCenterX = angle > 0 ? transformedHeight - centerY : centerY;
    const rotatedCenterY = angle > 0 ? centerX : transformedWidth - centerX;
    cropperRef.current?.rotateImage(angle, { transitions: false });
    cropperRef.current?.setCoordinates(
      {
        left: rotatedCenterX - before.height / 2,
        top: rotatedCenterY - before.width / 2,
        width: before.height,
        height: before.width,
      },
      { transitions: false }
    );
  };

  const rotateCounterClockwise = () => {
    if (cropMode) {
      rotateCropImage(90);
    } else {
      setRotation((r) => (r + 90) % 360);
    }
  };

  const rotateClockwise = () => {
    if (cropMode) {
      rotateCropImage(-90);
    } else {
      setRotation((r) => (r - 90 + 360) % 360);
    }
  };

  const enterCropMode = () => setCropMode(true);
  const exitCropMode = () => setCropMode(false);

  const handleCropperReady = () => {
    if (rotation !== 0) {
      cropperRef.current?.rotateImage(rotation, { transitions: false });
    }
    const image = cropperRef.current?.getImage();
    if (image) {
      const quarterTurn = rotation === 90 || rotation === 270;
      cropperRef.current?.setCoordinates(
        {
          left: 0,
          top: 0,
          width: quarterTurn ? image.height : image.width,
          height: quarterTurn ? image.width : image.height,
        },
        { transitions: false }
      );
    }
  };

  const handleSave = async () => {
    const outputMimeType = pickOutputMimeType(mimeType);
    let canvas: HTMLCanvasElement | null;
    try {
      canvas = cropMode
        ? cropperRef.current?.getCanvas() ?? null
        : await renderRotatedCanvas(url, rotation);
    } catch (err) {
      console.error('ImageEditor: failed to render canvas', err);
      return;
    }
    if (!canvas) {
      console.error('ImageEditor: canvas unavailable');
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('ImageEditor: canvas.toBlob returned null');
        return;
      }
      onSave?.(new File([blob], name, { type: outputMimeType }));
      onClose();
    }, outputMimeType);
  };

  return (
    <MediaFrame
      expanded
      name={name}
      onClose={onClose}
      headerAfter={
        <>
          <div className={css.ImageEditorRotateGroup}>
            <button
              type="button"
              className={css.ImageEditorToolButton}
              onClick={rotateClockwise}
              aria-label="Rotate Right"
            >
              <Icon size="100" src={Icons.Reload} />
            </button>
            <button
              type="button"
              className={css.ImageEditorToolButton}
              onClick={rotateCounterClockwise}
              aria-label="Rotate Left"
            >
              <Icon size="100" src={Icons.Reload} className={css.ImageEditorMirroredIcon} />
            </button>
          </div>
          <button
            type="button"
            className={css.ImageEditorCropToggle}
            onClick={cropMode ? exitCropMode : enterCropMode}
            aria-pressed={cropMode}
            aria-label={cropMode ? 'Exit Crop Mode' : 'Enter Crop Mode'}
          >
            <Icon size="100" src={cropMode ? Icons.Cross : CropIcon} />
            <Text size="B300">Crop</Text>
          </button>
          {onSave && (
            <button
              type="button"
              className={css.ImageEditorSaveButton}
              onClick={handleSave}
              aria-label="Save"
            >
              <Icon size="100" src={Icons.Check} />
              <Text size="B300" as="span">
                Save
              </Text>
            </button>
          )}
        </>
      }
    >
      <Box
        grow="Yes"
        className={css.ImageEditorContent}
        alignItems="Center"
        justifyContent="Center"
        ref={contentRef}
      >
        {cropMode ? (
          <Cropper
            ref={cropperRef}
            src={url}
            className={css.ImageEditorCropper}
            onReady={handleCropperReady}
          />
        ) : (
          <img
            ref={previewRef}
            className={css.ImageEditorPreview}
            src={url}
            alt={name}
            draggable={false}
            onLoad={measureQuarterTurnScale}
            style={{
              transform: `rotate(${rotation}deg) scale(${
                rotation % 180 === 0 ? 1 : quarterTurnScale
              })`,
            }}
          />
        )}
      </Box>
    </MediaFrame>
  );
}
