import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useMatch } from 'react-router-dom';
import { Box, Icon, IconButton, Icons, Line, Text, config } from 'folds';
import { useAtomValue } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import { LongPressWrapper } from '../../components/long-press';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useSwipeDrawer } from '../../hooks/useSwipeDrawer';
import { SwipeDrawer } from '../../components/swipe-drawer';
import { ContainerColor } from '../../styles/ContainerColor.css';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
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
import { useSpaceOptionally } from '../../hooks/useSpace';
import { DIRECT_PATH, HOME_PATH, SPACE_PATH } from '../paths';
import { Space } from './space';
import { Direct } from './direct/Direct';
import { Home } from './home/Home';

// ── Shared helpers ────────────────────────────────────────────────────────────

export function useFavoriteRoomPath() {
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

export function FavoriteReorderItem({
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

// ── FavoritesList — shared stateful list, accepts a header slot ───────────────

type FavoritesListProps = {
  header: (reorderMode: boolean, onDone: () => void) => ReactNode;
  emptyState?: ReactNode;
  scrollRef?: React.RefObject<HTMLDivElement>;
  isDrawerMode?: boolean;
};

export function FavoritesList({ header, emptyState, scrollRef, isDrawerMode }: FavoritesListProps) {
  const mx = useMatrixClient();
  const favorites = useFavoriteRooms(mx);
  const mDirects = useAtomValue(mDirectAtom);
  const selectedRoomId = useSelectedRoom();
  const notificationPreferences = useRoomsNotificationPreferencesContext();
  const getRoomPath = useFavoriteRoomPath();

  const [reorderMode, setReorderMode] = useState(false);
  const [orderedIds, setOrderedIds] = useState<string[]>(() => favorites.map((r) => r.roomId));

  useEffect(() => {
    if (!reorderMode) setOrderedIds(favorites.map((r) => r.roomId));
  }, [favorites, reorderMode]);

  const orderedRooms = useMemo(() => {
    const map = new Map(favorites.map((r) => [r.roomId, r]));
    return orderedIds.map((id) => map.get(id)).filter((r): r is Room => r !== undefined);
  }, [orderedIds, favorites]);

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
    const n = orderedIds.length;
    orderedIds.forEach((roomId, i) => {
      mx.setRoomTag(roomId, 'm.favourite', { order: n === 1 ? 0.5 : i / (n - 1) });
    });
    setReorderMode(false);
  }, [mx, orderedIds]);

  if (favorites.length === 0) return emptyState;

  const roomList = (
    <NavCategory>
      {orderedRooms.map((room, index) =>
        reorderMode ? (
          <FavoriteReorderItem
            key={room.roomId}
            room={room}
            canMoveUp={index > 0}
            canMoveDown={index < orderedRooms.length - 1}
            onMoveUp={() => handleMoveUp(index)}
            onMoveDown={() => handleMoveDown(index)}
          />
        ) : (
          <LongPressWrapper key={room.roomId} onLongPress={() => setReorderMode(true)}>
            <RoomNavItem
              room={room}
              selected={selectedRoomId === room.roomId}
              showAvatar={mDirects.has(room.roomId)}
              direct={mDirects.has(room.roomId)}
              linkPath={getRoomPath(room.roomId)}
              notificationMode={getRoomNotificationMode(notificationPreferences, room.roomId)}
              isDrawerMode={isDrawerMode}
            />
          </LongPressWrapper>
        )
      )}
    </NavCategory>
  );

  return (
    <>
      {header(reorderMode, handleDone)}
      {scrollRef ? <PageNavContent scrollRef={scrollRef}>{roomList}</PageNavContent> : roomList}
    </>
  );
}

// ── FavoritesSection — appended at the bottom of a nav panel ─────────────────

export function FavoritesSection({ isDrawerMode }: { isDrawerMode?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <Box direction="Column" style={{ maxHeight: '40vh', overflow: 'hidden', flexShrink: 0 }}>
      <FavoritesList
        scrollRef={scrollRef}
        isDrawerMode={isDrawerMode}
        header={(reorderMode, onDone) => (
          <Box direction="Column" gap="100">
            <Line variant="Background" size="300" />
            <NavCategoryHeader style={{ paddingTop: config.space.S200 }}>
              <Box grow="Yes" alignItems="Center" gap="200">
                <Text size="L400" style={{ flexGrow: 1, paddingLeft: config.space.S400 }}>
                  Favorites
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

// ── RoomDrawer — swipe drawer for all routes ──────────────────────────────────

type RoomDrawerProps = {
  children: ReactNode;
};

export function RoomDrawer({ children }: RoomDrawerProps) {
  const space = useSpaceOptionally();
  const isSpaceRoot = useMatch({ path: SPACE_PATH, caseSensitive: true, end: true });
  const isDirectRoot = useMatch({ path: DIRECT_PATH, caseSensitive: true, end: true });
  const isDirectRoute = useMatch({ path: DIRECT_PATH, caseSensitive: true, end: false });
  const isHomeRoot = useMatch({ path: HOME_PATH, caseSensitive: true, end: true });
  const isHomeRoute = useMatch({ path: HOME_PATH, caseSensitive: true, end: false });
  const screenSize = useScreenSizeContext();
  const isMobileOrTablet = screenSize !== ScreenSize.Desktop;
  const [swipeGestures] = useSetting(settingsAtom, 'swipeGestures');
  const { open, setOpen, dragOffset, drawerWidth } = useSwipeDrawer();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) setOpen(false);
    prevPathRef.current = location.pathname;
  }, [location.pathname, setOpen]);

  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  useEffect(() => {
    if (!open) return undefined;

    window.history.pushState({ roomDrawer: true }, '');
    let cleaned = false;

    const handlePopState = () => {
      if (!cleaned) {
        cleaned = true;
        setOpenRef.current(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (!cleaned) {
        cleaned = true;
        if (window.history.state?.roomDrawer === true) window.history.back();
      }
    };
  }, [open]);

  if (!isMobileOrTablet || !swipeGestures || (space && isSpaceRoot) || isDirectRoot || isHomeRoot) {
    return children;
  }

  const extra = <FavoritesSection isDrawerMode />;
  let drawerNav: React.ReactNode;
  let isFullNav = true;

  if (space) {
    drawerNav = <Space isDrawerMode extra={extra} />;
  } else if (isDirectRoute) {
    drawerNav = <Direct isDrawerMode extra={extra} />;
  } else if (isHomeRoute) {
    drawerNav = <Home isDrawerMode extra={extra} />;
  } else {
    drawerNav = extra;
    isFullNav = false;
  }

  return (
    <>
      {children}
      <SwipeDrawer
        open={open}
        dragOffset={dragOffset}
        drawerWidth={drawerWidth}
        onClose={() => setOpen(false)}
      >
        <Box
          grow="Yes"
          direction="Column"
          justifyContent={isFullNav ? undefined : 'End'}
          className={ContainerColor({ variant: 'Background' })}
          style={{ height: '100%' }}
        >
          {drawerNav}
        </Box>
      </SwipeDrawer>
    </>
  );
}
