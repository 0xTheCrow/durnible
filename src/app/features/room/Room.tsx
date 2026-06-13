import React, { useCallback, useEffect, useState } from 'react';
import { Box, Line } from 'folds';
import { useParams } from 'react-router-dom';
import { isKeyHotkey } from 'is-hotkey';
import type { MatrixClient, Room as MatrixRoom } from 'matrix-js-sdk';
import { RoomView } from './RoomView';
import { MembersDrawer } from './layout/MembersDrawer';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { PowerLevelsContextProvider, usePowerLevels } from '../../hooks/usePowerLevels';
import { useRoom } from '../../hooks/useRoom';
import { useKeyDown } from '../../hooks/useKeyDown';
import { markAsRead } from '../../utils/notifications';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomMembers } from '../../hooks/useRoomMembers';
import { TIMELINE_GATE_DEADLINE_MS, useReadinessGate } from '../../state/readiness';
import { decryptAllTimelineEvent } from '../../utils/room';

function useTimelineDecryptionGate(mx: MatrixClient, room: MatrixRoom) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    decryptAllTimelineEvent(mx, room.getLiveTimeline()).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [mx, room]);

  useReadinessGate('timeline', ready, TIMELINE_GATE_DEADLINE_MS);
}

export function Room() {
  const { eventId } = useParams();
  const room = useRoom();
  const mx = useMatrixClient();

  useTimelineDecryptionGate(mx, room);

  const [isDrawer] = useSetting(settingsAtom, 'isPeopleDrawer');
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const screenSize = useScreenSizeContext();
  const powerLevels = usePowerLevels(room);
  const members = useRoomMembers(mx, room.roomId);

  useEffect(() => {
    if (room.hasEncryptionStateEvent()) {
      room.loadMembersIfNeeded();
    }
  }, [room]);

  useKeyDown(
    window,
    useCallback(
      (evt) => {
        if (isKeyHotkey('escape', evt)) {
          markAsRead(mx, room.roomId, hideActivity);
        }
      },
      [mx, room.roomId, hideActivity]
    )
  );

  return (
    <PowerLevelsContextProvider value={powerLevels}>
      <Box grow="Yes">
        <RoomView room={room} eventId={eventId} />
        {screenSize === ScreenSize.Desktop && isDrawer && (
          <>
            <Line variant="Background" direction="Vertical" size="300" />
            <MembersDrawer key={room.roomId} room={room} members={members} />
          </>
        )}
      </Box>
    </PowerLevelsContextProvider>
  );
}
