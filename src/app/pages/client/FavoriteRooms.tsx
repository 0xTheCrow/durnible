import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Icon, IconButton, Icons, Line, Text, config } from 'folds';
import { useAtomValue } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import type { Instruction } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import {
  attachInstruction,
  extractInstruction,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { LongPressWrapper } from '../../components/long-press';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useFavoriteRooms } from '../../hooks/useFavoriteRooms';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { mDirectAtom } from '../../state/mDirectList';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { getOrphanParents, guessPerfectParent } from '../../utils/room';
import { getCanonicalAliasOrRoomId } from '../../utils/matrix';
import { getDirectRoomPath, getHomeRoomPath, getSpaceRoomPath } from '../pathUtils';
import { NavCategory, NavCategoryHeader, NavItem, NavItemContent } from '../../components/nav';
import { PageNavContent } from '../../components/page';
import { useSelectedRoom } from '../../hooks/router/useSelectedRoom';
import {
  getRoomNotificationMode,
  useRoomsNotificationPreferencesContext,
} from '../../hooks/useRoomsNotificationPreferences';
import { RoomNavItem } from '../../features/room-nav';
import * as css from './FavoriteRooms.css';

function useFavoriteRoomPath() {
  const mx = useMatrixClient();
  const mDirects = useAtomValue(mDirectAtom);
  const roomToParents = useAtomValue(roomToParentsAtom);

  return useCallback(
    (roomId: string): string => {
      const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, roomId);
      const orphanParents = getOrphanParents(roomToParents, roomId);
      if (orphanParents.length > 0) {
        const parent = guessPerfectParent(mx, roomId, orphanParents) ?? orphanParents[0];
        const pIdOrAlias = getCanonicalAliasOrRoomId(mx, parent);
        return getSpaceRoomPath(pIdOrAlias, roomIdOrAlias);
      }
      if (mDirects.has(roomId)) return getDirectRoomPath(roomIdOrAlias);
      return getHomeRoomPath(roomIdOrAlias);
    },
    [mx, mDirects, roomToParents]
  );
}

function FavoriteReorderItem({
  room,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  room: Room;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <NavItem variant="Background" radii="400">
      <NavItemContent>
        <Box as="span" grow="Yes" alignItems="Center">
          <Text as="span" size="Inherit" truncate>
            {room.name}
          </Text>
        </Box>
        <Box direction="Column" shrink="No">
          <IconButton
            size="300"
            radii="300"
            variant="Surface"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            aria-label="Move up"
          >
            <Icon size="100" src={Icons.ChevronTop} />
          </IconButton>
          <IconButton
            size="300"
            radii="300"
            variant="Surface"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            aria-label="Move down"
          >
            <Icon size="100" src={Icons.ChevronBottom} />
          </IconButton>
        </Box>
      </NavItemContent>
    </NavItem>
  );
}

function DraggableFavoriteItem({ roomId, children }: { roomId: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dropState, setDropState] = useState<Instruction>();

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    return combine(
      draggable({
        element: el,
        getInitialData: () => ({ roomId }),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => source.data.roomId !== roomId,
        getData: ({ input, element }) => {
          const insData = attachInstruction(
            {},
            {
              input,
              element,
              currentLevel: 0,
              indentPerLevel: 0,
              mode: 'standard',
              block: ['reparent', 'make-child'],
            }
          );
          const instruction: Instruction | null = extractInstruction(insData);
          setDropState(instruction ?? undefined);
          return {
            roomId,
            instructionType: instruction?.type,
          };
        },
        onDragLeave: () => setDropState(undefined),
        onDrop: () => setDropState(undefined),
      })
    );
  }, [roomId]);

  return (
    <div
      ref={ref}
      className={css.FavoriteDropTarget}
      data-drop-above={dropState?.type === 'reorder-above' || undefined}
      data-drop-below={dropState?.type === 'reorder-below' || undefined}
    >
      {children}
    </div>
  );
}

type FavoriteRoomsListProps = {
  header: (reorderMode: boolean, onDone: () => void) => ReactNode;
  emptyState?: ReactNode;
  scrollRef?: React.RefObject<HTMLDivElement>;
  isDrawerMode?: boolean;
};

