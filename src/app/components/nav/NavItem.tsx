import classNames from 'classnames';
import type { ComponentProps, PointerEvent as ReactPointerEvent } from 'react';
import React, { forwardRef, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { as } from 'folds';
import { TooltipProvider } from '../TooltipProvider';
import type { TruncatedLabel } from '../truncatedLabel';
import {
  TOOLTIP_EDGE_GAP,
  TruncatedLabelProvider,
  TruncatedLabelTooltip,
  checkIsTruncated,
  getTooltipEdgeOffset,
} from '../truncatedLabel';
import * as css from './styles.css';

export const NavItem = as<
  'div',
  {
    highlight?: boolean;
  } & css.RoomSelectorVariants
>(
  (
    {
      as: AsNavItem = 'div',
      className,
      highlight,
      variant,
      radii,
      children,
      onPointerEnter,
      ...props
    },
    ref
  ) => {
    const labelRef = useRef<TruncatedLabel | null>(null);
    const [tooltip, setTooltip] = useState({ isTruncated: false, offset: TOOLTIP_EDGE_GAP });

    const handlePointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
      const labelElement = labelRef.current?.element;
      setTooltip({
        isTruncated: !!labelElement && checkIsTruncated(labelElement),
        offset: getTooltipEdgeOffset(event.currentTarget),
      });
      onPointerEnter?.(event);
    };

    return (
      <TruncatedLabelProvider value={labelRef}>
        <TooltipProvider
          position="Right"
          offset={tooltip.offset}
          tooltip={
            tooltip.isTruncated ? (
              <TruncatedLabelTooltip>{labelRef.current?.content}</TruncatedLabelTooltip>
            ) : null
          }
        >
          {(triggerRef) => (
            <AsNavItem
              className={classNames(css.NavItem({ variant, radii }), className)}
              data-highlight={highlight}
              {...props}
              onPointerEnter={handlePointerEnter}
              ref={(node: HTMLDivElement | null) => {
                triggerRef(node);
                if (typeof ref === 'function') ref(node);
                else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
              }}
            >
              {children}
            </AsNavItem>
          )}
        </TooltipProvider>
      </TruncatedLabelProvider>
    );
  }
);

export const NavLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(
  ({ className, ...props }, ref) => (
    <Link className={classNames(css.NavLink, className)} {...props} ref={ref} />
  )
);

export const NavButton = as<'button'>(
  ({ as: AsNavButton = 'button', className, ...props }, ref) => (
    <AsNavButton className={classNames(css.NavLink, className)} {...props} ref={ref} />
  )
);
