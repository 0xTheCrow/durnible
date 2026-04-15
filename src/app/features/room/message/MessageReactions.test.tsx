import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Emoji } from '../../../plugins/emoji';

import { MessageQuickReactions, MessageAllReactionButton, MessageAllReactionItem } from './Message';
import { MatrixTestWrapper } from '../../../../test/wrapper';
import { createMockMatrixClient } from '../../../../test/mocks';

const { useRecentEmojiMock } = vi.hoisted(() => ({
  useRecentEmojiMock: vi.fn((_mx: unknown, _limit?: number): Emoji[] => []),
}));
vi.mock('../../../hooks/useRecentEmoji', () => ({
  useRecentEmoji: useRecentEmojiMock,
}));

beforeEach(() => {
  useRecentEmojiMock.mockReset();
  useRecentEmojiMock.mockReturnValue([]);
});

// ─── MessageQuickReactions ──────────────────────────────────────────────

describe('MessageQuickReactions', () => {
  function renderQuick() {
    const mx = createMockMatrixClient();
    const onReaction = vi.fn();
    render(
      <MatrixTestWrapper matrixClient={mx}>
        <MessageQuickReactions onReaction={onReaction} />
      </MatrixTestWrapper>
    );
    return { onReaction };
  }

  it('renders a button for every recent emoji', () => {
    useRecentEmojiMock.mockReturnValue([
      { unicode: '👍', shortcode: 'thumbsup' } as Emoji,
      { unicode: '🎉', shortcode: 'tada' } as Emoji,
    ]);
    renderQuick();
    const buttons = screen.getAllByTestId('message-quick-reaction');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute('data-emoji', '👍');
    expect(buttons[1]).toHaveAttribute('data-emoji', '🎉');
  });

  it('fires onReaction with unicode and shortcode when a button is clicked', () => {
    useRecentEmojiMock.mockReturnValue([{ unicode: '👍', shortcode: 'thumbsup' } as Emoji]);
    const { onReaction } = renderQuick();

    fireEvent.click(screen.getByTestId('message-quick-reaction'));

    expect(onReaction).toHaveBeenCalledTimes(1);
    expect(onReaction).toHaveBeenCalledWith('👍', 'thumbsup');
  });

  it('renders no reaction buttons when the recent-emoji list is empty', () => {
    useRecentEmojiMock.mockReturnValue([]);
    renderQuick();
    expect(screen.queryByTestId('message-quick-reaction')).not.toBeInTheDocument();
  });
});

// ─── MessageAllReactionButton ───────────────────────────────────────────

describe('MessageAllReactionButton', () => {
  it('calls onOpen when clicked', () => {
    const onOpen = vi.fn();
    render(
      <MatrixTestWrapper>
        <MessageAllReactionButton onOpen={onOpen} />
      </MatrixTestWrapper>
    );

    fireEvent.click(screen.getByTestId('message-all-reaction-btn'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

// ─── MessageAllReactionItem ─────────────────────────────────────────────

describe('MessageAllReactionItem', () => {
  it('calls onOpen when clicked', () => {
    const onOpen = vi.fn();
    render(
      <MatrixTestWrapper>
        <MessageAllReactionItem data-testid="message-all-reaction-item" onOpen={onOpen} />
      </MatrixTestWrapper>
    );

    fireEvent.click(screen.getByTestId('message-all-reaction-item'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
