import type { ReactNode } from 'react';
import React, { useEffect, useRef } from 'react';
import { useLocation, useMatch } from 'react-router-dom';
import { Box } from 'folds';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useSwipeDrawer } from '../../hooks/useSwipeDrawer';
import { SwipeDrawer } from '../../components/swipe-drawer';
import { ContainerColor } from '../../styles/ContainerColor.css';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { useSpaceOptionally } from '../../hooks/useSpace';
import { DIRECT_PATH, HOME_PATH, SPACE_PATH } from '../paths';
import { Space } from './space';
import { Direct } from './direct/Direct';
import { Home } from './home/Home';
import { FavoriteRoomsSection } from './FavoriteRooms';

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

  const extra = <FavoriteRoomsSection isDrawerMode />;
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
