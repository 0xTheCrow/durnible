import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { Room } from 'matrix-js-sdk';

import { TimelineSystemEvent } from './TimelineSystemEvent';
import { MatrixTestWrapper } from '../../../../test/wrapper';
import {
  createMockMatrixClient,
  createMockMatrixEvent,
  createMockRoom,
} from '../../../../test/mocks';

vi.mock('focus-trap-react', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const ROOM_ID = '!testroom:example.com';

describe('TimelineSystemEvent', () => {
  it('renders its children inside the state-event container', () => {
    const mx = createMockMatrixClient();
    const room = createMockRoom(ROOM_ID, mx);
    const mEvent = createMockMatrixEvent({
      id: '$state-evt:example.com',
      sender: '@alice:example.com',
      type: 'm.room.topic',
      stateKey: '',
      content: { topic: 'hello' },
      roomId: ROOM_ID,
    });

    render(
      <MatrixTestWrapper matrixClient={mx}>
        <TimelineSystemEvent
          room={room as unknown as Room}
          mEvent={mEvent}
          highlight={false}
          messageSpacing="400"
        >
          <span data-testid="event-child">state event body</span>
        </TimelineSystemEvent>
      </MatrixTestWrapper>
    );

    const container = screen.getByTestId('message-state-event');
    expect(container).toBeInTheDocument();
    expect(container).toContainElement(screen.getByTestId('event-child'));
  });
});
