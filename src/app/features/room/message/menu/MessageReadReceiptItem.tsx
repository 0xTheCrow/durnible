import { Icon, Icons, MenuItem, Modal, Text, as } from 'folds';
import React, { useState } from 'react';
import type { Room } from 'matrix-js-sdk';
import { EventReaders } from '../../../../components/event-readers';
import { OverlayModal } from '../../../../components/OverlayModal';
import * as css from '../styles.css';

export const MessageReadReceiptItem = as<
  'button',
  {
    room: Room;
    eventId: string;
    onClose?: () => void;
  }
>(({ room, eventId, onClose, ...props }, ref) => {
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <>
      <OverlayModal open={open} onClose={handleClose}>
        <Modal variant="Surface" size="300" data-testid="message-read-receipts-dialog">
          <EventReaders room={room} eventId={eventId} onClose={handleClose} />
        </Modal>
      </OverlayModal>
      <MenuItem
        size="300"
        after={<Icon size="100" src={Icons.CheckTwice} />}
        radii="300"
        onClick={() => setOpen(true)}
        data-testid="message-read-receipts-btn"
        {...props}
        ref={ref}
        aria-pressed={open}
      >
        <Text className={css.MessageMenuItemText} as="span" size="T300" truncate>
          Read Receipts
        </Text>
      </MenuItem>
    </>
  );
});
