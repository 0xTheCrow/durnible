import type { ComponentProps, PointerEventHandler } from 'react';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Text } from 'folds';
import { TooltipProvider } from './TooltipProvider';
import {
  TOOLTIP_EDGE_GAP,
  TruncatedLabelTooltip,
  checkIsTruncated,
  getTooltipEdgeOffset,
  useTruncatedLabelRegistry,
} from './truncatedLabel';

export function TruncatedText({ children, ...props }: ComponentProps<typeof Text>) {
  const labelRegistry = useTruncatedLabelRegistry();
  const textRef = useRef<HTMLElement | null>(null);
  const [tooltip, setTooltip] = useState({ isTruncated: false, offset: TOOLTIP_EDGE_GAP });

  useLayoutEffect(() => {
    if (!labelRegistry) return undefined;
    labelRegistry.current = { element: textRef.current, content: children };
    return () => {
      labelRegistry.current = null;
    };
  }, [labelRegistry, children]);

  if (labelRegistry) {
    return (
      <Text {...props} truncate ref={textRef}>
        {children}
      </Text>
    );
  }

  const handlePointerEnter: PointerEventHandler<HTMLElement> = (event) => {
    const textElement = event.currentTarget;
    setTooltip({
      isTruncated: checkIsTruncated(textElement),
      offset: getTooltipEdgeOffset(textElement),
    });
  };

  return (
    <TooltipProvider
      position="Right"
      offset={tooltip.offset}
      tooltip={
        tooltip.isTruncated ? <TruncatedLabelTooltip>{children}</TruncatedLabelTooltip> : null
      }
    >
      {(triggerRef) => (
        <Text {...props} truncate ref={triggerRef} onPointerEnter={handlePointerEnter}>
          {children}
        </Text>
      )}
    </TooltipProvider>
  );
}
