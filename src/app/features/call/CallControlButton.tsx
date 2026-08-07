import type { ComponentProps } from 'react';
import React from 'react';
import { Icon, IconButton, Text, Tooltip } from 'folds';
import type { IconSrc } from 'folds';
import { TooltipProvider } from '../../components/TooltipProvider';

type CallControlButtonProps = Omit<ComponentProps<typeof IconButton>, 'children'> & {
  label: string;
  icon: IconSrc;
  isIconFilled?: boolean;
};
export function CallControlButton({
  label,
  icon,
  isIconFilled,
  ...buttonProps
}: CallControlButtonProps) {
  return (
    <TooltipProvider
      tooltip={
        <Tooltip>
          <Text size="T300">{label}</Text>
        </Tooltip>
      }
    >
      {(triggerRef) => (
        <IconButton ref={triggerRef} aria-label={label} {...buttonProps}>
          <Icon size="100" src={icon} filled={isIconFilled} />
        </IconButton>
      )}
    </TooltipProvider>
  );
}
