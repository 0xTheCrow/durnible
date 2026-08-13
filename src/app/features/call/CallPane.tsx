import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  Box,
  Header,
  Icon,
  Icons,
  PopOutContainerProvider,
  Scroll,
  Text,
  TooltipContainerProvider,
} from 'folds';
import { Track } from 'livekit-client';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import classNames from 'classnames';
import { callStateAtom, isCallPaneCollapsedAtom } from '../../state/call';
import { settingsAtom } from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';
import type { CallConnection } from '../../plugins/call/CallConnection';
import { isScreenshareSupported } from '../../plugins/call/localMedia';
import {
  checkIsEntryStreamingVideo,
  useCallParticipantEntries,
} from '../../hooks/call/useCallParticipantEntries';
import { useLocalMediaControls } from '../../hooks/call/useLocalMediaControls';
import { useCallDeafen } from '../../hooks/call/useCallDeafen';
import { useCallMemberships } from '../../hooks/useCallMemberships';
import { checkIsFullscreenSupported, useFullscreen } from '../../hooks/useFullscreen';
import { checkIsSideDock, useCallPaneDock, useCallPaneResize } from '../../hooks/useCallPaneLayout';
import { useRoomName } from '../../hooks/useRoomMeta';
import { useCallActions } from './CallProvider';
import { CallParticipantTile } from './CallParticipantTile';
import { CallTileGrid } from './CallTileGrid';
import { CallPaneDockMenu } from './CallPaneDockMenu';
import { CallControlButton } from './CallControlButton';
import { CallMasterVolumeMenu } from './CallMasterVolumeMenu';
import { CallSpotlightBar } from './CallSpotlightBar';
import { CallEncryptionDebugPanel } from './CallEncryptionDebugPanel';
import { CALL_PANE_DRAG_TYPE, CallPaneDockZones } from './CallPaneDockZones';
import * as paneResizeCss from '../../styles/PaneResizeHandle.css';
import * as css from './CallPane.css';

