import React, { useRef, useState } from 'react';
import classNames from 'classnames';
import { Box, Header, Icon, Icons, Text } from 'folds';
import type { CropperRef } from 'react-advanced-cropper';
import { Cropper } from 'react-advanced-cropper';
import 'react-advanced-cropper/dist/style.css';
import * as css from './ImageEditor.css';
import { loadImageElement } from '../../utils/dom';

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
  ctx.translate(canvasWidth / 2, imageHeight / 2);
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
  const [cropMode, setCropMode] = useState(false);
  const [rotation, setRotation] = useState(0);

  const rotateCounterClockwise = () => {
    if (cropMode) {
      cropperRef.current?.rotateImage(90, { transitions: false });
    } else {
      setRotation((r) => (r + 90) % 360);
    }
  };

  const rotateClockwise = () => {
    if (cropMode) {
      cropperRef.current?.rotateImage(-90, { transitions: false });
    } else {
      setRotation((r) => (r - 90 + 360) % 360);
    }
  };

  const enterCropMode = () => setCropMode(true);
  const exitCropMode = () => setCropMode(false);

  const handleCropperReady = () => {
    const image = cropperRef.current?.getImage();
    if (image) {
      cropperRef.current?.setCoordinates(
        {
          left: 0,
          top: 0,
          width: image.width,
          height: image.height,
        },
        { transitions: false }
      );
    }
    if (rotation !== 0) {
      cropperRef.current?.rotateImage(rotation, { transitions: false });
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
    <Box className={classNames(css.ImageEditor, css.ImageEditorExpanded)} direction="Column">
      <Header className={css.ImageEditorHeader} size="500">
        <button
          type="button"
          className={css.ImageEditorCloseButton}
          onClick={onClose}
          aria-label="Close"
        >
          <Icon size="200" src={Icons.ArrowLeft} />
        </button>
        <Box grow="Yes" alignItems="Center" gap="300">
          <Text size="T400" truncate>
            {name}
          </Text>
        </Box>
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
      </Header>
      <Box
        grow="Yes"
        className={css.ImageEditorContent}
        alignItems="Center"
        justifyContent="Center"
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
            className={css.ImageEditorPreview}
            src={url}
            alt={name}
            draggable={false}
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        )}
      </Box>
    </Box>
  );
}
