import type { ReactNode } from 'react';
import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
} from 'folds';
import classNames from 'classnames';
import { BlurhashCanvas } from 'react-blurhash';
import { useAtom, useSetAtom } from 'jotai';
import type { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import type { IImageInfo } from '../../../../types/matrix/common';
import { MATRIX_BLUR_HASH_PROPERTY_NAME } from '../../../../types/matrix/common';
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
import { hiddenImagesAtom, MessageEventIdContext } from '../../../state/hiddenImages';

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
  /**
   * Override the default "click opens single-image viewer" behavior. When
   * set, called with the resolved http src and alt text. The grid renderer
   * uses this to open the viewer with gallery context instead.
   */
  onView?: (src: string, alt: string) => void;
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
      onView,
      renderImage,
      ...props
    },
    ref
  ) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const blurHash = validBlurHash(info?.[MATRIX_BLUR_HASH_PROPERTY_NAME]);

    const [pauseGifs] = useSetting(settingsAtom, 'pauseGifs');
    const isGif = mimeType === 'image/gif' || mimeType === 'image/apng';
    const shouldPauseGif = pauseGifs && isGif;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const loadedImgRef = useRef<HTMLImageElement | null>(null);
    const [isHovered, setIsHovered] = useState(false);

    const setViewerState = useSetAtom(imageViewerAtom);

    const messageEventId = useContext(MessageEventIdContext);
    const [hiddenImages, setHiddenImages] = useAtom(hiddenImagesAtom);
    const isForceHidden = messageEventId ? hiddenImages.has(messageEventId) : false;

    const [load, setLoad] = useState(false);
    const [error, setError] = useState(false);
    const [blurred, setBlurred] = useState(markedAsSpoiler ?? false);
    const effectiveBlurred = blurred || isForceHidden;

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
      if (shouldPauseGif) loadedImgRef.current = evt.currentTarget;
      setLoad(true);
    };

    useLayoutEffect(() => {
      if (!shouldPauseGif || !load || !loadedImgRef.current || !canvasRef.current) return;
      const img = loadedImgRef.current;
      const canvas = canvasRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
    }, [shouldPauseGif, load, effectiveBlurred]);
    const handleError = () => {
      setLoad(false);
      setError(true);
    };

    const handleRetry = () => {
      setError(false);
      loadSrc();
    };

    useEffect(() => {
      if (autoPlay || isForceHidden) loadSrc();
    }, [autoPlay, isForceHidden, loadSrc]);

    const handleView = useCallback(
      (resolvedSrc: string) => {
        if (onView) onView(resolvedSrc, body);
        else setViewerState({ src: resolvedSrc, alt: body });
      },
      [onView, body, setViewerState]
    );

    return (
      <Box className={classNames(css.RelativeBase, className)} {...props} ref={ref}>
        {typeof blurHash === 'string' && !load && (
          <Box className={css.AbsoluteContainer}>
            <BlurhashCanvas
              style={{
                width: '100%',
                height: '100%',
              }}
              width={32}
              height={32}
              hash={blurHash}
              punch={1}
            />
          </Box>
        )}
        {!autoPlay &&
          !markedAsSpoiler &&
          !isForceHidden &&
          srcState.status === AsyncStatus.Idle && (
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
            className={classNames(css.AbsoluteContainer, effectiveBlurred && css.Blur)}
            style={effectiveBlurred ? { opacity: 0.6 } : undefined}
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
                ...(shouldPauseGif && load && !isHovered ? { visibility: 'hidden' as const } : {}),
              },
              onLoad: handleLoad,
              onError: handleError,
              onClick: () => handleView(srcState.data),
              tabIndex: 0,
            })}
          </Box>
        )}
        {shouldPauseGif && load && !effectiveBlurred && srcState.status === AsyncStatus.Success && (
          <div
            role="button"
            tabIndex={0}
            aria-label={body}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              cursor: 'pointer',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => handleView(srcState.data)}
            onKeyDown={(evt) => {
              if (evt.key === 'Enter' || evt.key === ' ') {
                evt.preventDefault();
                handleView(srcState.data);
              }
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                display: isHovered ? 'none' : 'block',
                pointerEvents: 'none',
              }}
            />
          </div>
        )}
        {effectiveBlurred && !error && srcState.status !== AsyncStatus.Error && (
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
                    if (isForceHidden && messageEventId) {
                      setHiddenImages((prev: Set<string>) => {
                        const next = new Set(prev);
                        next.delete(messageEventId);
                        return next;
                      });
                    }
                    setBlurred(false);
                    if (srcState.status === AsyncStatus.Idle) {
                      loadSrc();
                    }
                  }}
                >
                  <Text size="B300">{isForceHidden ? 'Hidden' : 'Spoiler'}</Text>
                </Chip>
              )}
            </TooltipProvider>
          </Box>
        )}
        {(srcState.status === AsyncStatus.Loading || srcState.status === AsyncStatus.Success) &&
          !load &&
          !effectiveBlurred && (
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
