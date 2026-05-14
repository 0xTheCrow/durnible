import {
  Box,
  Button,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  Line,
  Spinner,
  Text,
  as,
  color,
  config,
} from 'folds';
import type { FormEventHandler } from 'react';
import React, { useCallback, useState } from 'react';
import { useSetAtom } from 'jotai';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../../hooks/useAsyncCallback';
import { OverlayModal } from '../../../../components/OverlayModal';
import { selectionModeAtom, selectedIdsAtom } from '../selectionAtom';
import * as css from '../styles.css';

export const MessageDeleteItem = as<
  'button',
  {
    room: Room;
    mEvent: MatrixEvent;
    groupedEventIds?: string[];
    onClose?: () => void;
  }
>(({ room, mEvent, groupedEventIds, onClose, ...props }, ref) => {
  const mx = useMatrixClient();
  const setSelectionMode = useSetAtom(selectionModeAtom);
  const setSelectedIds = useSetAtom(selectedIdsAtom);
  const [open, setOpen] = useState(false);

  const targetIds =
    groupedEventIds && groupedEventIds.length > 1
      ? groupedEventIds
      : ([mEvent.getId()].filter(Boolean) as string[]);
  const isGroup = targetIds.length > 1;

  const [deleteState, deleteMessage] = useAsyncCallback(
    useCallback(
      async (ids: string[], reason?: string) => {
        await Promise.all(
          ids.map((id) =>
            mx.redactEvent(room.roomId, id, undefined, reason ? { reason } : undefined)
          )
        );
      },
      [mx, room]
    )
  );

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (
      targetIds.length === 0 ||
      deleteState.status === AsyncStatus.Loading ||
      deleteState.status === AsyncStatus.Success
    )
      return;
    const target = evt.target as HTMLFormElement | undefined;
    const reasonInput = target?.reasonInput as HTMLInputElement | undefined;
    const reason = reasonInput && reasonInput.value.trim();
    deleteMessage(targetIds, reason);
  };

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <>
      <OverlayModal open={open} onClose={handleClose}>
        <Dialog variant="Surface">
          <Header
            style={{
              padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
              borderBottomWidth: config.borderWidth.B300,
            }}
            variant="Surface"
            size="500"
          >
            <Box grow="Yes">
              <Text size="H4" data-testid="message-delete-dialog-title">
                {isGroup ? `Delete ${targetIds.length} Images` : 'Delete Message'}
              </Text>
            </Box>
            <IconButton size="300" onClick={handleClose} radii="300">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Header>
          <Box
            as="form"
            data-testid="message-delete-dialog"
            onSubmit={handleSubmit}
            style={{ padding: config.space.S400 }}
            direction="Column"
            gap="400"
          >
            <Text priority="400">
              {isGroup
                ? `This action is irreversible! Are you sure that you want to delete all ${targetIds.length} images in this grid?`
                : 'This action is irreversible! Are you sure that you want to delete this message?'}
            </Text>
            <Box direction="Column" gap="100">
              <Text size="L400">
                Reason{' '}
                <Text as="span" size="T200">
                  (optional)
                </Text>
              </Text>
              <Input name="reasonInput" variant="Background" />
              {deleteState.status === AsyncStatus.Error && (
                <Text
                  data-testid="message-delete-error"
                  style={{ color: color.Critical.Main }}
                  size="T300"
                >
                  {isGroup
                    ? 'Failed to delete one or more images! Please try again.'
                    : 'Failed to delete message! Please try again.'}
                </Text>
              )}
            </Box>
            <Button
              data-testid="message-delete-confirm"
              data-loading={deleteState.status === AsyncStatus.Loading ? '' : undefined}
              type="submit"
              variant="Critical"
              before={
                deleteState.status === AsyncStatus.Loading ? (
                  <Spinner fill="Solid" variant="Critical" size="200" />
                ) : undefined
              }
              aria-disabled={deleteState.status === AsyncStatus.Loading}
            >
              <Text size="B400">
                {deleteState.status === AsyncStatus.Loading ? 'Deleting...' : 'Delete'}
              </Text>
            </Button>
            <Line size="300" />
            <Button
              variant="Secondary"
              fill="None"
              onClick={() => {
                if (targetIds.length > 0) {
                  setSelectionMode(true);
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    targetIds.forEach((id) => next.add(id));
                    return next;
                  });
                }
                handleClose();
              }}
            >
              <Text size="B400">Select Multiple</Text>
            </Button>
          </Box>
        </Dialog>
      </OverlayModal>
      <Button
        data-testid="message-delete-btn"
        variant="Critical"
        fill="None"
        size="300"
        after={<Icon size="100" src={Icons.Delete} />}
        radii="300"
        onClick={() => setOpen(true)}
        aria-pressed={open}
        {...props}
        ref={ref}
      >
        <Text className={css.MessageMenuItemText} as="span" size="T300" truncate>
          Delete
        </Text>
      </Button>
    </>
  );
});
