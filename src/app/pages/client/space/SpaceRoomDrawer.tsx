import React, { ReactNode, useEffect, useRef } from 'react';
import { useLocation, useMatch } from 'react-router-dom';
import { Box } from 'folds';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { useSwipeDrawer } from '../../../hooks/useSwipeDrawer';
import { SwipeDrawer } from '../../../components/swipe-drawer';
import { ContainerColor } from '../../../styles/ContainerColor.css';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { SPACE_PATH } from '../../paths';
import { Space } from './Space';

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
          <Space isDrawerMode />
        </Box>
      </SwipeDrawer>
    </>
  );
}
