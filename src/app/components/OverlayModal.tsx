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
  overlayCenterProps?: React.HTMLAttributes<HTMLDivElement>;
};

export function OverlayModal({
  open,
  requestClose,
  children,
  focusTrapOptions,
  backdrop = true,
  overlayProps,
  overlayCenterProps,
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
    onDeactivate: requestClose,
    escapeDeactivates: stopPropagation,
    ...focusTrapOptions,
    // Never let FocusTrap close on outside clicks — it fires on
    // pointerdown which closes the modal before the user releases.
    // Instead, our onClick handler on OverlayCenter handles closing
    // on full click (press + release), and allowOutsideClick lets
    // pointer events reach the OverlayCenter without deactivating.
    clickOutsideDeactivates: false,
    allowOutsideClick: true,
  };

  return (
    <Overlay
      open={open}
      backdrop={backdrop ? <OverlayBackdrop /> : undefined}
      {...overlayProps}
    >
      <OverlayCenter
        {...overlayCenterProps}
        onClick={(e: React.MouseEvent) => {
          if (e.target !== e.currentTarget) return;
          e.stopPropagation();
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
