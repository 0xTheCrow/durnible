import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react';
import { useState } from 'react';

export type PaneAnchor = 'Left' | 'Right' | 'Top' | 'Bottom';

const SIDE_ANCHORS: PaneAnchor[] = ['Left', 'Right'];

const GROW_KEYS: Record<PaneAnchor, string> = {
  Left: 'ArrowRight',
  Right: 'ArrowLeft',
  Top: 'ArrowDown',
  Bottom: 'ArrowUp',
};
const SHRINK_KEYS: Record<PaneAnchor, string> = {
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  Top: 'ArrowUp',
  Bottom: 'ArrowDown',
};

export const checkIsSideAnchor = (anchor: PaneAnchor): boolean => SIDE_ANCHORS.includes(anchor);

export type PaneResizeOptions = {
  paneRef: RefObject<HTMLElement>;
  anchor: PaneAnchor;
  size: number;
  onSizeChange: (size: number) => void;
  minSize: number;
  maxContainerFraction: number;
  keyboardStep: number;
};

export type PaneResize = {
  paneSize: number;
  isResizing: boolean;
  handleResizePointerDown: (event: ReactPointerEvent) => void;
  handleResizeKeyDown: (event: ReactKeyboardEvent) => void;
};

export const usePaneResize = ({
  paneRef,
  anchor,
  size,
  onSizeChange,
  minSize,
  maxContainerFraction,
  keyboardStep,
}: PaneResizeOptions): PaneResize => {
  const isSideAnchor = checkIsSideAnchor(anchor);
  const [resizingSize, setResizingSize] = useState<number>();

  const paneSize = resizingSize ?? size;

  const getClampedPaneSize = (unclampedSize: number): number => {
    const containerElement = paneRef.current?.parentElement;
    if (!containerElement) return Math.round(Math.max(unclampedSize, minSize));
    const containerRect = containerElement.getBoundingClientRect();
    const containerSize = isSideAnchor ? containerRect.width : containerRect.height;
    const maxSize = Math.max(minSize, containerSize * maxContainerFraction);
    return Math.round(Math.min(Math.max(unclampedSize, minSize), maxSize));
  };

  const handleResizePointerDown = (event: ReactPointerEvent) => {
    event.preventDefault();
    const paneElement = paneRef.current;
    if (!paneElement) return;
    const paneRect = paneElement.getBoundingClientRect();

    const getSizeFromPointer = (clientX: number, clientY: number): number => {
      let pointerSize: number;
      if (anchor === 'Left') pointerSize = clientX - paneRect.left;
      else if (anchor === 'Right') pointerSize = paneRect.right - clientX;
      else if (anchor === 'Top') pointerSize = clientY - paneRect.top;
      else pointerSize = paneRect.bottom - clientY;
      return getClampedPaneSize(pointerSize);
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
      onSizeChange(latestSize);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const handleResizeKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === GROW_KEYS[anchor]) {
      event.preventDefault();
      onSizeChange(getClampedPaneSize(paneSize + keyboardStep));
    } else if (event.key === SHRINK_KEYS[anchor]) {
      event.preventDefault();
      onSizeChange(getClampedPaneSize(paneSize - keyboardStep));
    }
  };

  return {
    paneSize,
    isResizing: resizingSize !== undefined,
    handleResizePointerDown,
    handleResizeKeyDown,
  };
};