type ConnectedCallPaneProps = {
  connection: CallConnection;
  isReconnecting: boolean;
};
function ConnectedCallPane({ connection, isReconnecting }: ConnectedCallPaneProps) {
  const { livekitRoom, matrixRoom } = connection;
  const { endCall } = useCallActions();
  const setIsCollapsed = useSetAtom(isCallPaneCollapsedAtom);
  const entries = useCallParticipantEntries(livekitRoom);
  const memberships = useCallMemberships(matrixRoom);
  const roomName = useRoomName(matrixRoom);
  const paneRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(paneRef);
  const { dock, setDock, availableDocks, isDockDragEnabled } = useCallPaneDock();
  const { paneSize, isResizing, handleResizePointerDown, handleResizeKeyDown } = useCallPaneResize(
    paneRef,
    dock
  );
  const isDockDraggable = isDockDragEnabled && !isFullscreen;
  const [isDraggingPane, setIsDraggingPane] = useState(false);
  const [pickedFocusKey, setPickedFocusKey] = useState<string>();
  const [autoFocusKey, setAutoFocusKey] = useState<string>();
  const [dismissedScreenshareKey, setDismissedScreenshareKey] = useState<string>();

  useEffect(() => {
    const checkIsStillScreensharing = (key: string | undefined) =>
      entries.some((entry) => entry.key === key && entry.isScreensharing);

    setAutoFocusKey((currentKey) => {
      if (checkIsStillScreensharing(currentKey)) return currentKey;
      return entries.find((entry) => entry.isScreensharing)?.key;
    });
    setDismissedScreenshareKey((currentKey) =>
      checkIsStillScreensharing(currentKey) ? currentKey : undefined
    );
  }, [entries]);

  const handleFocus = useCallback((key: string) => {
    setPickedFocusKey((currentKey) => (currentKey === key ? undefined : key));
  }, []);

  useEffect(() => {
    const headerElement = headerRef.current;
    if (!headerElement || !isDockDraggable) return undefined;
    return draggable({
      element: headerElement,
      getInitialData: () => ({ type: CALL_PANE_DRAG_TYPE }),
      onDragStart: () => setIsDraggingPane(true),
      onDrop: () => setIsDraggingPane(false),
    });
  }, [isDockDraggable]);

  const isSideDock = checkIsSideDock(dock);
  const portalContainer = isFullscreen ? paneRef.current ?? undefined : undefined;
  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenshareEnabled,
    toggleMicrophone,
    toggleCamera,
    toggleScreenshare,
  } = useLocalMediaControls(livekitRoom);
  const { isDeafened, toggleDeafen } = useCallDeafen(livekitRoom);
  const [developerTools] = useSetting(settingsAtom, 'developerTools');

  const autoFocusedEntry =
    autoFocusKey === dismissedScreenshareKey
      ? undefined
      : entries.find((entry) => entry.key === autoFocusKey);
  const pickedEntry = entries.find(
    (entry) => entry.key === pickedFocusKey && checkIsEntryStreamingVideo(entry)
  );
  const focusedEntry = pickedEntry ?? autoFocusedEntry;
  const stripEntries =
    focusedEntry && !focusedEntry.isScreensharing
      ? entries.filter((entry) => entry.key !== focusedEntry.key)
      : entries;

  const handleUnfocus = () => {
    setPickedFocusKey(undefined);
    if (focusedEntry?.isScreensharing) setDismissedScreenshareKey(focusedEntry.key);
  };

  return (
    <div
      ref={paneRef}
      className={classNames(css.CallPane, css.CallPaneDockBorder[dock])}
      style={isFullscreen ? undefined : { [isSideDock ? 'width' : 'height']: paneSize }}
    >
      <TooltipContainerProvider value={portalContainer}>
        <PopOutContainerProvider value={portalContainer}>
          {!isFullscreen && (
            <button
              type="button"
              className={classNames(
                paneResizeCss.PaneResizeHandle,
                isSideDock
                  ? paneResizeCss.PaneResizeHandleSide
                  : paneResizeCss.PaneResizeHandleHorizontal,
                paneResizeCss.PaneResizeHandleAnchor[dock]
              )}
              data-resizing={isResizing}
              onPointerDown={handleResizePointerDown}
              onKeyDown={handleResizeKeyDown}
              aria-label="Resize Call Panel"
            />
          )}
          <Header
            ref={headerRef}
            size="600"
            variant="Surface"
            className={classNames(
              css.CallPaneHeader,
              isDockDraggable && css.CallPaneHeaderDraggable
            )}
          >
            <Icon size="100" src={Icons.Phone} filled />
            <Box grow="Yes" direction="Column">
              <Text size="T300" truncate>
                <b>{roomName}</b>
              </Text>
              {isReconnecting && (
                <Text size="T200" priority="300">
                  Reconnecting…
                </Text>
              )}
            </Box>
            {!isFullscreen && (
              <CallPaneDockMenu dock={dock} availableDocks={availableDocks} onDock={setDock} />
            )}
            <CallControlButton
              size="300"
              radii="300"
              onClick={() => setIsCollapsed(true)}
              label="Collapse Call"
              icon={Icons.ChevronLeft}
            />
          </Header>

          {developerTools && <CallEncryptionDebugPanel livekitRoom={livekitRoom} />}

          {focusedEntry ? (
            <div className={css.CallSpotlightLayout}>
              <div className={css.CallSpotlight}>
                <CallParticipantTile
                  room={matrixRoom}
                  participant={focusedEntry.participant}
                  source={
                    focusedEntry.isScreensharing ? Track.Source.ScreenShare : Track.Source.Camera
                  }
                  memberships={memberships}
                  className={css.CallSpotlightTile}
                />
              </div>
              <CallSpotlightBar
                room={matrixRoom}
                entry={focusedEntry}
                memberships={memberships}
                onStopWatching={handleUnfocus}
              />
              <Scroll direction="Horizontal" size="300" hideTrack visibility="Hover">
                <div className={css.CallTileStrip}>
                  {stripEntries.map((entry) => (
                    <CallParticipantTile
                      key={entry.key}
                      room={matrixRoom}
                      participant={entry.participant}
                      source={Track.Source.Camera}
                      memberships={memberships}
                      isScreensharing={entry.isScreensharing}
                      isFocused={entry.key === focusedEntry.key}
                      className={css.CallStripTile}
                      onSelect={checkIsEntryStreamingVideo(entry) ? handleFocus : undefined}
                    />
                  ))}
                </div>
              </Scroll>
            </div>
          ) : (
            <div className={css.CallGridLayout}>
              <CallTileGrid
                room={matrixRoom}
                entries={entries}
                memberships={memberships}
                onFocus={handleFocus}
              />
            </div>
          )}

          <Box
            className={css.CallPaneControls}
            alignItems="Center"
            justifyContent="Center"
            gap="200"
          >
            <CallControlButton
              size="400"
              radii="Pill"
              variant={isMicrophoneEnabled ? 'SurfaceVariant' : 'Critical'}
              onClick={() => toggleMicrophone()}
              label={isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
              icon={isMicrophoneEnabled ? Icons.Mic : Icons.MicMute}
              aria-pressed={!isMicrophoneEnabled}
            />
            <CallControlButton
              size="400"
              radii="Pill"
              variant={isDeafened ? 'Critical' : 'SurfaceVariant'}
              onClick={() => toggleDeafen()}
              label={isDeafened ? 'Undeafen' : 'Deafen'}
              icon={Icons.Headphone}
              isIconFilled={isDeafened}
              aria-pressed={isDeafened}
            />
            <CallMasterVolumeMenu />
            <CallControlButton
              size="400"
              radii="Pill"
              variant={isCameraEnabled ? 'Success' : 'SurfaceVariant'}
              onClick={() => toggleCamera()}
              label={isCameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
              icon={isCameraEnabled ? Icons.VideoCamera : Icons.VideoCameraMute}
              aria-pressed={isCameraEnabled}
            />
            {isScreenshareSupported() && (
              <CallControlButton
                size="400"
                radii="Pill"
                variant={isScreenshareEnabled ? 'Success' : 'SurfaceVariant'}
                onClick={() => toggleScreenshare()}
                label={isScreenshareEnabled ? 'Stop Sharing Screen' : 'Share Screen'}
                icon={Icons.Monitor}
                aria-pressed={isScreenshareEnabled}
              />
            )}
            {checkIsFullscreenSupported() && (
              <CallControlButton
                size="400"
                radii="Pill"
                variant={isFullscreen ? 'Success' : 'SurfaceVariant'}
                onClick={toggleFullscreen}
                label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                icon={Icons.External}
                aria-pressed={isFullscreen}
              />
            )}
            <CallControlButton
              size="400"
              radii="Pill"
              variant="Critical"
              onClick={() => endCall()}
              label="Leave Call"
              icon={Icons.Phone}
              isIconFilled
            />
          </Box>

          {isDraggingPane && <CallPaneDockZones availableDocks={availableDocks} onDock={setDock} />}
        </PopOutContainerProvider>
      </TooltipContainerProvider>
    </div>
  );
}

export function CallPane() {
  const callState = useAtomValue(callStateAtom);
  const isCollapsed = useAtomValue(isCallPaneCollapsedAtom);

  if (isCollapsed) return null;
  if (callState.status !== 'connected' && callState.status !== 'reconnecting') return null;

  return (
    <ConnectedCallPane
      connection={callState.connection}
      isReconnecting={callState.status === 'reconnecting'}
    />
  );
}
