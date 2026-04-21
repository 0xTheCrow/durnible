import { TooltipProvider as FoldsTooltipProvider } from 'folds';
import React from 'react';
import type { ComponentProps } from 'react';
import { useCanHover } from '../hooks/useCanHover';

const noOpTriggerRef = () => {};

export function TooltipProvider({
  delay = 0,
  children,
  ...rest
}: ComponentProps<typeof FoldsTooltipProvider>) {
  const canHover = useCanHover();
  if (!canHover) return <>{children(noOpTriggerRef)}</>;
  return (
    <FoldsTooltipProvider delay={delay} {...rest}>
      {children}
    </FoldsTooltipProvider>
  );
}
