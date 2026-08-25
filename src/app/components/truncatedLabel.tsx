import type { MutableRefObject, ReactNode } from 'react';
import React, { createContext, useContext } from 'react';
import { Text, Tooltip, toRem } from 'folds';

export const TOOLTIP_EDGE_GAP = 10;
const TOOLTIP_BOUNDARY_SELECTOR = '[data-tooltip-boundary]';

export type TruncatedLabel = {
  element: HTMLElement | null;
  content: ReactNode;
};

export type TruncatedLabelRegistry = MutableRefObject<TruncatedLabel | null>;

const TruncatedLabelContext = createContext<TruncatedLabelRegistry | null>(null);
export const TruncatedLabelProvider = TruncatedLabelContext.Provider;

export const useTruncatedLabelRegistry = (): TruncatedLabelRegistry | null =>
  useContext(TruncatedLabelContext);

export const checkIsTruncated = (element: HTMLElement): boolean =>
  element.scrollWidth > element.clientWidth;

export const getTooltipEdgeOffset = (triggerElement: HTMLElement): number => {
  const boundaryElement = triggerElement.closest(TOOLTIP_BOUNDARY_SELECTOR);
  if (!boundaryElement) return TOOLTIP_EDGE_GAP;
  return (
    boundaryElement.getBoundingClientRect().right -
    triggerElement.getBoundingClientRect().right +
    TOOLTIP_EDGE_GAP
  );
};

export function TruncatedLabelTooltip({ children }: { children: ReactNode }) {
  return (
    <Tooltip variant="Surface" style={{ maxWidth: toRem(280) }}>
      <Text style={{ wordBreak: 'break-word' }} size="T300">
        {children}
      </Text>
    </Tooltip>
  );
}
