import type { ReactNode } from 'react';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Box, Button, Chip, Icon, Icons, Spinner, Text, Tooltip, as } from 'folds';
import classNames from 'classnames';
import { BlurhashCanvas } from 'react-blurhash';
import type { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import { useAtom } from 'jotai';
import { TooltipProvider } from '../../TooltipProvider';
import type { ThumbnailContent, VideoInfo } from '../../../../types/matrix/common';
import { MATRIX_BLUR_HASH_PROPERTY_NAME } from '../../../../types/matrix/common';
import * as css from './style.css';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAutoLoadAsyncCallback } from '../../../hooks/useAsyncCallback';
import { bytesToSize, millisecondsToMinutesAndSeconds } from '../../../utils/common';
import {
  decryptFile,
  downloadEncryptedMedia,
  downloadMedia,
  mxcUrlToHttp,
} from '../../../utils/matrix';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { validBlurHash } from '../../../utils/blurHash';
import { hiddenImagesAtom, MessageEventIdContext } from '../../../state/hiddenImages';
import knownGoodControlVideoUrl from '../../../../../public/res/video-debug-control.mp4';

type VideoElementWithFirefoxDebugInfo = HTMLVideoElement & {
  mozRequestDebugInfo?: () => Promise<unknown>;
};

const logMozRequestDebugInfo = (videoElement: HTMLVideoElement, label: string) => {
  const debugCapableElement = videoElement as VideoElementWithFirefoxDebugInfo;
  if (typeof debugCapableElement.mozRequestDebugInfo !== 'function') {
    console.log(`[video-debug] diagnostics(${label}): mozRequestDebugInfo unavailable`, {
      timestamp: Date.now(),
    });
    return;
  }
  debugCapableElement
    .mozRequestDebugInfo()
    .then((debugInfo) =>
      console.log(
        `[video-debug] diagnostics(${label}): mozRequestDebugInfo`,
        JSON.stringify(debugInfo, null, 2)
      )
    )
    .catch((reason) =>
      console.log(`[video-debug] diagnostics(${label}): mozRequestDebugInfo failed`, {
        timestamp: Date.now(),
        reason,
      })
    );
};

const logMediaElementCensus = () => {
  const mediaElements = Array.from(document.querySelectorAll<HTMLMediaElement>('video, audio'));
  console.log('[video-debug] diagnostics: media element census', {
    timestamp: Date.now(),
    count: mediaElements.length,
    elements: mediaElements.map((mediaElement, index) => ({
      index,
      tag: mediaElement.tagName,
      src: mediaElement.currentSrc.slice(0, 70),
      readyState: mediaElement.readyState,
      networkState: mediaElement.networkState,
      paused: mediaElement.paused,
      muted: mediaElement.muted,
      autoplay: mediaElement.autoplay,
      error: mediaElement.error
        ? { code: mediaElement.error.code, message: mediaElement.error.message }
        : null,
    })),
  });
};

const spawnControlVideo = (
  src: string,
  label: string,
  isMuted: boolean,
  bottomPixels: number,
  borderColor: string
) => {
  const controlVideoElement = document.createElement('video');
  controlVideoElement.controls = true;
  controlVideoElement.autoplay = true;
  controlVideoElement.muted = isMuted;
  controlVideoElement.style.cssText = [
    'position:fixed',
    `bottom:${bottomPixels}px`,
    'left:8px',
    'width:200px',
    'z-index:99999',
    'background:#000',
    `border:3px solid ${borderColor}`,
  ].join(';');
  const controlEventNames = [
    'loadstart',
    'suspend',
    'progress',
    'loadedmetadata',
    'loadeddata',
    'canplay',
    'canplaythrough',
    'playing',
    'waiting',
    'stalled',
    'error',
  ];
  controlEventNames.forEach((eventName) =>
    controlVideoElement.addEventListener(eventName, () =>
      console.log(`[video-debug] diagnostics(${label}): event ${eventName}`, {
        timestamp: Date.now(),
        readyState: controlVideoElement.readyState,
        networkState: controlVideoElement.networkState,
        error: controlVideoElement.error
          ? { code: controlVideoElement.error.code, message: controlVideoElement.error.message }
          : null,
      })
    )
  );
  controlVideoElement.src = src;
  document.body.append(controlVideoElement);
  console.log(`[video-debug] diagnostics(${label}): appended`, { timestamp: Date.now() });
};

