import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';
import { createEventEmitterRoom, createFakeEvent } from '../timelineTestHelpers';
import { createMockMatrixClient } from '../../../../../test/mocks';
import { markAsRead } from '../../../../utils/notifications';
import type * as NotificationsModule from '../../../../utils/notifications';
import type * as ReceiptsModule from '../../../../utils/room/receipts';
import { useAutoMarkAsRead } from './useAutoMarkAsRead';

vi.mock('../../../../utils/notifications', async (importActual) => ({
  ...(await importActual<typeof NotificationsModule>()),
  markAsRead: vi.fn(),
}));

vi.mock('../../../../utils/room/receipts', async (importActual) => ({
  ...(await importActual<typeof ReceiptsModule>()),
  getReadReceiptEventId: vi.fn(() => undefined),
}));

type EmitterRoom = Room & { emit: (event: string, ...args: unknown[]) => boolean };

const makeRoom = (): EmitterRoom => {
  const room = createEventEmitterRoom('!test:example.com');
  Object.assign(room, {
    getEventReadUpTo: () => null,
    client: createMockMatrixClient(),
  });
  return room;
};

type HarnessProps = {
  room: Room;
  atBottom: boolean;
  atBottomRef: { current: boolean };
};

function Harness({ room, atBottom, atBottomRef }: HarnessProps) {
  const mx = createMockMatrixClient() as unknown as MatrixClient;
  useAutoMarkAsRead({ mx, room, hideActivity: false, atBottom, atBottomRef });
  return null;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('useAutoMarkAsRead', () => {
  it('marks as read when at the bottom and focused', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    render(<Harness room={makeRoom()} atBottom atBottomRef={{ current: true }} />);
    expect(vi.mocked(markAsRead)).toHaveBeenCalledTimes(1);
  });

  it('does not mark as read when the document is unfocused', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    render(<Harness room={makeRoom()} atBottom atBottomRef={{ current: true }} />);
    expect(vi.mocked(markAsRead)).not.toHaveBeenCalled();
  });

  it('does not mark as read when not at the bottom', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    render(<Harness room={makeRoom()} atBottom={false} atBottomRef={{ current: false }} />);
    expect(vi.mocked(markAsRead)).not.toHaveBeenCalled();
  });

  it('marks as read when a live event arrives while at the bottom and focused', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    const room = makeRoom();
    render(<Harness room={room} atBottom={false} atBottomRef={{ current: true }} />);
    expect(vi.mocked(markAsRead)).not.toHaveBeenCalled();

    act(() => {
      room.emit(RoomEvent.Timeline, createFakeEvent('m.room.message'), room, undefined, false, {
        liveEvent: true,
      });
    });
    expect(vi.mocked(markAsRead)).toHaveBeenCalledTimes(1);
  });
});
