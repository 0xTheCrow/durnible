import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Chip,
  Icon,
  Icons,
  Spinner,
  Text,
  Tooltip,
  TooltipProvider,
  as,
  color,
} from 'folds';
import classNames from 'classnames';
import { BlurhashCanvas } from 'react-blurhash';
import { useSetAtom } from 'jotai';
import { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import { IImageInfo, MATRIX_BLUR_HASH_PROPERTY_NAME } from '../../../../types/matrix/common';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import * as css from './style.css';
import { bytesToSize } from '../../../utils/common';
import { FALLBACK_MIMETYPE } from '../../../utils/mimeTypes';
import { decryptFile, downloadEncryptedMedia, mxcUrlToHttp } from '../../../utils/matrix';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { validBlurHash } from '../../../utils/blurHash';
import { imageViewerAtom } from '../../../state/imageViewer';

type RenderImageProps = {
  alt: string;
  title: string;
  src: string;
  style?: React.CSSProperties;
  onLoad: (evt: React.SyntheticEvent<HTMLImageElement>) => void;
  onError: () => void;
  onClick: () => void;
  tabIndex: number;
};
export type ImageContentProps = {
  body: string;
  mimeType?: string;
  url: string;
  info?: IImageInfo;
  encInfo?: EncryptedAttachmentInfo;
  autoPlay?: boolean;
  markedAsSpoiler?: boolean;
  spoilerReason?: string;
  renderImage: (props: RenderImageProps) => ReactNode;
};
export const ImageContent = as<'div', ImageContentProps>(
  (
    {
      className,
      body,
      mimeType,
      url,
      info,
      encInfo,
      autoPlay,
      markedAsSpoiler,
      spoilerReason,
      renderImage,
      ...props
    },
    ref
  ) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const setImageViewer = useSetAtom(imageViewerAtom);
    const blurHash = validBlurHash(info?.[MATRIX_BLUR_HASH_PROPERTY_NAME]);

    const [pauseGifs] = useSetting(settingsAtom, 'pauseGifs');
    const isGif = mimeType === 'image/gif' || mimeType === 'image/apng';
    const shouldPauseGif = pauseGifs && isGif;

    const loadedImgRef = useRef<HTMLImageElement | null>(null);
    const [isHovered, setIsHovered] = useState(false);

    const [load, setLoad] = useState(false);
    const [error, setError] = useState(false);
    const [blurred, setBlurred] = useState(markedAsSpoiler ?? false);

    const [srcState, loadSrc] = useAsyncCallback(
      useCallback(async () => {
        const mediaUrl = mxcUrlToHttp(mx, url, useAuthentication) ?? url;
        if (encInfo) {
          const fileContent = await downloadEncryptedMedia(mediaUrl, (encBuf) =>
            decryptFile(encBuf, mimeType ?? FALLBACK_MIMETYPE, encInfo)
          );
          return URL.createObjectURL(fileContent);
        }
        return mediaUrl;
      }, [mx, url, useAuthentication, mimeType, encInfo])
    );

    const handleLoad = (evt: React.SyntheticEvent<HTMLImageElement>) => {
      loadedImgRef.current = evt.currentTarget;
      setLoad(true);
    };

    // Use a callback ref so the canvas is drawn every time the element mounts
    // (e.g., after spoiler reveal or source retry)
    const canvasCallbackRef = useCallback(
      (canvas: HTMLCanvasElement | null) => {
        if (!canvas || !loadedImgRef.current) return;
        const img = loadedImgRef.current;
        if (img.naturalWidth === 0 || img.naturalHeight === 0) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [load]
    );

    const handleError = () => {
      setLoad(false);
      setError(true);
    };

    const handleRetry = () => {
      setError(false);
      loadSrc();
    };

    useEffect(() => {
      if (autoPlay) loadSrc();
    }, [autoPlay, loadSrc]);

    const openViewer = () => {
      if (srcState.status === AsyncStatus.Success) {
        setImageViewer({ src: srcState.data, alt: body });
      }
    };

    return (
      <Box className={classNames(css.RelativeBase, className)} {...props} ref={ref}>
        {typeof blurHash === 'string' && !load && (
          <BlurhashCanvas
            style={{ width: '100%', height: '100%' }}
            width={32}
            height={32}
            hash={blurHash}
            punch={1}
          />
        )}
        {!autoPlay && !markedAsSpoiler && srcState.status === AsyncStatus.Idle && (
          <Box className={css.AbsoluteContainer} alignItems="Center" justifyContent="Center">
            <Button
              variant="Secondary"
              fill="Solid"
              radii="300"
              size="300"
              onClick={loadSrc}
              before={<Icon size="Inherit" src={Icons.Photo} filled />}
            >
              <Text size="B300">View</Text>
            </Button>
          </Box>
        )}
        {srcState.status === AsyncStatus.Success && (
          <Box
            className={classNames(css.AbsoluteContainer, blurred && css.Blur)}
            onMouseEnter={shouldPauseGif ? () => setIsHovered(true) : undefined}
            onMouseLeave={shouldPauseGif ? () => setIsHovered(false) : undefined}
            onClick={openViewer}
            style={shouldPauseGif ? { cursor: 'pointer' } : undefined}
          >
            {renderImage({
              alt: body,
              title: body,
              src: srcState.data,
              style: {
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
                maxHeight: '100%',
              },
              onLoad: handleLoad,
              onError: handleError,
              onClick: openViewer,
              tabIndex: 0,
            })}
            {shouldPauseGif && load && !blurred && (
              <canvas
                ref={canvasCallbackRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  backgroundColor: color.Surface.Container,
                  visibility: isHovered ? 'hidden' : 'visible',
                }}
              />
            )}
          </Box>
        )}
        {blurred && !error && srcState.status !== AsyncStatus.Error && (
          <Box className={css.AbsoluteContainer} alignItems="Center" justifyContent="Center">
            <TooltipProvider
              tooltip={
                typeof spoilerReason === 'string' && (
                  <Tooltip variant="Secondary">
                    <Text>{spoilerReason}</Text>
                  </Tooltip>
                )
              }
              position="Top"
              align="Center"
            >
              {(triggerRef) => (
                <Chip
                  ref={triggerRef}
                  variant="Secondary"
                  radii="Pill"
                  size="500"
                  outlined
                  onClick={() => {
                    setBlurred(false);
                    if (srcState.status === AsyncStatus.Idle) {
                      loadSrc();
                    }
                  }}
                >
                  <Text size="B300">Spoiler</Text>
                </Chip>
              )}
            </TooltipProvider>
          </Box>
        )}
        {(srcState.status === AsyncStatus.Loading || srcState.status === AsyncStatus.Success) &&
          !load &&
          !blurred && (
            <Box className={css.AbsoluteContainer} alignItems="Center" justifyContent="Center">
              <Spinner variant="Secondary" />
            </Box>
          )}
        {(error || srcState.status === AsyncStatus.Error) && (
          <Box className={css.AbsoluteContainer} alignItems="Center" justifyContent="Center">
            <TooltipProvider
              tooltip={
                <Tooltip variant="Critical">
                  <Text>Failed to load image!</Text>
                </Tooltip>
              }
              position="Top"
              align="Center"
            >
              {(triggerRef) => (
                <Button
                  ref={triggerRef}
                  size="300"
                  variant="Critical"
                  fill="Soft"
                  outlined
                  radii="300"
                  onClick={handleRetry}
                  before={<Icon size="Inherit" src={Icons.Warning} filled />}
                >
                  <Text size="B300">Retry</Text>
                </Button>
              )}
            </TooltipProvider>
          </Box>
        )}
        {!load && typeof info?.size === 'number' && (
          <Box className={css.AbsoluteFooter} justifyContent="End" alignContent="Center" gap="200">
            <Badge variant="Secondary" fill="Soft">
              <Text size="L400">{bytesToSize(info.size)}</Text>
            </Badge>
          </Box>
        )}
      </Box>
    );
  }
);
