import { Icon, Icons, MenuItem, Modal, Text, as } from 'folds';
import React, { useState } from 'react';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { OverlayModal } from '../../../../components/OverlayModal';
import { TextViewer } from '../../../../components/text-viewer';
import { getEventEdits } from '../../../../utils/room';
import * as css from '../styles.css';

export const MessageSourceCodeItem = as<
  'button',
  {
    room: Room;
    mEvent: MatrixEvent;
    onClose?: () => void;
  }
>(({ room, mEvent, onClose, ...props }, ref) => {
  const [open, setOpen] = useState(false);

  const getContent = (evt: MatrixEvent) =>
    evt.isEncrypted()
      ? {
          [`<== DECRYPTED_EVENT ==>`]: evt.getEffectiveEvent(),
          [`<== ORIGINAL_EVENT ==>`]: evt.event,
        }
      : evt.event;

  const getText = (): string => {
    const evtId = mEvent.getId();
    if (!evtId) return JSON.stringify(getContent(mEvent), null, 2);
    const evtTimeline = room.getTimelineForEvent(evtId);
    const edits =
      evtTimeline &&
      getEventEdits(evtTimeline.getTimelineSet(), evtId, mEvent.getType())?.getRelations();

    if (!edits) return JSON.stringify(getContent(mEvent), null, 2);

    const content: Record<string, unknown> = {
      '<== MAIN_EVENT ==>': getContent(mEvent),
    };

    edits.forEach((editEvt, index) => {
      content[`<== REPLACEMENT_EVENT_${index + 1} ==>`] = getContent(editEvt);
    });

    return JSON.stringify(content, null, 2);
  };

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <>
      <OverlayModal open={open} onClose={handleClose}>
        <Modal variant="Surface" size="500" data-testid="message-source-code-dialog">
          <TextViewer name="Source Code" langName="json" text={getText()} onClose={handleClose} />
        </Modal>
      </OverlayModal>
      <MenuItem
        size="300"
        after={<Icon size="100" src={Icons.BlockCode} />}
        radii="300"
        onClick={() => setOpen(true)}
        data-testid="message-source-code-btn"
        {...props}
        ref={ref}
        aria-pressed={open}
      >
        <Text className={css.MessageMenuItemText} as="span" size="T300" truncate>
          View Source
        </Text>
      </MenuItem>
    </>
  );
});
