import { TooltipProvider as FoldsTooltipProvider } from 'folds';
import React, { useCallback, useRef } from 'react';
import type { ComponentProps, RefCallback } from 'react';
import { useCanHover } from '../hooks/useCanHover';

const noOpTriggerRef = () => {};

type TriggerNode = HTMLElement | SVGElement;

const useSuppressNonKeyboardFocusRef = (): RefCallback<TriggerNode> => {
  const stateRef = useRef<{ node: TriggerNode | null; cleanup: (() => void) | null }>({
    node: null,
    cleanup: null,
  });

  return useCallback((node: TriggerNode | null) => {
    const state = stateRef.current;
    if (state.node === node) return;
    state.cleanup?.();
    state.cleanup = null;
    state.node = node;
    if (!node) return;
    const handleFocus = () => {
      if (!node.matches(':focus-visible')) {
        node.blur();
      }
    };
    node.addEventListener('focus', handleFocus);
    state.cleanup = () => node.removeEventListener('focus', handleFocus);
  }, []);
};

export function TooltipProvider({
  delay = 0,
  children,
  ...rest
}: ComponentProps<typeof FoldsTooltipProvider>) {
  const canHover = useCanHover();
  const suppressRef = useSuppressNonKeyboardFocusRef();

  if (!canHover) return <>{children(noOpTriggerRef)}</>;

  return (
    <FoldsTooltipProvider delay={delay} {...rest}>
      {(foldsTriggerRef) =>
        children((node) => {
          foldsTriggerRef(node);
          suppressRef(node);
        })
      }
    </FoldsTooltipProvider>
  );
}
