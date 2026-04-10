import type { ReactNode } from 'react';
import React from 'react';
import * as css from './SwipeDrawer.css';

type SwipeDrawerProps = {
  open: boolean;
  dragOffset: number | null;
  drawerWidth: number;
  onClose: () => void;
  children: ReactNode;
};

export function SwipeDrawer({
  open,
  dragOffset,
  drawerWidth,
  onClose,
  children,
}: SwipeDrawerProps) {
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
        role="button"
        aria-label="Close drawer"
        tabIndex={-1}
        className={css.Backdrop}
        style={{
          opacity: backdropOpacity,
          transition: isDragging ? 'none' : undefined,
        }}
        onClick={onClose}
        onKeyDown={(evt) => {
          // The drawer is mobile-only so Escape isn't a thing here, but
          // screen readers using a connected keyboard may activate the
          // close action via Enter/Space — handle them so the role="button"
          // semantic above is honored.
          if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            onClose();
          }
        }}
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
