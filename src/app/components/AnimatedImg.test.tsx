import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnimatedImg } from './AnimatedImg';

describe('AnimatedImg', () => {
  it('renders a plain img when pauseGifs is false', () => {
    render(<AnimatedImg pauseGifs={false} src="test.gif" alt="test" />);
    expect(screen.getByTestId('animated-img')).toBeInTheDocument();
    expect(screen.queryByTestId('animated-img-wrapper')).toBeNull();
  });

  it('renders img with canvas wrapper when pauseGifs is true', () => {
    render(<AnimatedImg pauseGifs src="test.gif" alt="test" />);
    expect(screen.getByTestId('animated-img-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('animated-img')).toBeInTheDocument();
  });

  it('shows canvas after image loads when pauseGifs is true', () => {
    render(<AnimatedImg pauseGifs src="test.gif" alt="test" />);
    expect(screen.queryByTestId('animated-img-canvas')).toBeNull();

    fireEvent.load(screen.getByTestId('animated-img'));

    expect(screen.getByTestId('animated-img-canvas')).toBeInTheDocument();
  });

  it('shows the frozen-frame canvas after load when not hovered', () => {
    render(<AnimatedImg pauseGifs src="test.gif" alt="test" />);
    fireEvent.load(screen.getByTestId('animated-img'));
    expect(screen.getByTestId('animated-img-canvas')).not.toHaveStyle({ visibility: 'hidden' });
  });

  it('hides the frozen-frame canvas on hover so the GIF can play', () => {
    render(<AnimatedImg pauseGifs src="test.gif" alt="test" />);
    const wrapper = screen.getByTestId('animated-img-wrapper');

    fireEvent.load(screen.getByTestId('animated-img'));
    const canvas = screen.getByTestId('animated-img-canvas');

    expect(canvas).not.toHaveStyle({ visibility: 'hidden' });

    fireEvent.mouseEnter(wrapper);
    expect(canvas).toHaveStyle({ visibility: 'hidden' });

    fireEvent.mouseLeave(wrapper);
    expect(canvas).not.toHaveStyle({ visibility: 'hidden' });
  });

  it('respects an externally controlled hovered prop', () => {
    const { rerender } = render(
      <AnimatedImg pauseGifs hovered={false} src="test.gif" alt="test" />
    );
    fireEvent.load(screen.getByTestId('animated-img'));
    const canvas = screen.getByTestId('animated-img-canvas');

    expect(canvas).not.toHaveStyle({ visibility: 'hidden' });

    rerender(<AnimatedImg pauseGifs hovered src="test.gif" alt="test" />);
    expect(canvas).toHaveStyle({ visibility: 'hidden' });
  });

  it('calls the original onLoad handler when the image loads', () => {
    const onLoad = vi.fn();
    render(<AnimatedImg pauseGifs src="test.gif" alt="test" onLoad={onLoad} />);
    fireEvent.load(screen.getByTestId('animated-img'));
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('hides the underlying img when loaded and not hovered (canvas shows frozen frame)', () => {
    render(<AnimatedImg pauseGifs src="test.gif" alt="test" />);
    const img = screen.getByTestId('animated-img');

    expect(img).not.toHaveStyle({ visibility: 'hidden' });

    fireEvent.load(img);

    expect(img).toHaveStyle({ visibility: 'hidden' });
  });

  it('reveals the underlying img when hovered so the GIF can animate', () => {
    render(<AnimatedImg pauseGifs src="test.gif" alt="test" />);
    const img = screen.getByTestId('animated-img');
    fireEvent.load(img);

    fireEvent.mouseEnter(screen.getByTestId('animated-img-wrapper'));

    expect(img).not.toHaveStyle({ visibility: 'hidden' });
  });
});
