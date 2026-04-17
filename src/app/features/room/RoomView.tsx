import React, { useCallback, useEffect, useRef } from 'react';
import { Box, Text, config } from 'folds';
import type { Room } from 'matrix-js-sdk';
import { Direction, EventType, MatrixError } from 'matrix-js-sdk';
import { ReactEditor } from 'slate-react';
import { isKeyHotkey } from 'is-hotkey';
import { useStateEvent } from '../../hooks/useStateEvent';
import { StateEvent } from '../../../types/matrix/room';
import { usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useEditor } from '../../components/editor';
import { RoomInputPlaceholder } from './RoomInputPlaceholder';
import { RoomTimeline } from './RoomTimeline';
import { RoomViewTyping } from './RoomViewTyping';
import { RoomTombstone } from './RoomTombstone';
import { RoomInput } from './RoomInput';
import { TimelineSlider } from './TimelineSlider';
import { /* RoomViewFollowing, */ RoomViewFollowingPlaceholder } from './RoomViewFollowing';
import { Page } from '../../components/page';
import { RoomViewHeader } from './RoomViewHeader';
import { useKeyDown } from '../../hooks/useKeyDown';
import { editableActiveElement } from '../../utils/dom';
import { settingsAtom } from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { useAlive } from '../../hooks/useAlive';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';

const FN_KEYS_REGEX = /^F\d+$/;
const shouldFocusMessageField = (evt: KeyboardEvent): boolean => {
  const { code } = evt;
  if (evt.metaKey || evt.altKey || evt.ctrlKey) {
    return false;
  }

  if (FN_KEYS_REGEX.test(code)) return false;

  if (
    code.startsWith('OS') ||
    code.startsWith('Meta') ||
    code.startsWith('Shift') ||
    code.startsWith('Alt') ||
    code.startsWith('Control') ||
    code.startsWith('Arrow') ||
    code.startsWith('Page') ||
    code.startsWith('End') ||
    code.startsWith('Home') ||
    code === 'Tab' ||
    code === 'Space' ||
    code === 'Enter' ||
    code === 'NumLock' ||
    code === 'ScrollLock'
  ) {
    return false;
  }

  return true;
};

export function RoomView({ room, eventId }: { room: Room; eventId?: string }) {
  const roomInputRef = useRef<HTMLDivElement>(null);
  const alternateInputRef = useRef<HTMLDivElement>(null);
  const roomViewRef = useRef<HTMLDivElement>(null);

  const [_hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const [alternateInput] = useSetting(settingsAtom, 'alternateInput');
  const screenSize = useScreenSizeContext();

  const { roomId } = room;
  const editor = useEditor();

  const mx = useMatrixClient();
  const { navigateRoom } = useRoomNavigate();
  const alive = useAlive();

  const [jumpState, timestampToEvent] = useAsyncCallback<string, MatrixError, [number]>(
    useCallback(
      async (ts) => {
        const floorTs = Math.floor(ts);
        const [fwd, bwd] = await Promise.all([
          mx.timestampToEvent(room.roomId, floorTs, Direction.Forward).catch(() => undefined),
          mx.timestampToEvent(room.roomId, floorTs, Direction.Backward).catch(() => undefined),
        ]);

        if (fwd && bwd) {
          const fwdDist = Math.abs(fwd.origin_server_ts - floorTs);
          const bwdDist = Math.abs(bwd.origin_server_ts - floorTs);
          return bwdDist <= fwdDist ? bwd.event_id : fwd.event_id;
        }
        if (fwd) return fwd.event_id;
        if (bwd) return bwd.event_id;

        throw new MatrixError({
          errcode: 'M_NOT_FOUND',
          error: 'No events found near timestamp',
        });
      },
      [mx, room]
    )
  );

  const handleJumpToTimestamp = useCallback(
    (ts: number) => {
      timestampToEvent(ts)
        .then((evId) => {
          if (alive()) {
            navigateRoom(room.roomId, evId);
          }
        })
        .catch(() => {
          // error state is handled by useAsyncCallback
        });
    },
    [timestampToEvent, alive, navigateRoom, room.roomId]
  );

  const handleJumpToLatest = useCallback(() => {
    navigateRoom(room.roomId, undefined, { replace: true });
  }, [navigateRoom, room.roomId]);

  const tombstoneEvent = useStateEvent(room, StateEvent.RoomTombstone);
  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);

  const permissions = useRoomPermissions(creators, powerLevels);
  const canMessage = permissions.event(EventType.RoomMessage, mx.getSafeUserId());

  const focusEditorRef = useRef(() => {});
  focusEditorRef.current = () => {
    if (screenSize !== ScreenSize.Desktop) return;
    if (!canMessage) return;
    if (alternateInput) {
      alternateInputRef.current?.focus();
    } else {
      ReactEditor.focus(editor);
    }
  };
  useEffect(() => {
    focusEditorRef.current();
  }, [roomId]);

  useKeyDown(
    window,
    useCallback(
      (evt) => {
        if (editableActiveElement()) return;
        const portalContainer = document.getElementById('portalContainer');
        if (portalContainer && portalContainer.children.length > 0) {
          return;
        }
        if (shouldFocusMessageField(evt) || isKeyHotkey('mod+v', evt)) {
          if (alternateInput) {
            alternateInputRef.current?.focus();
          } else {
            ReactEditor.focus(editor);
          }
        }
      },
      [editor, alternateInput, alternateInputRef]
    )
  );

  return (
    <Page ref={roomViewRef} style={{ position: 'relative' }}>
      <RoomViewHeader />
      <Box grow="Yes" direction="Column" style={{ position: 'relative' }}>
        <RoomTimeline
          key={roomId}
          room={room}
          eventId={eventId}
          roomInputRef={roomInputRef}
          alternateInputRef={alternateInputRef}
          editor={editor}
        />
        <RoomViewTyping room={room} />
        <TimelineSlider
          room={room}
          onJumpToTimestamp={handleJumpToTimestamp}
          onJumpToLatest={handleJumpToLatest}
          loading={jumpState.status === AsyncStatus.Loading}
          error={jumpState.status === AsyncStatus.Error ? jumpState.error.message : undefined}
        />
      </Box>
      <Box shrink="No" direction="Column">
        <div style={{ padding: `0 ${config.space.S400}` }}>
          {tombstoneEvent ? (
            <RoomTombstone
              roomId={roomId}
              body={tombstoneEvent.getContent().body}
              replacementRoomId={tombstoneEvent.getContent().replacement_room}
            />
          ) : (
            <>
              {canMessage && (
                <RoomInput
                  room={room}
                  editor={editor}
                  roomId={roomId}
                  fileDropContainerRef={roomViewRef}
                  alternateInputRef={alternateInputRef}
                  ref={roomInputRef}
                />
              )}
              {!canMessage && (
                <RoomInputPlaceholder
                  style={{ padding: config.space.S200 }}
                  alignItems="Center"
                  justifyContent="Center"
                >
                  <Text align="Center">You do not have permission to post in this room</Text>
                </RoomInputPlaceholder>
              )}
            </>
          )}
        </div>
        {
          <RoomViewFollowingPlaceholder />
          /*
          hideActivity ? <RoomViewFollowingPlaceholder /> : <RoomViewFollowing room={room} />
          */
        }
      </Box>
    </Page>
  );
}
