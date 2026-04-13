import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Room } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import type * as DomUtils from '../../../utils/dom';

import {
  MessageCopyLinkItem,
  MessagePinItem,
  MessageSourceCodeItem,
  MessageReadReceiptItem,
  MessageReportItem,
} from './Message';
import { MatrixTestWrapper } from '../../../../test/wrapper';
import {
  createMockMatrixClient,
  createMockMatrixEvent,
  createMockRoom,
} from '../../../../test/mocks';

vi.mock('focus-trap-react', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const { copyToClipboardMock } = vi.hoisted(() => ({
  copyToClipboardMock: vi.fn(),
}));
vi.mock('../../../utils/dom', async () => {
  const actual = await vi.importActual<typeof DomUtils>('../../../utils/dom');
  return {
    ...actual,
    copyToClipboard: copyToClipboardMock,
  };
});

const { useRoomPinnedEventsMock } = vi.hoisted(() => ({
  useRoomPinnedEventsMock: vi.fn((_room: Room): string[] => []),
}));
vi.mock('../../../hooks/useRoomPinnedEvents', () => ({
  useRoomPinnedEvents: useRoomPinnedEventsMock,
}));

const ROOM_ID = '!testroom:example.com';
const EVENT_ID = '$evt:example.com';
const SENDER = '@alice:example.com';

beforeEach(() => {
  copyToClipboardMock.mockClear();
  useRoomPinnedEventsMock.mockReset();
  useRoomPinnedEventsMock.mockReturnValue([]);
});

// ─── MessageCopyLinkItem ────────────────────────────────────────────────

describe('MessageCopyLinkItem', () => {
  function renderCopy() {
    const mx = createMockMatrixClient();
    const room = createMockRoom(ROOM_ID, mx);
    const mEvent = createMockMatrixEvent({ id: EVENT_ID, sender: SENDER, roomId: ROOM_ID });
    const onClose = vi.fn();
    render(
      <MatrixTestWrapper matrixClient={mx}>
        <MessageCopyLinkItem room={room as unknown as Room} mEvent={mEvent} onClose={onClose} />
      </MatrixTestWrapper>
    );
    return { onClose };
  }

  it('copies a URL containing the event id to the clipboard when clicked', () => {
    renderCopy();
    fireEvent.click(screen.getByTestId('message-copy-link-btn'));
    expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
    const copied = copyToClipboardMock.mock.calls[0][0] as string;
    expect(decodeURIComponent(copied)).toContain(EVENT_ID);
    expect(copied.startsWith('http')).toBe(true);
  });

  it('calls onClose after copying', () => {
    const { onClose } = renderCopy();
    fireEvent.click(screen.getByTestId('message-copy-link-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── MessagePinItem ─────────────────────────────────────────────────────

describe('MessagePinItem', () => {
  function renderPin() {
    const mx = createMockMatrixClient();
    const room = createMockRoom(ROOM_ID, mx);
    const mEvent = createMockMatrixEvent({ id: EVENT_ID, sender: SENDER, roomId: ROOM_ID });
    const onClose = vi.fn();
    render(
      <MatrixTestWrapper matrixClient={mx}>
        <MessagePinItem room={room as unknown as Room} mEvent={mEvent} onClose={onClose} />
      </MatrixTestWrapper>
    );
    return { mx, onClose };
  }

  it('pins an unpinned event via sendStateEvent with the event id appended', () => {
    useRoomPinnedEventsMock.mockReturnValue([]);
    const { mx, onClose } = renderPin();

    fireEvent.click(screen.getByTestId('message-pin-btn'));

    expect(mx.sendStateEvent).toHaveBeenCalledTimes(1);
    expect(mx.sendStateEvent).toHaveBeenCalledWith(ROOM_ID, EventType.RoomPinnedEvents, {
      pinned: [EVENT_ID],
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('unpins a pinned event by removing its id from the pinned list', () => {
    useRoomPinnedEventsMock.mockReturnValue(['$other:example.com', EVENT_ID]);
    const { mx, onClose } = renderPin();

    fireEvent.click(screen.getByTestId('message-pin-btn'));

    expect(mx.sendStateEvent).toHaveBeenCalledTimes(1);
    expect(mx.sendStateEvent).toHaveBeenCalledWith(ROOM_ID, EventType.RoomPinnedEvents, {
      pinned: ['$other:example.com'],
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── MessageSourceCodeItem ──────────────────────────────────────────────

describe('MessageSourceCodeItem', () => {
  it('opens the source code dialog when clicked', () => {
    const mx = createMockMatrixClient();
    const room = createMockRoom(ROOM_ID, mx);
    const mEvent = createMockMatrixEvent({ id: EVENT_ID, sender: SENDER, roomId: ROOM_ID });
    render(
      <MatrixTestWrapper matrixClient={mx}>
        <MessageSourceCodeItem room={room as unknown as Room} mEvent={mEvent} />
      </MatrixTestWrapper>
    );

    expect(screen.queryByTestId('message-source-code-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('message-source-code-btn'));
    expect(screen.getByTestId('message-source-code-dialog')).toBeInTheDocument();
  });
});

// ─── MessageReadReceiptItem ─────────────────────────────────────────────

describe('MessageReadReceiptItem', () => {
  it('opens the read receipts dialog when clicked', () => {
    const mx = createMockMatrixClient();
    const room = createMockRoom(ROOM_ID, mx);
    render(
      <MatrixTestWrapper matrixClient={mx}>
        <MessageReadReceiptItem room={room as unknown as Room} eventId={EVENT_ID} />
      </MatrixTestWrapper>
    );

    expect(screen.queryByTestId('message-read-receipts-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('message-read-receipts-btn'));
    expect(screen.getByTestId('message-read-receipts-dialog')).toBeInTheDocument();
  });
});

// ─── MessageReportItem ──────────────────────────────────────────────────

describe('MessageReportItem', () => {
  it('opens the report dialog when the trigger is clicked', () => {
    const mx = createMockMatrixClient();
    const room = createMockRoom(ROOM_ID, mx);
    const mEvent = createMockMatrixEvent({ id: EVENT_ID, sender: SENDER, roomId: ROOM_ID });

    render(
      <MatrixTestWrapper matrixClient={mx}>
        <MessageReportItem room={room as unknown as Room} mEvent={mEvent} />
      </MatrixTestWrapper>
    );

    expect(screen.queryByTestId('message-report-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('message-report-btn'));
    expect(screen.getByTestId('message-report-dialog')).toBeInTheDocument();
  });

  it('calls reportEvent with the typed reason and a score of -100 on submit', async () => {
    const mx = createMockMatrixClient();
    const room = createMockRoom(ROOM_ID, mx);
    const mEvent = createMockMatrixEvent({ id: EVENT_ID, sender: SENDER, roomId: ROOM_ID });

    render(
      <MatrixTestWrapper matrixClient={mx}>
        <MessageReportItem room={room as unknown as Room} mEvent={mEvent} />
      </MatrixTestWrapper>
    );

    fireEvent.click(screen.getByTestId('message-report-btn'));

    const form = screen.getByTestId('message-report-dialog') as HTMLFormElement;
    const reasonInput = form.querySelector('input[name="reasonInput"]') as HTMLInputElement;
    // jsdom does not expose form named-property access; patch to mirror the runtime DOM API
    // the component reads (target.reasonInput).
    Object.defineProperty(form, 'reasonInput', {
      get: () => reasonInput,
      configurable: true,
    });
    fireEvent.change(reasonInput, { target: { value: 'abusive' } });
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(mx.reportEvent).toHaveBeenCalledTimes(1);
    });
    expect(mx.reportEvent).toHaveBeenCalledWith(ROOM_ID, EVENT_ID, -100, 'abusive');
  });
});
