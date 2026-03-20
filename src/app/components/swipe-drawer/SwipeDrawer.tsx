import React, { ReactNode } from 'react';
import * as css from './SwipeDrawer.css';

type SwipeDrawerProps = {
  open: boolean;
  dragOffset: number | null;
  drawerWidth: number;
  onClose: () => void;
  children: ReactNode;
};

export function SwipeDrawer({ open, dragOffset, drawerWidth, onClose, children }: SwipeDrawerProps) {
  const isDragging = dragOffset !== null;

  // Calculate panel position
  let translateX: number;
  if (isDragging) {
    translateX = dragOffset - drawerWidth;
  } else {
    translateX = open ? 0 : -drawerWidth;
  }

  // Calculate backdrop opacity
  let backdropOpacity: number;
  if (isDragging) {
    backdropOpacity = dragOffset / drawerWidth;
  } else {
    backdropOpacity = open ? 1 : 0;
  }

  const visible = open || isDragging;
  if (!visible) return null;

  return (
    <>
      <div
        className={css.Backdrop}
        style={{
          opacity: backdropOpacity,
          transition: isDragging ? 'none' : undefined,
        }}
        onClick={onClose}
      />
      <div
        className={css.Panel}
        style={{
          width: drawerWidth,
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : undefined,
        }}
      >
        {children}
      </div>
    </>
  );
}
