import React, { ReactNode, useEffect, useRef } from 'react';
import { useLocation, useMatch } from 'react-router-dom';
import { Box, Line, Text, config } from 'folds';
import { useAtomValue } from 'jotai';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { useSwipeDrawer } from '../../../hooks/useSwipeDrawer';
import { SwipeDrawer } from '../../../components/swipe-drawer';
import { ContainerColor } from '../../../styles/ContainerColor.css';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { SPACE_PATH } from '../../paths';
import { Space } from './Space';
import { useFavoriteRooms } from '../../../hooks/useFavoriteRooms';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { mDirectAtom } from '../../../state/mDirectList';
import { roomToParentsAtom } from '../../../state/room/roomToParents';
import { getOrphanParents, guessPerfectParent } from '../../../utils/room';
import {
  getCanonicalAliasOrRoomId,
} from '../../../utils/matrix';
import {
  getDirectRoomPath,
  getHomeRoomPath,
  getSpaceRoomPath,
} from '../../pathUtils';
import { NavCategory, NavCategoryHeader } from '../../../components/nav';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import {
  getRoomNotificationMode,
  useRoomsNotificationPreferencesContext,
} from '../../../hooks/useRoomsNotificationPreferences';
import { RoomNavItem } from '../../../features/room-nav';

function useFavoriteRoomPath() {
  const mx = useMatrixClient();
  const mDirects = useAtomValue(mDirectAtom);
  const roomToParents = useAtomValue(roomToParentsAtom);

  return (roomId: string): string => {
    const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, roomId);
    const orphanParents = getOrphanParents(roomToParents, roomId);
    if (orphanParents.length > 0) {
      const parent = guessPerfectParent(mx, roomId, orphanParents) ?? orphanParents[0];
      const pIdOrAlias = getCanonicalAliasOrRoomId(mx, parent);
      return getSpaceRoomPath(pIdOrAlias, roomIdOrAlias);
    }
    if (mDirects.has(roomId)) {
      return getDirectRoomPath(roomIdOrAlias);
    }
    return getHomeRoomPath(roomIdOrAlias);
  };
}

function FavoritesSection() {
  const mx = useMatrixClient();
  const favorites = useFavoriteRooms(mx);
  const mDirects = useAtomValue(mDirectAtom);
  const selectedRoomId = useSelectedRoom();
  const notificationPreferences = useRoomsNotificationPreferencesContext();
  const getRoomPath = useFavoriteRoomPath();

  if (favorites.length === 0) return null;

  return (
    <Box direction="Column" gap="100" style={{ paddingTop: config.space.S400 }}>
      <Line variant="Background" size="300" />
      <NavCategory style={{ paddingTop: config.space.S200 }}>
        <NavCategoryHeader>
          <Text size="L400" style={{ paddingLeft: config.space.S200 }}>Favorites</Text>
        </NavCategoryHeader>
        {favorites.map((room) => (
          <RoomNavItem
            key={room.roomId}
            room={room}
            selected={selectedRoomId === room.roomId}
            showAvatar={mDirects.has(room.roomId)}
            direct={mDirects.has(room.roomId)}
            linkPath={getRoomPath(room.roomId)}
            notificationMode={getRoomNotificationMode(notificationPreferences, room.roomId)}
            isDrawerMode
          />
        ))}
      </NavCategory>
    </Box>
  );
}

type SpaceRoomDrawerProps = {
  children: ReactNode;
};

export function SpaceRoomDrawer({ children }: SpaceRoomDrawerProps) {
  const screenSize = useScreenSizeContext();
  const isMobileOrTablet = screenSize !== ScreenSize.Desktop;
  const isSpaceRoot = useMatch({ path: SPACE_PATH, caseSensitive: true, end: true });
  const [swipeGestures] = useSetting(settingsAtom, 'swipeGestures');
  const { open, setOpen, dragOffset, drawerWidth } = useSwipeDrawer();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  // Close drawer on navigation
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      setOpen(false);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, setOpen]);

  // Intercept browser back button to close drawer instead of navigating
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
        if (window.history.state?.roomDrawer === true) {
          window.history.back();
        }
      }
    };
  }, [open]);

  if (!isMobileOrTablet || isSpaceRoot || !swipeGestures) {
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
          <Space isDrawerMode extra={<FavoritesSection />} />
        </Box>
      </SwipeDrawer>
    </>
  );
}
