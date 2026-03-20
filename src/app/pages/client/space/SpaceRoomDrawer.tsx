import React, { ReactNode, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from 'folds';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { useSwipeDrawer } from '../../../hooks/useSwipeDrawer';
import { SwipeDrawer } from '../../../components/swipe-drawer';
import { ContainerColor } from '../../../styles/ContainerColor.css';
import { Space } from './Space';

type SpaceRoomDrawerProps = {
  children: ReactNode;
};

export function SpaceRoomDrawer({ children }: SpaceRoomDrawerProps) {
  const screenSize = useScreenSizeContext();
  const isMobileOrTablet = screenSize !== ScreenSize.Desktop;
  const { open, setOpen, dragOffset, drawerWidth } = useSwipeDrawer();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  // Close drawer on navigation
  useEffect(() => {
    if (prevPathRef.current !== location.pathname && open) {
      setOpen(false);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, open, setOpen]);

  if (!isMobileOrTablet) {
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
          <Space />
        </Box>
      </SwipeDrawer>
    </>
  );
}
