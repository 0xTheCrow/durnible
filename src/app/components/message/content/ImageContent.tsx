import type { ReactNode } from 'react';
import React, { useCallback, useContext, useState } from 'react';
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
import type { ImageInfo } from '../../../../types/matrix/common';
import { MATRIX_BLUR_HASH_PROPERTY_NAME } from '../../../../types/matrix/common';
import { AsyncStatus, useAutoLoadAsyncCallback } from '../../../hooks/useAsyncCallback';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import * as css from './style.css';
import { bytesToSize } from '../../../utils/common';
import { FALLBACK_MIMETYPE, isAnimatedImageMimetype } from '../../../utils/mimeTypes';
import { decryptFile, downloadEncryptedMedia, mxcUrlToHttp } from '../../../utils/matrix';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { validBlurHash } from '../../../utils/blurHash';
import { imageViewerAtom } from '../../../state/imageViewer';
import { hiddenImagesAtom, MessageEventIdContext } from '../../../state/hiddenImages';
import { AnimatedImageOverlay } from '../../AnimatedImageOverlay';

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
  info?: ImageInfo;
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
    const isGif = isAnimatedImageMimetype(mimeType);
    const shouldPauseGif = pauseGifs && isGif;

    const setViewerState = useSetAtom(imageViewerAtom);

    const messageEventId = useContext(MessageEventIdContext);
    const [hiddenImages, setHiddenImages] = useAtom(hiddenImagesAtom);
    const isForceHidden = messageEventId ? hiddenImages.has(messageEventId) : false;

    const [load, setLoad] = useState(false);
    const [error, setError] = useState(false);
    const [blurred, setBlurred] = useState(markedAsSpoiler ?? false);
    const effectiveBlurred = blurred || isForceHidden;

    const [srcState, loadSrc] = useAutoLoadAsyncCallback(
      useCallback(async () => {
        const mediaUrl = mxcUrlToHttp(mx, url, useAuthentication) ?? url;
        if (encInfo) {
          const fileContent = await downloadEncryptedMedia(mediaUrl, (encBuf) =>
            decryptFile(encBuf, mimeType ?? FALLBACK_MIMETYPE, encInfo)
          );
          return URL.createObjectURL(fileContent);
        }
        return mediaUrl;
      }, [mx, url, useAuthentication, mimeType, encInfo]),
      !!(autoPlay || isForceHidden)
    );

    const handleLoad = () => {
      setLoad(true);
    };

    const handleError = () => {
      setLoad(false);
      setError(true);
    };

    const handleRetry = () => {
      setError(false);
      loadSrc();
    };

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
                data-testid="image-content-view-btn"
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
            {shouldPauseGif && !effectiveBlurred ? (
              <AnimatedImageOverlay
                src={srcState.data}
                alt={body}
                title={body}
                imgStyle={{
                  width: 'auto',
                  height: 'auto',
                  maxWidth: '100%',
                  maxHeight: '100%',
                }}
                onLoad={handleLoad}
                onError={handleError}
                onView={() => handleView(srcState.data)}
                renderImage={renderImage}
              />
            ) : (
              renderImage({
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
                onClick: () => handleView(srcState.data),
                tabIndex: 0,
              })
            )}
          </Box>
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
                  data-testid="image-content-spoiler-chip"
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
            <Badge variant="Secondary" fill="Soft" data-testid="image-content-size-badge">
              <Text size="L400">{bytesToSize(info.size)}</Text>
            </Badge>
          </Box>
        )}
      </Box>
    );
  }
);
