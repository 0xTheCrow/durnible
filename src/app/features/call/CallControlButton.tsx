import type { ComponentProps } from 'react';
import React from 'react';
import { Icon, IconButton, Text, Tooltip } from 'folds';
import type { IconSrc } from 'folds';
import { TooltipProvider } from '../../components/TooltipProvider';

type CallControlButtonProps = Omit<ComponentProps<typeof IconButton>, 'children'> & {
  label: string;
  icon: IconSrc;
  isIconFilled?: boolean;
  iconSize?: ComponentProps<typeof Icon>['size'];
};
export function CallControlButton({
  label,
  icon,
  isIconFilled,
  iconSize = '100',
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
          <Icon size={iconSize} src={icon} filled={isIconFilled} />
        </IconButton>
      )}
    </TooltipProvider>
  );
}
