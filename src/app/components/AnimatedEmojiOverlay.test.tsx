import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnimatedEmojiOverlay } from './AnimatedEmojiOverlay';

describe('AnimatedEmojiOverlay', () => {
  it('renders a plain img when pauseGifs is false', () => {
    render(<AnimatedEmojiOverlay pauseGifs={false} src="test.gif" alt="test" />);
    expect(screen.getByTestId('animated-emoji-overlay')).toBeInTheDocument();
    expect(screen.queryByTestId('animated-emoji-overlay-wrapper')).toBeNull();
  });

  it('renders img with canvas wrapper when pauseGifs is true', () => {
    render(<AnimatedEmojiOverlay pauseGifs src="test.gif" alt="test" />);
    expect(screen.getByTestId('animated-emoji-overlay-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('animated-emoji-overlay')).toBeInTheDocument();
  });

  it('shows canvas after image loads when pauseGifs is true', () => {
    render(<AnimatedEmojiOverlay pauseGifs src="test.gif" alt="test" />);
    expect(screen.queryByTestId('animated-emoji-overlay-canvas')).toBeNull();

    fireEvent.load(screen.getByTestId('animated-emoji-overlay'));

    expect(screen.getByTestId('animated-emoji-overlay-canvas')).toBeInTheDocument();
  });

  it('shows the frozen-frame canvas after load when not hovered', () => {
    render(<AnimatedEmojiOverlay pauseGifs src="test.gif" alt="test" />);
    fireEvent.load(screen.getByTestId('animated-emoji-overlay'));
    expect(screen.getByTestId('animated-emoji-overlay-canvas')).not.toHaveStyle({
      visibility: 'hidden',
    });
  });

  it('hides the frozen-frame canvas on hover so the GIF can play', () => {
    render(<AnimatedEmojiOverlay pauseGifs src="test.gif" alt="test" />);
    const wrapper = screen.getByTestId('animated-emoji-overlay-wrapper');

    fireEvent.load(screen.getByTestId('animated-emoji-overlay'));
    const canvas = screen.getByTestId('animated-emoji-overlay-canvas');

    expect(canvas).not.toHaveStyle({ visibility: 'hidden' });

    fireEvent.mouseEnter(wrapper);
    expect(canvas).toHaveStyle({ visibility: 'hidden' });

    fireEvent.mouseLeave(wrapper);
    expect(canvas).not.toHaveStyle({ visibility: 'hidden' });
  });

  it('respects an externally controlled hovered prop', () => {
    const { rerender } = render(
      <AnimatedEmojiOverlay pauseGifs hovered={false} src="test.gif" alt="test" />
    );
    fireEvent.load(screen.getByTestId('animated-emoji-overlay'));
    const canvas = screen.getByTestId('animated-emoji-overlay-canvas');

    expect(canvas).not.toHaveStyle({ visibility: 'hidden' });

    rerender(<AnimatedEmojiOverlay pauseGifs hovered src="test.gif" alt="test" />);
    expect(canvas).toHaveStyle({ visibility: 'hidden' });
  });

  it('calls the original onLoad handler when the image loads', () => {
    const onLoad = vi.fn();
    render(<AnimatedEmojiOverlay pauseGifs src="test.gif" alt="test" onLoad={onLoad} />);
    fireEvent.load(screen.getByTestId('animated-emoji-overlay'));
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('hides the underlying img when loaded and not hovered (canvas shows frozen frame)', () => {
    render(<AnimatedEmojiOverlay pauseGifs src="test.gif" alt="test" />);
    const img = screen.getByTestId('animated-emoji-overlay');

    expect(img).not.toHaveStyle({ visibility: 'hidden' });

    fireEvent.load(img);

    expect(img).toHaveStyle({ visibility: 'hidden' });
  });

  it('reveals the underlying img when hovered so the GIF can animate', () => {
    render(<AnimatedEmojiOverlay pauseGifs src="test.gif" alt="test" />);
    const img = screen.getByTestId('animated-emoji-overlay');
    fireEvent.load(img);

    fireEvent.mouseEnter(screen.getByTestId('animated-emoji-overlay-wrapper'));

    expect(img).not.toHaveStyle({ visibility: 'hidden' });
  });
});
