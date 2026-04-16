import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageViewer, IMAGE_VIEWER_ZOOM_STEP } from './ImageViewer';

const zoomLabel = (zoom: number) => `${Math.round(zoom * 100)}%`;

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
    it('renders the image with the provided src and alt', () => {
      renderViewer();
      const img = screen.getByTestId('image-viewer-img');
      expect(img).toHaveAttribute('src', defaultProps.src);
      expect(img).toHaveAttribute('alt', defaultProps.alt);
    });

    it('shows the alt text in the header', () => {
      renderViewer();
      expect(screen.getByTestId('image-viewer-alt')).toHaveTextContent(defaultProps.alt);
    });

    it('shows 100% zoom by default', () => {
      renderViewer();
      expect(screen.getByTestId('image-viewer-zoom-label')).toHaveTextContent('100%');
    });
  });

  describe('zoom controls', () => {
    it('zoom in button increases zoom', () => {
      renderViewer();
      fireEvent.click(screen.getByTestId('image-viewer-zoom-in'));
      expect(screen.getByTestId('image-viewer-zoom-label')).toHaveTextContent(
        zoomLabel(1 + IMAGE_VIEWER_ZOOM_STEP)
      );
    });

    it('zoom out button decreases zoom', () => {
      renderViewer();
      fireEvent.click(screen.getByTestId('image-viewer-zoom-out'));
      expect(screen.getByTestId('image-viewer-zoom-label')).toHaveTextContent(
        zoomLabel(1 - IMAGE_VIEWER_ZOOM_STEP)
      );
    });

    it('zoom chip toggles between 100% and 200%', () => {
      renderViewer();
      const label = screen.getByTestId('image-viewer-zoom-label');
      fireEvent.click(screen.getByTestId('image-viewer-zoom-chip'));
      expect(label).toHaveTextContent('200%');
      fireEvent.click(screen.getByTestId('image-viewer-zoom-chip'));
      expect(label).toHaveTextContent('100%');
    });
  });

  describe('double-click zoom on desktop', () => {
    it('double-clicking the image zooms to 200%', () => {
      renderViewer();
      const img = screen.getByTestId('image-viewer-img');
      // Manual double-click detection uses onClick, not onDoubleClick
      fireEvent.click(img, { clientX: 100, clientY: 100 });
      fireEvent.click(img, { clientX: 100, clientY: 100 });
      expect(screen.getByTestId('image-viewer-zoom-label')).toHaveTextContent('200%');
    });

    it('double-clicking again resets zoom to 100%', () => {
      renderViewer();
      const img = screen.getByTestId('image-viewer-img');
      fireEvent.click(img, { clientX: 100, clientY: 100 });
      fireEvent.click(img, { clientX: 100, clientY: 100 });
      fireEvent.click(img, { clientX: 100, clientY: 100 });
      fireEvent.click(img, { clientX: 100, clientY: 100 });
      expect(screen.getByTestId('image-viewer-zoom-label')).toHaveTextContent('100%');
    });
  });

  describe('image drag and selection', () => {
    it('image has draggable set to false to prevent native browser drag', () => {
      renderViewer();
      expect(screen.getByTestId('image-viewer-img')).toHaveAttribute('draggable', 'false');
    });

    it('mousedown on image calls preventDefault to suppress browser drag gesture', () => {
      renderViewer();
      const img = screen.getByTestId('image-viewer-img');
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      img.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('close button', () => {
    it('calls requestClose when the close button is clicked', () => {
      const requestClose = vi.fn();
      render(<ImageViewer {...defaultProps} requestClose={requestClose} />);
      fireEvent.click(screen.getByTestId('image-viewer-close-btn'));
      expect(requestClose).toHaveBeenCalledOnce();
    });
  });
});
