import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
