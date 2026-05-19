import { Icon, IconButton, Icons, as } from 'folds';
import React from 'react';

export const MessageAllReactionButton = as<
  'button',
  {
    onOpen: () => void;
  }
>(({ onOpen, ...props }, ref) => (
  <IconButton
    variant="SurfaceVariant"
    size="300"
    radii="300"
    onClick={onOpen}
    data-testid="message-all-reaction-btn"
    {...props}
    ref={ref}
  >
    <Icon src={Icons.Smile} size="100" />
  </IconButton>
));
