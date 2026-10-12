import type { ReactNode, RefObject } from 'react';
import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePageRootContainers } from '../../components/page';
import * as css from './CallPaneContainer.css';

type CallPaneContainerContextValue = {
  paneContainer: HTMLDivElement;
  adoptPaneContainer: (slotElement: HTMLElement, boundsRef: RefObject<HTMLElement>) => void;
  releasePaneContainer: (slotElement: HTMLElement) => void;
  getPaneBoundsElement: () => HTMLElement | null;
};

const CallPaneContainerContext = createContext<CallPaneContainerContextValue | null>(null);

export const useCallPaneContainer = (): CallPaneContainerContextValue => {
  const contextValue = useContext(CallPaneContainerContext);
  if (!contextValue) throw new Error('CallPaneContainerProvider is missing');
  return contextValue;
};

type CallPaneContainerProviderProps = {
  children: ReactNode;
};
export function CallPaneContainerProvider({ children }: CallPaneContainerProviderProps) {
  const holdingRef = useRef<HTMLDivElement>(null);
  const adoptedBoundsRef = useRef<RefObject<HTMLElement> | null>(null);
  const [paneContainer] = useState(() => {
    const containerElement = document.createElement('div');
    containerElement.className = css.CallPaneContents;
    return containerElement;
  });

  const contextValue = useMemo<CallPaneContainerContextValue>(
    () => ({
      paneContainer,
      adoptPaneContainer: (slotElement, boundsRef) => {
        slotElement.appendChild(paneContainer);
        adoptedBoundsRef.current = boundsRef;
      },
      releasePaneContainer: (slotElement) => {
        if (paneContainer.parentElement !== slotElement) return;
        holdingRef.current?.appendChild(paneContainer);
        adoptedBoundsRef.current = null;
      },
      getPaneBoundsElement: () => adoptedBoundsRef.current?.current ?? null,
    }),
    [paneContainer]
  );

  useLayoutEffect(() => {
    if (!paneContainer.isConnected) holdingRef.current?.appendChild(paneContainer);
  }, [paneContainer]);

  return (
    <CallPaneContainerContext.Provider value={contextValue}>
      {children}
      <div ref={holdingRef} className={css.CallPaneHolding} />
    </CallPaneContainerContext.Provider>
  );
}

export function CallPaneSlot() {
  const { adoptPaneContainer, releasePaneContainer } = useCallPaneContainer();
  const { asideContainerRef } = usePageRootContainers();
  const slotRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const slotElement = slotRef.current;
    if (!slotElement) return undefined;
    adoptPaneContainer(slotElement, asideContainerRef);
    return () => releasePaneContainer(slotElement);
  }, [adoptPaneContainer, releasePaneContainer, asideContainerRef]);

  return <div ref={slotRef} className={css.CallPaneContents} />;
}
