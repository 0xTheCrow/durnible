import {
  Box,
  Button,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  Spinner,
  Text,
  as,
  color,
  config,
} from 'folds';
import type { FormEventHandler } from 'react';
import React, { useCallback, useState } from 'react';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../../hooks/useAsyncCallback';
import { OverlayModal } from '../../../../components/OverlayModal';
import * as css from '../styles.css';

export const MessageReportItem = as<
  'button',
  {
    room: Room;
    mEvent: MatrixEvent;
    onClose?: () => void;
  }
>(({ room, mEvent, onClose, ...props }, ref) => {
  const mx = useMatrixClient();
  const [open, setOpen] = useState(false);

  const [reportState, reportMessage] = useAsyncCallback(
    useCallback(
      (eventId: string, score: number, reason: string) =>
        mx.reportEvent(room.roomId, eventId, score, reason),
      [mx, room]
    )
  );

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    const eventId = mEvent.getId();
    if (
      !eventId ||
      reportState.status === AsyncStatus.Loading ||
      reportState.status === AsyncStatus.Success
    )
      return;
    const target = evt.target as HTMLFormElement | undefined;
    const reasonInput = target?.reasonInput as HTMLInputElement | undefined;
    const reason = reasonInput && reasonInput.value.trim();
    if (reasonInput) reasonInput.value = '';
    reportMessage(eventId, reason ? -100 : -50, reason || 'No reason provided');
  };

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <>
      <OverlayModal open={open} requestClose={handleClose}>
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
              <Text size="H4">Report Message</Text>
            </Box>
            <IconButton size="300" onClick={handleClose} radii="300">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Header>
          <Box
            as="form"
            data-testid="message-report-dialog"
            onSubmit={handleSubmit}
            style={{ padding: config.space.S400 }}
            direction="Column"
            gap="400"
          >
            <Text priority="400">
              Report this message to server, which may then notify the appropriate people to take
              action.
            </Text>
            <Box direction="Column" gap="100">
              <Text size="L400">Reason</Text>
              <Input name="reasonInput" variant="Background" required />
              {reportState.status === AsyncStatus.Error && (
                <Text style={{ color: color.Critical.Main }} size="T300">
                  Failed to report message! Please try again.
                </Text>
              )}
              {reportState.status === AsyncStatus.Success && (
                <Text style={{ color: color.Success.Main }} size="T300">
                  Message has been reported to server.
                </Text>
              )}
            </Box>
            <Button
              data-testid="message-report-confirm"
              type="submit"
              variant="Critical"
              before={
                reportState.status === AsyncStatus.Loading ? (
                  <Spinner fill="Solid" variant="Critical" size="200" />
                ) : undefined
              }
              aria-disabled={
                reportState.status === AsyncStatus.Loading ||
                reportState.status === AsyncStatus.Success
              }
            >
              <Text size="B400">
                {reportState.status === AsyncStatus.Loading ? 'Reporting...' : 'Report'}
              </Text>
            </Button>
          </Box>
        </Dialog>
      </OverlayModal>
      <Button
        data-testid="message-report-btn"
        variant="Critical"
        fill="None"
        size="300"
        after={<Icon size="100" src={Icons.Warning} />}
        radii="300"
        onClick={() => setOpen(true)}
        aria-pressed={open}
        {...props}
        ref={ref}
      >
        <Text className={css.MessageMenuItemText} as="span" size="T300" truncate>
          Report
        </Text>
      </Button>
    </>
  );
});
