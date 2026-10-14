import type { ComponentProps, MouseEventHandler, PointerEventHandler } from 'react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RectCords } from 'folds';
import { PopOut, Text } from 'folds';
import { TooltipProvider } from './TooltipProvider';
import { useCanHover } from '../hooks/browser/useCanHover';
import {
  TOOLTIP_EDGE_GAP,
  TruncatedLabelTooltip,
  checkIsTruncated,
  getTooltipEdgeOffset,
  useTruncatedLabelRegistry,
} from './truncatedLabel';

type TruncatedTextProps = ComponentProps<typeof Text> & {
  position?: 'Right' | 'Bottom';
  isTapToReveal?: boolean;
};

export function TruncatedText({
  children,
  position = 'Right',
  isTapToReveal = false,
  ...props
}: TruncatedTextProps) {
  const labelRegistry = useTruncatedLabelRegistry();
  const canHover = useCanHover();
  const textRef = useRef<HTMLElement | null>(null);
  const [tooltip, setTooltip] = useState({ isTruncated: false, offset: TOOLTIP_EDGE_GAP });
  const [fullTextAnchor, setFullTextAnchor] = useState<RectCords>();

  useLayoutEffect(() => {
    if (!labelRegistry) return undefined;
    labelRegistry.current = { element: textRef.current, content: children };
    return () => {
      labelRegistry.current = null;
    };
  }, [labelRegistry, children]);

  useEffect(() => {
    if (!fullTextAnchor) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const isOnText = event.target instanceof Node && !!textRef.current?.contains(event.target);
      if (!isOnText) setFullTextAnchor(undefined);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [fullTextAnchor]);

  if (labelRegistry) {
    return (
      <Text {...props} truncate ref={textRef}>
        {children}
      </Text>
    );
  }

  if (isTapToReveal && !canHover) {
    const handleClick: MouseEventHandler<HTMLElement> = (event) => {
      const textElement = event.currentTarget;
      if (fullTextAnchor) {
        setFullTextAnchor(undefined);
      } else if (checkIsTruncated(textElement)) {
        setFullTextAnchor(textElement.getBoundingClientRect());
      }
    };

    return (
      <PopOut
        anchor={fullTextAnchor}
        position={position}
        align="Start"
        offset={TOOLTIP_EDGE_GAP}
        content={<TruncatedLabelTooltip>{children}</TruncatedLabelTooltip>}
      >
        <Text {...props} truncate ref={textRef} onClick={handleClick}>
          {children}
        </Text>
      </PopOut>
    );
  }

  const handlePointerEnter: PointerEventHandler<HTMLElement> = (event) => {
    const textElement = event.currentTarget;
    setTooltip({
      isTruncated: checkIsTruncated(textElement),
      offset: position === 'Right' ? getTooltipEdgeOffset(textElement) : TOOLTIP_EDGE_GAP,
    });
  };

  return (
    <TooltipProvider
      position={position}
      align={position === 'Right' ? 'Center' : 'Start'}
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
