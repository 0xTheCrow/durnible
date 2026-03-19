import React, { ReactNode, useEffect, useRef } from 'react';
import FocusTrap from 'focus-trap-react';
import { Options as FocusTrapOptions } from 'focus-trap';
import { Overlay, OverlayBackdrop, OverlayCenter } from 'folds';
import { stopPropagation } from '../utils/keyboard';

let overlayModalCounter = 0;

type OverlayModalProps = {
  open: boolean;
  requestClose: () => void;
  children: ReactNode;
  focusTrapOptions?: Partial<FocusTrapOptions>;
  backdrop?: boolean;
  overlayProps?: React.HTMLAttributes<HTMLDivElement>;
};

export function OverlayModal({
  open,
  requestClose,
  children,
  focusTrapOptions,
  backdrop = true,
  overlayProps,
}: OverlayModalProps) {
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  const clickOutsideCloses =
    focusTrapOptions?.clickOutsideDeactivates !== false;

  useEffect(() => {
    if (!open) return undefined;

    const id = overlayModalCounter++;
    window.history.pushState({ overlayModalId: id }, '');
    let cleaned = false;

    const handlePopState = () => {
      if (!cleaned && window.history.state?.overlayModalId !== id) {
        cleaned = true;
        requestCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (!cleaned) {
        cleaned = true;
        if (window.history.state?.overlayModalId === id) {
          window.history.back();
        }
      }
    };
  }, [open]);

  const mergedFocusTrapOptions: FocusTrapOptions = {
    initialFocus: false,
    clickOutsideDeactivates: true,
    onDeactivate: requestClose,
    escapeDeactivates: stopPropagation,
    ...focusTrapOptions,
  };

  return (
    <Overlay
      open={open}
      backdrop={backdrop ? <OverlayBackdrop /> : undefined}
      onPointerDown={(e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      {...overlayProps}
    >
      <OverlayCenter
        onPointerDown={(e: React.PointerEvent) => {
          if (e.target !== e.currentTarget) return;
          if (clickOutsideCloses) {
            requestClose();
          }
        }}
        onClick={(e: React.MouseEvent) => {
          if (e.target !== e.currentTarget) return;
          if (clickOutsideCloses) {
            requestClose();
          }
        }}
      >
        <FocusTrap focusTrapOptions={mergedFocusTrapOptions}>
          {children}
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
