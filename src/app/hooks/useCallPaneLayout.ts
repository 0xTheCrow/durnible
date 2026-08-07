import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react';
import { useState } from 'react';
import type { CallPaneDock } from '../state/settings';
import { settingsAtom } from '../state/settings';
import { useSetting } from '../state/hooks/settings';
import { ScreenSize, useScreenSizeContext } from './useScreenSize';

export const CALL_PANE_MIN_WIDTH = 240;
export const CALL_PANE_MIN_HEIGHT = 280;
export const CALL_PANE_MAX_CONTAINER_FRACTION = 0.7;
export const CALL_PANE_KEYBOARD_RESIZE_STEP = 16;

const SIDE_DOCKS: CallPaneDock[] = ['Left', 'Right'];
const HORIZONTAL_DOCKS: CallPaneDock[] = ['Top', 'Bottom'];
const ALL_DOCKS: CallPaneDock[] = ['Left', 'Right', 'Top', 'Bottom'];

const GROW_KEYS: Record<CallPaneDock, string> = {
  Left: 'ArrowRight',
  Right: 'ArrowLeft',
  Top: 'ArrowDown',
  Bottom: 'ArrowUp',
};
const SHRINK_KEYS: Record<CallPaneDock, string> = {
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  Top: 'ArrowUp',
  Bottom: 'ArrowDown',
};

export const checkIsSideDock = (dock: CallPaneDock): boolean => SIDE_DOCKS.includes(dock);

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
): {
  paneSize: number;
  isResizing: boolean;
  handleResizePointerDown: (event: ReactPointerEvent) => void;
  handleResizeKeyDown: (event: ReactKeyboardEvent) => void;
} => {
  const isSideDock = checkIsSideDock(dock);
  const [storedWidth, setStoredWidth] = useSetting(settingsAtom, 'callPaneWidth');
  const [storedHeight, setStoredHeight] = useSetting(settingsAtom, 'callPaneHeight');
  const [resizingSize, setResizingSize] = useState<number>();

  const paneSize = resizingSize ?? (isSideDock ? storedWidth : storedHeight);

  const storePaneSize = (size: number) => {
    if (isSideDock) setStoredWidth(size);
    else setStoredHeight(size);
  };

  const getClampedPaneSize = (size: number): number => {
    const minSize = isSideDock ? CALL_PANE_MIN_WIDTH : CALL_PANE_MIN_HEIGHT;
    const containerElement = paneRef.current?.parentElement;
    if (!containerElement) return Math.round(Math.max(size, minSize));
    const containerRect = containerElement.getBoundingClientRect();
    const containerSize = isSideDock ? containerRect.width : containerRect.height;
    const maxSize = Math.max(minSize, containerSize * CALL_PANE_MAX_CONTAINER_FRACTION);
    return Math.round(Math.min(Math.max(size, minSize), maxSize));
  };

  const handleResizePointerDown = (event: ReactPointerEvent) => {
    event.preventDefault();
    const paneElement = paneRef.current;
    if (!paneElement) return;
    const paneRect = paneElement.getBoundingClientRect();

    const getSizeFromPointer = (clientX: number, clientY: number): number => {
      let size: number;
      if (dock === 'Left') size = clientX - paneRect.left;
      else if (dock === 'Right') size = paneRect.right - clientX;
      else if (dock === 'Top') size = clientY - paneRect.top;
      else size = paneRect.bottom - clientY;
      return getClampedPaneSize(size);
    };

    let latestSize = paneSize;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      latestSize = getSizeFromPointer(moveEvent.clientX, moveEvent.clientY);
      setResizingSize(latestSize);
    };
    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      setResizingSize(undefined);
      storePaneSize(latestSize);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const handleResizeKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === GROW_KEYS[dock]) {
      event.preventDefault();
      storePaneSize(getClampedPaneSize(paneSize + CALL_PANE_KEYBOARD_RESIZE_STEP));
    } else if (event.key === SHRINK_KEYS[dock]) {
      event.preventDefault();
      storePaneSize(getClampedPaneSize(paneSize - CALL_PANE_KEYBOARD_RESIZE_STEP));
    }
  };

  return {
    paneSize,
    isResizing: resizingSize !== undefined,
    handleResizePointerDown,
    handleResizeKeyDown,
  };
};
