import { Icon, Icons, MenuItem, Text, as } from 'folds';
import React from 'react';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { getEditedEvent } from '../../../../utils/room';
import { copyToClipboard } from '../../../../utils/dom';
import * as css from '../styles.css';

export const MessageCopyTextItem = as<
  'button',
  {
    room: Room;
    mEvent: MatrixEvent;
    onClose?: () => void;
  }
>(({ room, mEvent, onClose, ...props }, ref) => {
  const handleCopy = () => {
    const eventId = mEvent.getId();
    if (!eventId) return;
    const editedEvent = getEditedEvent(eventId, mEvent, room.getUnfilteredTimelineSet());
    const content = editedEvent?.getContent()['m.new_content'] ?? mEvent.getContent();
    const { body } = content;
    if (typeof body === 'string') {
      copyToClipboard(body);
    }
    onClose?.();
  };

  return (
    <MenuItem
      size="300"
      after={<Icon size="100" src={Icons.Text} />}
      radii="300"
      onClick={handleCopy}
      data-testid="message-copy-text-btn"
      {...props}
      ref={ref}
    >
      <Text className={css.MessageMenuItemText} as="span" size="T300" truncate>
        Copy Text
      </Text>
    </MenuItem>
  );
});
