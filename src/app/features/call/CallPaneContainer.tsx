import type { ReactNode } from 'react';
import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as css from './CallPaneContainer.css';

type CallPaneContainerContextValue = {
  paneContainer: HTMLDivElement;
  adoptPaneContainer: (slotElement: HTMLElement) => void;
  releasePaneContainer: (slotElement: HTMLElement) => void;
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
  const [paneContainer] = useState(() => {
    const containerElement = document.createElement('div');
    containerElement.className = css.CallPaneContents;
    return containerElement;
  });

  const contextValue = useMemo<CallPaneContainerContextValue>(
    () => ({
      paneContainer,
      adoptPaneContainer: (slotElement) => slotElement.appendChild(paneContainer),
      releasePaneContainer: (slotElement) => {
        if (paneContainer.parentElement !== slotElement) return;
        holdingRef.current?.appendChild(paneContainer);
      },
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
  const slotRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const slotElement = slotRef.current;
    if (!slotElement) return undefined;
    adoptPaneContainer(slotElement);
    return () => releasePaneContainer(slotElement);
  }, [adoptPaneContainer, releasePaneContainer]);

  return <div ref={slotRef} className={css.CallPaneContents} />;
}
