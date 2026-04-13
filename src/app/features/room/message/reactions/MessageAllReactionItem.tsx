import { Icon, Icons, MenuItem, Text, as } from 'folds';
import React from 'react';
import * as css from '../styles.css';

export const MessageAllReactionItem = as<
  'button',
  {
    onOpen: () => void;
  }
>(({ onOpen, ...props }, ref) => (
  <MenuItem
    size="300"
    after={<Icon size="100" src={Icons.Smile} />}
    radii="300"
    onClick={onOpen}
    {...props}
    ref={ref}
  >
    <Text className={css.MessageMenuItemText} as="span" size="T300" truncate>
      View Reactions
    </Text>
  </MenuItem>
));
