import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnimatedImg } from './AnimatedImg';

describe('AnimatedImg', () => {
  it('renders a plain img when pauseGifs is false', () => {
    render(<AnimatedImg pauseGifs={false} src="test.gif" alt="test" />);
    const img = screen.getByAltText('test');
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
  });

  it('renders img with canvas wrapper when pauseGifs is true', () => {
    render(<AnimatedImg pauseGifs src="test.gif" alt="test" />);
    const img = screen.getByAltText('test');
    expect(img).toBeInTheDocument();
    // Should be wrapped in a span
    expect(img.parentElement?.tagName).toBe('SPAN');
  });

  it('shows canvas after image loads when pauseGifs is true', () => {
    const { container } = render(<AnimatedImg pauseGifs src="test.gif" alt="test" />);
    // No canvas before load
    expect(container.querySelector('canvas')).toBeNull();

    // Trigger load
    fireEvent.load(screen.getByAltText('test'));

    // Canvas should appear
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('shows the frozen-frame canvas after load when not hovered', () => {
    const { container } = render(<AnimatedImg pauseGifs src="test.gif" alt="test" />);
    fireEvent.load(screen.getByAltText('test'));
    const canvas = container.querySelector('canvas')!;
    // Canvas is the frozen frame — it should be visible, not hidden
    expect(canvas).not.toHaveStyle({ visibility: 'hidden' });
  });

  it('hides the frozen-frame canvas on hover so the GIF can play', () => {
    const { container } = render(<AnimatedImg pauseGifs src="test.gif" alt="test" />);
    const img = screen.getByAltText('test');
    const wrapper = img.parentElement!;

    fireEvent.load(img);
    const canvas = container.querySelector('canvas')!;

    // Before hover: frozen frame shown
    expect(canvas).not.toHaveStyle({ visibility: 'hidden' });

    // Hover: frozen frame hidden so GIF plays underneath
    fireEvent.mouseEnter(wrapper);
    expect(canvas).toHaveStyle({ visibility: 'hidden' });

    // Leave: frozen frame visible again
    fireEvent.mouseLeave(wrapper);
    expect(canvas).not.toHaveStyle({ visibility: 'hidden' });
  });

  it('respects an externally controlled hovered prop', () => {
    const { container, rerender } = render(
      <AnimatedImg pauseGifs hovered={false} src="test.gif" alt="test" />
    );
    fireEvent.load(screen.getByAltText('test'));
    const canvas = container.querySelector('canvas')!;

    // hovered=false: frozen frame shown
    expect(canvas).not.toHaveStyle({ visibility: 'hidden' });

    // hovered=true: frozen frame hidden, GIF plays
    rerender(<AnimatedImg pauseGifs hovered src="test.gif" alt="test" />);
    expect(canvas).toHaveStyle({ visibility: 'hidden' });
  });

  it('calls the original onLoad handler when the image loads', () => {
    const onLoad = vi.fn();
    render(<AnimatedImg pauseGifs src="test.gif" alt="test" onLoad={onLoad} />);
    fireEvent.load(screen.getByAltText('test'));
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('hides the underlying img when loaded and not hovered (canvas shows frozen frame)', () => {
    render(<AnimatedImg pauseGifs src="test.gif" alt="test" />);
    const img = screen.getByAltText('test');

    // Before load: img is visible (no frozen frame to replace it yet)
    expect(img).not.toHaveStyle({ visibility: 'hidden' });

    fireEvent.load(img);

    // After load: img is hidden behind the frozen-frame canvas
    expect(img).toHaveStyle({ visibility: 'hidden' });
  });

  it('reveals the underlying img when hovered so the GIF can animate', () => {
    render(<AnimatedImg pauseGifs src="test.gif" alt="test" />);
    const img = screen.getByAltText('test');
    fireEvent.load(img);

    const wrapper = img.parentElement!;
    fireEvent.mouseEnter(wrapper);

    // While hovered the img is visible (GIF plays) and the canvas is hidden
    expect(img).not.toHaveStyle({ visibility: 'hidden' });
  });
});
