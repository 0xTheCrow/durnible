import type { PointerEvent } from 'react';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Room } from 'matrix-js-sdk';
import type { ElementInfo } from 'livekit-client';
import { RemoteVideoTrack, Track } from 'livekit-client';
import { useSetAtom } from 'jotai';
import { Box, Icon, Icons, Text } from 'folds';
import classNames from 'classnames';
import type { CallPopOut } from '../../state/call';
import { callPopOutAtom } from '../../state/call';
import { useParticipantTrackPublications } from '../../hooks/call/useParticipantTrackPublications';
import { useRoomName } from '../../hooks/room/useRoomMeta';
import {
  checkIsDesktopApp,
  dragDesktopCallPopOutWindow,
  endDesktopCallPopOutWindowDrag,
  startDesktopCallPopOutWindowDrag,
} from '../../platform/desktop';
import { copyDocumentStyles } from '../../plugins/call/popOutWindow';
import * as paneCss from './CallPane.css';
import * as css from './CallPopOut.css';

class PopOutWindowElementInfo implements ElementInfo {
  visible = true;

  pictureInPicture = true;

  visibilityChangedAt: number | undefined;

  handleResize?: () => void;

  handleVisibilityChanged?: () => void;

  readonly element: HTMLVideoElement;

  private readonly popOutWindow: Window;

  constructor(element: HTMLVideoElement, popOutWindow: Window) {
    this.element = element;
    this.popOutWindow = popOutWindow;
  }

  private readonly handleWindowResize = () => this.handleResize?.();

  width(): number {
    return this.element.clientWidth;
  }

  height(): number {
    return this.element.clientHeight;
  }

  observe(): void {
    this.popOutWindow.addEventListener('resize', this.handleWindowResize);
  }

  stopObserving(): void {
    this.popOutWindow.removeEventListener('resize', this.handleWindowResize);
  }
}

type CallPopOutWindowProps = {
  popOut: CallPopOut;
  room: Room;
};
export function CallPopOutWindow({ popOut, room }: CallPopOutWindowProps) {
  const { participant, source, displayName, popOutWindow } = popOut;
  const setCallPopOut = useSetAtom(callPopOutAtom);
  const roomName = useRoomName(room);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackPublications = useParticipantTrackPublications(participant);
  const videoPublication = trackPublications.find((publication) => publication.source === source);
  const videoTrack = videoPublication?.isMuted ? undefined : videoPublication?.track;
  const isDesktopApp = checkIsDesktopApp();
  const isMirrored = participant.isLocal && source === Track.Source.Camera;

  useEffect(() => {
    copyDocumentStyles(popOutWindow.document);
    const clearPopOut = () =>
      setCallPopOut((currentPopOut) =>
        currentPopOut?.popOutWindow === popOutWindow ? undefined : currentPopOut
      );
    const closePopOutWindow = () => popOutWindow.close();
    popOutWindow.addEventListener('pagehide', clearPopOut);
    window.addEventListener('pagehide', closePopOutWindow);
    return () => {
      popOutWindow.removeEventListener('pagehide', clearPopOut);
      window.removeEventListener('pagehide', closePopOutWindow);
      closePopOutWindow();
    };
  }, [popOutWindow, setCallPopOut]);

  useEffect(() => {
    if (!videoTrack) setCallPopOut(undefined);
  }, [videoTrack, setCallPopOut]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !videoTrack) return undefined;
    const remoteVideoTrack = videoTrack instanceof RemoteVideoTrack ? videoTrack : undefined;
    const elementInfo = new PopOutWindowElementInfo(videoElement, popOutWindow);
    remoteVideoTrack?.observeElementInfo(elementInfo);
    videoTrack.attach(videoElement);
    return () => {
      videoTrack.detach(videoElement);
      remoteVideoTrack?.stopObservingElementInfo(elementInfo);
    };
  }, [videoTrack, popOutWindow]);

  const startDraggingWindow = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startDesktopCallPopOutWindowDrag();
  };

  const dragWindow = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) dragDesktopCallPopOutWindow();
  };

  const windowDragProps = isDesktopApp
    ? {
        onPointerDown: startDraggingWindow,
        onPointerMove: dragWindow,
        onPointerUp: endDesktopCallPopOutWindowDrag,
        onPointerCancel: endDesktopCallPopOutWindowDrag,
      }
    : undefined;

  return createPortal(
    <div className={css.CallPopOut} {...windowDragProps} data-testid="call-pop-out">
      <video
        ref={videoRef}
        className={classNames(css.CallPopOutVideo, isMirrored && paneCss.CallTileVideoMirrored)}
        autoPlay
        playsInline
        muted
        data-testid="call-pop-out-video"
      />
      <div className={css.CallPopOutBar}>
        <Box grow="Yes" alignItems="Baseline" gap="200">
          <Text as="span" size="T500" truncate>
            {displayName}&apos;s stream
          </Text>
          <Text as="span" size="T300" priority="300" truncate>
            {roomName}
          </Text>
        </Box>
        {isDesktopApp && (
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => popOutWindow.close()}
            aria-label="Close pop-out"
            className={css.CallPopOutCloseButton}
            data-testid="call-pop-out-close"
          >
            <Icon size="400" src={Icons.Cross} />
          </button>
        )}
      </div>
    </div>,
    popOutWindow.document.body
  );
}
