import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Icon, IconButton, Icons, Line, Text, config } from 'folds';
import { useAtomValue } from 'jotai';
import { Room } from 'matrix-js-sdk';
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
import { PageNav, PageNavContent, PageNavHeader } from '../../components/page';
import { useSelectedRoom } from '../../hooks/router/useSelectedRoom';
import {
  getRoomNotificationMode,
  useRoomsNotificationPreferencesContext,
} from '../../hooks/useRoomsNotificationPreferences';
import { RoomNavItem } from '../../features/room-nav';

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

export function LongPressWrapper({
  onLongPress,
  children,
}: {
  onLongPress: () => void;
  children: ReactNode;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const suppressRef = useRef(false);

  const start = useCallback(() => {
    suppressRef.current = false;
    timerRef.current = setTimeout(() => {
      suppressRef.current = true;
      onLongPress();
    }, 500);
  }, [onLongPress]);

  const cancel = useCallback(() => clearTimeout(timerRef.current), []);

  return (
    <div
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if (suppressRef.current) {
          suppressRef.current = false;
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      style={{ WebkitTouchCallout: 'none', userSelect: 'none' } as React.CSSProperties}
    >
      {children}
    </div>
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
};

export function FavoritesList({ header, emptyState, scrollRef }: FavoritesListProps) {
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

  if (favorites.length === 0) return <>{emptyState}</>;

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
              isDrawerMode
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

// ── FavoritesSection — appended inside the Space nav scroll area ──────────────

export function FavoritesSection() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <Box
      direction="Column"
      style={{ maxHeight: '40vh', overflow: 'hidden', flexShrink: 0 }}
    >
      <FavoritesList
        scrollRef={scrollRef}
        header={(reorderMode, onDone) => (
          <Box direction="Column" gap="100" style={{ paddingTop: config.space.S400 }}>
            <Line variant="Background" size="300" />
            <NavCategoryHeader style={{ paddingTop: config.space.S200 }}>
              <Box grow="Yes" alignItems="Center" gap="200">
                <Text size="L400" style={{ flexGrow: 1 }}>
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

// ── FavoritesNav — standalone PageNav for the favorites-only drawer ───────────

function FavoritesNav() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <PageNav>
      <FavoritesList
        scrollRef={scrollRef}
        header={(reorderMode, onDone) => (
          <PageNavHeader>
            <Box grow="Yes" alignItems="Center" gap="200">
              <Text size="H4" style={{ flexGrow: 1 }} truncate>
                Favorites
              </Text>
              {reorderMode && (
                <IconButton
                  size="300"
                  radii="300"
                  variant="Background"
                  onClick={onDone}
                  aria-label="Done reordering"
                >
                  <Icon size="100" src={Icons.Check} />
                </IconButton>
              )}
            </Box>
          </PageNavHeader>
        )}
        emptyState={
          <PageNavContent scrollRef={scrollRef}>
            <Box
              direction="Column"
              alignItems="Center"
              justifyContent="Center"
              gap="200"
              style={{ padding: config.space.S400, flexGrow: 1 }}
            >
              <Icon size="400" src={Icons.Star} />
              <Text align="Center" priority="400" size="T300">
                No favorites yet. Right-click a room to add one.
              </Text>
            </Box>
          </PageNavContent>
        }
      />
    </PageNav>
  );
}

// ── FavoritesDrawer — swipe drawer for non-space pages ───────────────────────

type FavoritesDrawerProps = {
  children: ReactNode;
};

export function FavoritesDrawer({ children }: FavoritesDrawerProps) {
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

  if (!isMobileOrTablet || !swipeGestures) {
    return <>{children}</>;
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
          className={ContainerColor({ variant: 'Background' })}
          style={{ height: '100%' }}
        >
          <FavoritesNav />
        </Box>
      </SwipeDrawer>
    </>
  );
}
