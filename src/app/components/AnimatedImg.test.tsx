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
    const { container } = render(
      <AnimatedImg pauseGifs src="test.gif" alt="test" />
    );
    const img = screen.getByAltText('test');
    expect(img).toBeInTheDocument();
    // Should be wrapped in a span
    expect(img.parentElement?.tagName).toBe('SPAN');
  });

  it('shows canvas after image loads when pauseGifs is true', () => {
    const { container } = render(
      <AnimatedImg pauseGifs src="test.gif" alt="test" />
    );
    // No canvas before load
    expect(container.querySelector('canvas')).toBeNull();

    // Trigger load
    fireEvent.load(screen.getByAltText('test'));

    // Canvas should appear
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('hides the img and shows canvas (frozen frame) when loaded and not hovered', () => {
    render(<AnimatedImg pauseGifs src="test.gif" alt="test" />);
    const img = screen.getByAltText('test');

    fireEvent.load(img);

    expect(img).toHaveStyle({ visibility: 'hidden' });
  });

  it('shows the img and hides canvas on hover when self-managed', () => {
    const { container } = render(<AnimatedImg pauseGifs src="test.gif" alt="test" />);
    const img = screen.getByAltText('test');
    const wrapper = img.parentElement!;

    fireEvent.load(img);
    // Before hover: img is hidden
    expect(img).toHaveStyle({ visibility: 'hidden' });

    fireEvent.mouseEnter(wrapper);
    // After hover: img becomes visible (playing)
    expect(img).toHaveStyle({ visibility: 'visible' });

    fireEvent.mouseLeave(wrapper);
    // After leaving: img hidden again
    expect(img).toHaveStyle({ visibility: 'hidden' });
  });

  it('respects an externally controlled hovered prop', () => {
    const { rerender } = render(
      <AnimatedImg pauseGifs hovered={false} src="test.gif" alt="test" />
    );
    const img = screen.getByAltText('test');
    fireEvent.load(img);

    expect(img).toHaveStyle({ visibility: 'hidden' });

    rerender(<AnimatedImg pauseGifs hovered src="test.gif" alt="test" />);
    expect(img).toHaveStyle({ visibility: 'visible' });
  });

  it('calls the original onLoad handler when the image loads', () => {
    const onLoad = vi.fn();
    render(<AnimatedImg pauseGifs src="test.gif" alt="test" onLoad={onLoad} />);
    fireEvent.load(screen.getByAltText('test'));
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});
