import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageViewer } from './ImageViewer';

vi.mock('../../utils/matrix', () => ({
  downloadMedia: vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' })),
}));

vi.mock('file-saver', () => ({
  default: { saveAs: vi.fn() },
}));

const defaultProps = {
  src: 'https://example.com/image.png',
  alt: 'A test image',
  requestClose: vi.fn(),
};

const renderViewer = (props = defaultProps) => render(<ImageViewer {...props} />);

describe('ImageViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the image with the correct src and alt', () => {
      renderViewer();
      const img = screen.getByRole('img', { name: defaultProps.alt });
      expect(img).toHaveAttribute('src', defaultProps.src);
    });

    it('shows the alt text in the header', () => {
      renderViewer();
      expect(screen.getByText(defaultProps.alt)).toBeInTheDocument();
    });

    it('shows "100%" zoom by default', () => {
      renderViewer();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('zoom controls', () => {
    it('zoom in button increases zoom', () => {
      renderViewer();
      fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
      expect(screen.getByText('120%')).toBeInTheDocument();
    });

    it('zoom out button decreases zoom', () => {
      renderViewer();
      fireEvent.click(screen.getByRole('button', { name: /zoom out/i }));
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('zoom chip toggles between 100% and 200%', () => {
      renderViewer();
      fireEvent.click(screen.getByText('100%'));
      expect(screen.getByText('200%')).toBeInTheDocument();
      fireEvent.click(screen.getByText('200%'));
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('double-click zoom on desktop', () => {
    it('double-clicking the image zooms to 200%', () => {
      renderViewer();
      const img = screen.getByRole('img', { name: defaultProps.alt });
      // Manual double-click detection uses onClick, not onDoubleClick
      fireEvent.click(img, { clientX: 100, clientY: 100 });
      fireEvent.click(img, { clientX: 100, clientY: 100 });
      expect(screen.getByText('200%')).toBeInTheDocument();
    });

    it('double-clicking again resets zoom to 100%', () => {
      renderViewer();
      const img = screen.getByRole('img', { name: defaultProps.alt });
      fireEvent.click(img, { clientX: 100, clientY: 100 });
      fireEvent.click(img, { clientX: 100, clientY: 100 });
      fireEvent.click(img, { clientX: 100, clientY: 100 });
      fireEvent.click(img, { clientX: 100, clientY: 100 });
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('image drag and selection', () => {
    it('image has draggable set to false to prevent native browser drag', () => {
      renderViewer();
      const img = screen.getByRole('img', { name: defaultProps.alt });
      expect(img).toHaveAttribute('draggable', 'false');
    });

    it('mousedown on image calls preventDefault to suppress browser drag gesture', () => {
      renderViewer();
      const img = screen.getByRole('img', { name: defaultProps.alt });
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      img.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('close button', () => {
    it('calls requestClose when the back arrow is clicked', () => {
      const requestClose = vi.fn();
      render(<ImageViewer {...defaultProps} requestClose={requestClose} />);
      // The back button is the first button in the header and has no aria-label
      fireEvent.click(screen.getAllByRole('button')[0]);
      expect(requestClose).toHaveBeenCalledOnce();
    });
  });
});
