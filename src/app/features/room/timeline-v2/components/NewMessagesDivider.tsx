import React, { forwardRef } from 'react';
import { Badge, Text, color } from 'folds';
import { MessageBase } from '../../../../components/message';
import { useSetting } from '../../../../state/hooks/settings';
import { settingsAtom } from '../../../../state/settings';
import { TimelineDivider } from './TimelineDivider';

export const NEW_MESSAGES_DIVIDER_ANCHOR_ID = 'new-messages-divider';

type NewMessagesDividerProps = {
  onClick: () => void;
};

export const NewMessagesDivider = forwardRef<HTMLDivElement, NewMessagesDividerProps>(
  ({ onClick }, ref) => {
    const [messageSpacing] = useSetting(settingsAtom, 'messageSpacing');

    return (
      <MessageBase
        ref={ref}
        space={messageSpacing}
        data-anchor-id={NEW_MESSAGES_DIVIDER_ANCHOR_ID}
        role="button"
        tabIndex={0}
        aria-label="Mark all messages as read"
        onClick={onClick}
        onKeyDown={(evt) => {
          if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            onClick();
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        <TimelineDivider style={{ color: color.Success.Main }} variant="Inherit">
          <Badge as="span" size="500" variant="Success" fill="Solid" radii="300">
            <Text size="L400">New</Text>
          </Badge>
        </TimelineDivider>
      </MessageBase>
    );
  }
);
