import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageContent } from './ImageContent';
import { MatrixTestWrapper } from '../../../../test/wrapper';
import { useSetting } from '../../../state/hooks/settings';

vi.mock('../../../state/hooks/settings', () => ({
  useSetting: vi.fn(),
  useSetSetting: vi.fn(() => vi.fn()),
}));

const renderImageWithTestId = ({ alt, title, src, onLoad, onError, onClick, tabIndex }: any) => (
  <img
    data-testid="test-image"
    alt={alt}
    title={title}
    src={src}
    onLoad={onLoad}
    onError={onError}
    onClick={onClick}
    tabIndex={tabIndex}
  />
);

describe('ImageContent', () => {
  beforeEach(() => {
    // Default: "Play GIFs on Hover" is off
    vi.mocked(useSetting).mockReturnValue([false, vi.fn()] as any);
  });

  const defaultProps = {
    body: 'test image',
    mimeType: 'image/png',
    url: 'mxc://matrix.org/test',
    autoPlay: true,
    renderImage: renderImageWithTestId,
  };

  it('renders without crashing', async () => {
    render(
      <MatrixTestWrapper>
        <ImageContent {...defaultProps} />
      </MatrixTestWrapper>
    );
    await act(async () => {});
  });

  it('shows size badge when info.size is provided and image not loaded', async () => {
    render(
      <MatrixTestWrapper>
        <ImageContent
          {...defaultProps}
          autoPlay={false}
          info={{ size: 1024, mimetype: 'image/png' } as any}
        />
      </MatrixTestWrapper>
    );
    await act(async () => {});
    expect(screen.getByTestId('image-content-size-badge')).toBeInTheDocument();
  });

  it('shows a View button when autoPlay is false and image is not a spoiler', async () => {
    render(
      <MatrixTestWrapper>
        <ImageContent {...defaultProps} autoPlay={false} />
      </MatrixTestWrapper>
    );
    await act(async () => {});
    expect(screen.getByTestId('image-content-view-btn')).toBeInTheDocument();
  });

  it('shows a Spoiler chip when markedAsSpoiler is true', async () => {
    render(
      <MatrixTestWrapper>
        <ImageContent {...defaultProps} autoPlay={false} markedAsSpoiler />
      </MatrixTestWrapper>
    );
    await act(async () => {});
    expect(screen.getByTestId('image-content-spoiler-chip')).toBeInTheDocument();
  });

  describe('Play GIFs on Hover (pauseGifs setting)', () => {
    // renderImage that forwards style so we can test visibility
    const gifRenderImage = ({
      alt,
      title,
      src,
      style,
      onLoad,
      onError,
      onClick,
      tabIndex,
    }: any) => (
      <img
        data-testid="test-image"
        alt={alt}
        title={title}
        src={src}
        style={style}
        onLoad={onLoad}
        onError={onError}
        onClick={onClick}
        tabIndex={tabIndex}
      />
    );

    const gifProps = {
      body: 'test image',
      mimeType: 'image/gif' as const,
      url: 'mxc://matrix.org/test',
      autoPlay: true,
      renderImage: gifRenderImage,
    };

    beforeEach(() => {
      vi.mocked(useSetting).mockReturnValue([true, vi.fn()] as any);
    });

    it('shows a canvas overlay after a GIF loads', async () => {
      render(
        <MatrixTestWrapper>
          <ImageContent {...gifProps} />
        </MatrixTestWrapper>
      );
      await act(async () => {});
      fireEvent.load(screen.getByTestId('test-image'));
      expect(screen.getByTestId('image-content-paused-gif-canvas')).toBeInTheDocument();
    });

    it('does not show canvas overlay when pauseGifs is disabled', async () => {
      vi.mocked(useSetting).mockReturnValue([false, vi.fn()] as any);
      render(
        <MatrixTestWrapper>
          <ImageContent {...gifProps} />
        </MatrixTestWrapper>
      );
      await act(async () => {});
      fireEvent.load(screen.getByTestId('test-image'));
      expect(screen.queryByTestId('image-content-paused-gif-canvas')).not.toBeInTheDocument();
    });

    it('does not show canvas overlay for non-GIF images', async () => {
      render(
        <MatrixTestWrapper>
          <ImageContent {...gifProps} mimeType="image/png" />
        </MatrixTestWrapper>
      );
      await act(async () => {});
      fireEvent.load(screen.getByTestId('test-image'));
      expect(screen.queryByTestId('image-content-paused-gif-canvas')).not.toBeInTheDocument();
    });

    it('hides the underlying img while paused (canvas shows frozen frame)', async () => {
      render(
        <MatrixTestWrapper>
          <ImageContent {...gifProps} />
        </MatrixTestWrapper>
      );
      await act(async () => {});
      const img = screen.getByTestId('test-image');
      fireEvent.load(img);
      expect(img).toHaveStyle({ visibility: 'hidden' });
    });

    it('shows img as visible before it finishes loading', async () => {
      render(
        <MatrixTestWrapper>
          <ImageContent {...gifProps} />
        </MatrixTestWrapper>
      );
      await act(async () => {});
      // load event NOT fired — img is not yet in paused state
      const img = screen.getByTestId('test-image');
      expect(img).not.toHaveStyle({ visibility: 'hidden' });
    });

    it('hides canvas on hover so the GIF can animate', async () => {
      render(
        <MatrixTestWrapper>
          <ImageContent {...gifProps} />
        </MatrixTestWrapper>
      );
      await act(async () => {});
      fireEvent.load(screen.getByTestId('test-image'));
      const canvas = screen.getByTestId('image-content-paused-gif-canvas');
      const overlay = screen.getByTestId('image-content-paused-gif-overlay');

      // Frozen frame visible before hover
      expect(canvas).toHaveStyle({ display: 'block' });

      fireEvent.mouseEnter(overlay);
      expect(canvas).toHaveStyle({ display: 'none' });

      // Leave: frozen frame returns
      fireEvent.mouseLeave(overlay);
      expect(canvas).toHaveStyle({ display: 'block' });
    });

    it('does not show canvas overlay when the image is a spoiler (blurred)', async () => {
      render(
        <MatrixTestWrapper>
          <ImageContent {...gifProps} markedAsSpoiler />
        </MatrixTestWrapper>
      );
      await act(async () => {});
      // The <img> is not rendered when blurred — try to find it defensively.
      const img = screen.queryByTestId('test-image');
      if (img) fireEvent.load(img);
      // Canvas requires !effectiveBlurred — spoiler keeps it suppressed
      expect(screen.queryByTestId('image-content-paused-gif-canvas')).not.toBeInTheDocument();
    });
  });
});