type RenderVideoProps = {
  title: string;
  src: string;
  onLoadedMetadata: () => void;
  onError: () => void;
  autoPlay: boolean;
  controls: boolean;
};
type VideoContentProps = {
  body: string;
  mimeType: string;
  url: string;
  info: VideoInfo & ThumbnailContent;
  encryptionInfo?: EncryptedAttachmentInfo;
  autoPlay?: boolean;
  markedAsSpoiler?: boolean;
  spoilerReason?: string;
  renderThumbnail?: () => ReactNode;
  renderVideo: (props: RenderVideoProps) => ReactNode;
};
export const VideoContent = as<'div', VideoContentProps>(
  (
    {
      className,
      body,
      mimeType,
      url,
      info,
      encryptionInfo,
      autoPlay,
      markedAsSpoiler,
      spoilerReason,
      renderThumbnail,
      renderVideo,
      ...props
    },
    ref
  ) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const blurHash = validBlurHash(info.thumbnail_info?.[MATRIX_BLUR_HASH_PROPERTY_NAME]);

    const messageEventId = useContext(MessageEventIdContext);
    const [hiddenImages, setHiddenImages] = useAtom(hiddenImagesAtom);
    const isForceHidden = messageEventId ? hiddenImages.has(messageEventId) : false;

    const [load, setLoad] = useState(false);
    const [error, setError] = useState(false);
    const [blurred, setBlurred] = useState(markedAsSpoiler ?? false);
    const effectiveBlurred = blurred || isForceHidden;

    const [dataUriSrc, setDataUriSrc] = useState<string | undefined>(undefined);
    const hasAttemptedDataUriFallbackRef = useRef(false);
    const hasRunHangDiagnosticsRef = useRef(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const [srcState, loadSrc] = useAutoLoadAsyncCallback(
      useCallback(async () => {
        console.log('[video-debug] download start', {
          timestamp: Date.now(),
          url,
          mimeType,
          encrypted: !!encryptionInfo,
        });
        const mediaUrl = mxcUrlToHttp(mx, url, useAuthentication) ?? url;
        const fileContent = encryptionInfo
          ? await downloadEncryptedMedia(mediaUrl, (encBuf) => {
              console.log('[video-debug] ciphertext fetched, decrypting', {
                timestamp: Date.now(),
                byteLength: encBuf.byteLength,
              });
              return decryptFile(encBuf, mimeType, encryptionInfo);
            })
          : await downloadMedia(mediaUrl);
        console.log('[video-debug] blob ready', {
          timestamp: Date.now(),
          size: fileContent.size,
          type: fileContent.type,
        });
        const objectUrl = URL.createObjectURL(fileContent);
        console.log('[video-debug] object URL created', { timestamp: Date.now(), objectUrl });
        return { blob: fileContent, objectUrl };
      }, [mx, url, useAuthentication, mimeType, encryptionInfo]),
      !!autoPlay
    );

    useEffect(() => {
      console.log('[video-debug] srcState changed', {
        timestamp: Date.now(),
        status: srcState.status,
      });
    }, [srcState.status]);

    const runHangDiagnostics = useCallback(() => {
      if (hasRunHangDiagnosticsRef.current) return;
      if (srcState.status !== AsyncStatus.Success) return;
      hasRunHangDiagnosticsRef.current = true;
      console.log('[video-debug] diagnostics: hang detected, starting diagnostics', {
        timestamp: Date.now(),
      });
      logMediaElementCensus();
      const hungVideoElement = containerRef.current?.querySelector('video');
      if (hungVideoElement) {
        logMozRequestDebugInfo(hungVideoElement, 'hung-element');
      } else {
        console.log('[video-debug] diagnostics: no video element found in container', {
          timestamp: Date.now(),
        });
      }
      spawnControlVideo(srcState.data.objectUrl, 'unmuted-control', false, 8, 'red');
      spawnControlVideo(srcState.data.objectUrl, 'muted-control', true, 150, 'lime');
      spawnControlVideo(knownGoodControlVideoUrl, 'known-good-control', true, 292, 'cyan');
      srcState.data.blob
        .arrayBuffer()
        .then((blobBuffer) => crypto.subtle.digest('SHA-256', blobBuffer))
        .then((digest) => {
          const sha256Hex = Array.from(new Uint8Array(digest))
            .map((byteValue) => byteValue.toString(16).padStart(2, '0'))
            .join('');
          console.log('[video-debug] diagnostics: decrypted blob sha256', {
            timestamp: Date.now(),
            sha256: sha256Hex,
            size: srcState.data.blob.size,
          });
        })
        .catch((reason) =>
          console.log('[video-debug] diagnostics: sha256 computation failed', {
            timestamp: Date.now(),
            reason,
          })
        );
    }, [srcState]);

    const triggerDataUriFallback = useCallback(() => {
      if (hasAttemptedDataUriFallbackRef.current) return;
      if (srcState.status !== AsyncStatus.Success) return;
      hasAttemptedDataUriFallbackRef.current = true;
      console.log('[video-debug] blob playback failed, converting to data URI', {
        timestamp: Date.now(),
      });
      const reader = new FileReader();
      reader.onload = () => {
        console.log('[video-debug] data URI fallback ready', { timestamp: Date.now() });
        setDataUriSrc(reader.result as string);
      };
      reader.onerror = () => {
        console.log('[video-debug] data URI fallback conversion failed', {
          timestamp: Date.now(),
          readerError: reader.error,
        });
        setError(true);
      };
      reader.readAsDataURL(srcState.data.blob);
    }, [srcState]);

    const handleLoad = () => {
      console.log('[video-debug] React onLoadedMetadata fired', { timestamp: Date.now() });
      setLoad(true);
    };
    const handleError = () => {
      console.log('[video-debug] React onError fired', { timestamp: Date.now() });
      setLoad(false);
      runHangDiagnostics();
      if (hasAttemptedDataUriFallbackRef.current) {
        setError(true);
      } else {
        triggerDataUriFallback();
      }
    };

    const handleRetry = () => {
      setError(false);
      hasAttemptedDataUriFallbackRef.current = false;
      hasRunHangDiagnosticsRef.current = false;
      setDataUriSrc(undefined);
      loadSrc();
    };

    const mergedRef = useMemo(() => {
      const setRef = (node: HTMLDivElement | null) => {
        containerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      };
      return setRef;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ref]);

    useEffect(() => {
      const containerElement = containerRef.current;
      if (!containerElement) return undefined;

      const observer = new IntersectionObserver(
        ([entry]) => {
          console.log('[video-debug] intersection', {
            timestamp: Date.now(),
            isIntersecting: entry.isIntersecting,
            intersectionRatio: entry.intersectionRatio,
            boundingClientRect: entry.boundingClientRect,
            rootBounds: entry.rootBounds,
          });
          if (!entry.isIntersecting) {
            containerElement.querySelectorAll('video').forEach((v) => {
              console.log('[video-debug] pausing video due to non-intersection', {
                timestamp: Date.now(),
                readyState: v.readyState,
                networkState: v.networkState,
                currentTime: v.currentTime,
                paused: v.paused,
              });
              v.pause();
            });
          }
        },
        { threshold: 0 }
      );
      observer.observe(containerElement);

      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (srcState.status !== AsyncStatus.Success) return undefined;
      const videoElement = containerRef.current?.querySelector('video');
      if (!videoElement) return undefined;

      const readState = () => ({
        timestamp: Date.now(),
        readyState: videoElement.readyState,
        networkState: videoElement.networkState,
        currentTime: videoElement.currentTime,
        duration: videoElement.duration,
        paused: videoElement.paused,
        currentSrc: videoElement.currentSrc,
        error: videoElement.error
          ? { code: videoElement.error.code, message: videoElement.error.message }
          : null,
      });

      const handleStalled = () => {
        console.log('[video-debug] video event: stalled', readState());
        runHangDiagnostics();
        if (hasAttemptedDataUriFallbackRef.current) {
          console.log('[video-debug] stalled again after data URI fallback, giving up', {
            timestamp: Date.now(),
          });
          logMozRequestDebugInfo(videoElement, 'data-uri-hung');
          setError(true);
        } else {
          console.log(
            '[video-debug] stalled fired on a fully-buffered blob source, triggering data URI fallback',
            { timestamp: Date.now() }
          );
          triggerDataUriFallback();
        }
      };

      const loggedOnlyEventNames = [
        'loadstart',
        'durationchange',
        'loadedmetadata',
        'loadeddata',
        'progress',
        'canplay',
        'canplaythrough',
        'playing',
        'play',
        'pause',
        'waiting',
        'suspend',
        'abort',
        'emptied',
        'error',
      ];
      const listeners = loggedOnlyEventNames.map((eventName) => {
        const listener = () => console.log(`[video-debug] video event: ${eventName}`, readState());
        videoElement.addEventListener(eventName, listener);
        return { eventName, listener };
      });
      videoElement.addEventListener('stalled', handleStalled);

      console.log('[video-debug] attached listeners to video element', readState());

      // Backstop only: `stalled`/`error` are the real signals and should catch this
      // almost immediately. This exists solely in case some variant of the bug
      // leaves the element silent forever without firing either.
      const BACKSTOP_TIMEOUT_MS = 15000;
      const backstopTimeout = setTimeout(() => {
        if (videoElement.readyState !== 0) return;
        console.log('[video-debug] backstop timeout reached with no stalled/error event', {
          timestamp: Date.now(),
          readyState: videoElement.readyState,
          networkState: videoElement.networkState,
          hasAttemptedDataUriFallback: hasAttemptedDataUriFallbackRef.current,
        });
        runHangDiagnostics();
        if (hasAttemptedDataUriFallbackRef.current) {
          setError(true);
        } else {
          triggerDataUriFallback();
        }
      }, BACKSTOP_TIMEOUT_MS);

      return () => {
        listeners.forEach(({ eventName, listener }) =>
          videoElement.removeEventListener(eventName, listener)
        );
        videoElement.removeEventListener('stalled', handleStalled);
        clearTimeout(backstopTimeout);
      };
    }, [srcState.status, triggerDataUriFallback, runHangDiagnostics]);

    useEffect(() => {
      if (!dataUriSrc) return;
      const videoElement = containerRef.current?.querySelector('video');
      if (!videoElement) return;
      console.log('[video-debug] reloading video element with data URI src', {
        timestamp: Date.now(),
      });
      videoElement.load();
    }, [dataUriSrc]);

    return (
      <Box className={classNames(css.RelativeBase, className)} {...props} ref={mergedRef}>
        {typeof blurHash === 'string' && !load && (
          <BlurhashCanvas
            style={{ width: '100%', height: '100%' }}
            width={32}
            height={32}
            hash={blurHash}
            punch={1}
          />
        )}
        {renderThumbnail && !load && (
          <Box
            className={classNames(css.AbsoluteContainer, effectiveBlurred && css.Blur)}
            style={effectiveBlurred ? { opacity: 0.6 } : undefined}
            alignItems="Center"
            justifyContent="Center"
          >
            {renderThumbnail()}
          </Box>
        )}
        {!autoPlay && !effectiveBlurred && srcState.status === AsyncStatus.Idle && (
          <Box className={css.AbsoluteContainer} alignItems="Center" justifyContent="Center">
            <Button
              variant="Secondary"
              fill="Solid"
              radii="400"
              size="500"
              onClick={loadSrc}
              before={<Icon size="Inherit" src={Icons.Play} filled />}
            >
              <Text size="B500">Watch</Text>
            </Button>
          </Box>
        )}
        {srcState.status === AsyncStatus.Success && (
          <Box
            className={classNames(css.AbsoluteContainer, effectiveBlurred && css.Blur)}
            style={effectiveBlurred ? { opacity: 0.6 } : undefined}
          >
            {renderVideo({
              title: body,
              src: dataUriSrc ?? srcState.data.objectUrl,
              onLoadedMetadata: handleLoad,
              onError: handleError,
              autoPlay: true,
              controls: true,
            })}
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
                  <Text>Failed to load video!</Text>
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
        {!load && typeof info.size === 'number' && (
          <Box
            className={css.AbsoluteFooter}
            justifyContent="SpaceBetween"
            alignContent="Center"
            gap="200"
          >
            <Badge variant="Secondary" fill="Soft">
              <Text size="L400">{millisecondsToMinutesAndSeconds(info.duration ?? 0)}</Text>
            </Badge>
            <Badge variant="Secondary" fill="Soft">
              <Text size="L400">{bytesToSize(info.size)}</Text>
            </Badge>
          </Box>
        )}
      </Box>
    );
  }
);