function FavoriteRoomsList({
  header,
  emptyState,
  scrollRef,
  isDrawerMode,
}: FavoriteRoomsListProps) {
  const mx = useMatrixClient();
  const favorites = useFavoriteRooms(mx);
  const mDirects = useAtomValue(mDirectAtom);
  const selectedRoomId = useSelectedRoom();
  const notificationPreferences = useRoomsNotificationPreferencesContext();
  const getRoomPath = useFavoriteRoomPath();
  const screenSize = useScreenSizeContext();
  const isDesktop = screenSize === ScreenSize.Desktop;

  const [reorderMode, setReorderMode] = useState(false);
  const [orderedIds, setOrderedIds] = useState<string[]>(() => favorites.map((r) => r.roomId));
  const [prevSyncKey, setPrevSyncKey] = useState({ favorites, reorderMode });
  if (favorites !== prevSyncKey.favorites || reorderMode !== prevSyncKey.reorderMode) {
    setPrevSyncKey({ favorites, reorderMode });
    if (!reorderMode) setOrderedIds(favorites.map((r) => r.roomId));
  }

  const orderedRooms = useMemo(() => {
    const map = new Map(favorites.map((r) => [r.roomId, r]));
    return orderedIds.map((id) => map.get(id)).filter((r): r is Room => r !== undefined);
  }, [orderedIds, favorites]);

  const persistOrder = useCallback(
    (ids: string[]) => {
      const n = ids.length;
      ids.forEach((roomId, i) => {
        mx.setRoomTag(roomId, 'm.favourite', { order: n === 1 ? 0.5 : i / (n - 1) });
      });
    },
    [mx]
  );

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setOrderedIds((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setOrderedIds((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const handleDone = useCallback(() => {
    persistOrder(orderedIds);
    setReorderMode(false);
  }, [persistOrder, orderedIds]);

  useEffect(() => {
    if (!isDesktop) return undefined;
    return monitorForElements({
      onDrop: ({ source, location }) => {
        const { dropTargets } = location.current;
        if (dropTargets.length === 0) return;
        const draggedId = source.data.roomId as string | undefined;
        const targetId = dropTargets[0].data.roomId as string | undefined;
        const instructionType = dropTargets[0].data.instructionType as string | undefined;
        if (!instructionType || !draggedId || !targetId || draggedId === targetId) return;

        setOrderedIds((prev) => {
          const without = prev.filter((id) => id !== draggedId);
          const targetIndex = without.indexOf(targetId);
          if (targetIndex < 0) return prev;
          const insertIndex = instructionType === 'reorder-above' ? targetIndex : targetIndex + 1;
          const next = [...without.slice(0, insertIndex), draggedId, ...without.slice(insertIndex)];
          persistOrder(next);
          return next;
        });
      },
    });
  }, [isDesktop, persistOrder]);

  if (favorites.length === 0) return emptyState;

  const renderItem = (room: Room, index: number) => {
    if (reorderMode) {
      return (
        <FavoriteReorderItem
          key={room.roomId}
          room={room}
          canMoveUp={index > 0}
          canMoveDown={index < orderedRooms.length - 1}
          onMoveUp={() => handleMoveUp(index)}
          onMoveDown={() => handleMoveDown(index)}
        />
      );
    }
    const navItem = (
      <RoomNavItem
        room={room}
        selected={selectedRoomId === room.roomId}
        showAvatar={mDirects.has(room.roomId)}
        direct={mDirects.has(room.roomId)}
        linkPath={getRoomPath(room.roomId)}
        notificationMode={getRoomNotificationMode(notificationPreferences, room.roomId)}
        isDrawerMode={isDrawerMode}
      />
    );
    if (isDesktop) {
      return (
        <DraggableFavoriteItem key={room.roomId} roomId={room.roomId}>
          {navItem}
        </DraggableFavoriteItem>
      );
    }
    return (
      <LongPressWrapper key={room.roomId} onLongPress={() => setReorderMode(true)}>
        {navItem}
      </LongPressWrapper>
    );
  };

  const roomList = <NavCategory>{orderedRooms.map(renderItem)}</NavCategory>;

  return (
    <>
      {header(reorderMode, handleDone)}
      {scrollRef ? <PageNavContent scrollRef={scrollRef}>{roomList}</PageNavContent> : roomList}
    </>
  );
}

export function FavoriteRoomsSection({ isDrawerMode }: { isDrawerMode?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <Box direction="Column" style={{ maxHeight: '40vh', overflow: 'hidden', flexShrink: 0 }}>
      <FavoriteRoomsList
        scrollRef={scrollRef}
        isDrawerMode={isDrawerMode}
        header={(reorderMode, onDone) => (
          <Box direction="Column" gap="100">
            <Line variant="Background" size="300" />
            <NavCategoryHeader style={{ paddingTop: config.space.S200 }}>
              <Box grow="Yes" alignItems="Center" gap="200">
                <Text size="L400" style={{ flexGrow: 1, paddingLeft: config.space.S400 }}>
                  Favorite Rooms
                </Text>
                {reorderMode && (
                  <IconButton
                    size="300"
                    radii="300"
                    variant="Surface"
                    onClick={onDone}
                    aria-label="Done reordering"
                  >
                    <Icon size="100" src={Icons.Check} />
                  </IconButton>
                )}
              </Box>
            </NavCategoryHeader>
          </Box>
        )}
      />
    </Box>
  );
}
