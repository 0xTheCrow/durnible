import type { RefObject } from 'react';
import type { CallPaneDock } from '../state/settings';
import { settingsAtom } from '../state/settings';
import { useSetting } from '../state/hooks/settings';
import type { PaneResize } from './usePaneResize';
import { checkIsSideAnchor, usePaneResize } from './usePaneResize';
import { ScreenSize, useScreenSizeContext } from './useScreenSize';

export const CALL_PANE_MIN_WIDTH = 240;
export const CALL_PANE_MIN_HEIGHT = 280;
export const CALL_PANE_MAX_CONTAINER_FRACTION = 0.7;
export const CALL_PANE_KEYBOARD_RESIZE_STEP = 16;

const HORIZONTAL_DOCKS: CallPaneDock[] = ['Top', 'Bottom'];
const ALL_DOCKS: CallPaneDock[] = ['Left', 'Right', 'Top', 'Bottom'];

export const checkIsSideDock = (dock: CallPaneDock): boolean => checkIsSideAnchor(dock);

export const useCallPaneDock = (): {
  dock: CallPaneDock;
  setDock: (dock: CallPaneDock) => void;
  availableDocks: CallPaneDock[];
  isDockDragEnabled: boolean;
} => {
  const screenSize = useScreenSizeContext();
  const [storedDock, setDock] = useSetting(settingsAtom, 'callPaneDock');
  const isMobile = screenSize === ScreenSize.Mobile;

  return {
    dock: isMobile && checkIsSideDock(storedDock) ? 'Top' : storedDock,
    setDock,
    availableDocks: isMobile ? HORIZONTAL_DOCKS : ALL_DOCKS,
    isDockDragEnabled: !isMobile,
  };
};

export const useCallPaneResize = (
  paneRef: RefObject<HTMLElement>,
  dock: CallPaneDock
): PaneResize => {
  const isSideDock = checkIsSideDock(dock);
  const [storedWidth, setStoredWidth] = useSetting(settingsAtom, 'callPaneWidth');
  const [storedHeight, setStoredHeight] = useSetting(settingsAtom, 'callPaneHeight');

  return usePaneResize({
    paneRef,
    anchor: dock,
    size: isSideDock ? storedWidth : storedHeight,
    onSizeChange: isSideDock ? setStoredWidth : setStoredHeight,
    minSize: isSideDock ? CALL_PANE_MIN_WIDTH : CALL_PANE_MIN_HEIGHT,
    maxContainerFraction: CALL_PANE_MAX_CONTAINER_FRACTION,
    keyboardStep: CALL_PANE_KEYBOARD_RESIZE_STEP,
  });
};
