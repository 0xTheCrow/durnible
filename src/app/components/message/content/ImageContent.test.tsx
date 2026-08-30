import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageContent } from './ImageContent';
import { MatrixTestWrapper } from '../../../../test/wrapper';
import { useSetting } from '../../../state/hooks/settings';
import { decryptFile } from '../../../utils/matrix';
import type * as MatrixUtils from '../../../utils/matrix';
import { FALLBACK_MIMETYPE } from '../../../utils/mimeTypes';

vi.mock('../../../state/hooks/settings', () => ({
  useSetting: vi.fn(),
  useSetSetting: vi.fn(() => vi.fn()),
}));

vi.mock('../../../utils/matrix', async (importOriginal) => ({
  ...(await importOriginal<typeof MatrixUtils>()),
  downloadEncryptedMedia: vi.fn((_url: string, processData: (buf: ArrayBuffer) => unknown) =>
    Promise.resolve(processData(new ArrayBuffer(8)))
  ),
  decryptFile: vi.fn().mockResolvedValue(new Blob(['decrypted'])),
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
      expect(screen.getByTestId('animated-image-overlay-canvas')).toBeInTheDocument();
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
      expect(screen.queryByTestId('animated-image-overlay-canvas')).not.toBeInTheDocument();
    });

    it('does not show canvas overlay for non-GIF images', async () => {
      render(
        <MatrixTestWrapper>
          <ImageContent {...gifProps} mimeType="image/png" />
        </MatrixTestWrapper>
      );
      await act(async () => {});
      fireEvent.load(screen.getByTestId('test-image'));
      expect(screen.queryByTestId('animated-image-overlay-canvas')).not.toBeInTheDocument();
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
      const canvas = screen.getByTestId('animated-image-overlay-canvas');
      const container = screen.getByTestId('image-content');

      expect(canvas).toHaveStyle({ visibility: 'visible' });

      fireEvent.mouseEnter(container);
      expect(canvas).toHaveStyle({ visibility: 'hidden' });

      fireEvent.mouseLeave(container);
      expect(canvas).toHaveStyle({ visibility: 'visible' });
    });

    it('freezes an animated spoiler to its first frame and ignores hover', async () => {
      render(
        <MatrixTestWrapper>
          <ImageContent {...gifProps} markedAsSpoiler />
        </MatrixTestWrapper>
      );
      await act(async () => {});
      fireEvent.load(screen.getByTestId('test-image'));
      const canvas = screen.getByTestId('animated-image-overlay-canvas');
      expect(canvas).toHaveStyle({ visibility: 'visible' });

      fireEvent.mouseEnter(screen.getByTestId('image-content'));
      expect(canvas).toHaveStyle({ visibility: 'visible' });
    });

    it('animates immediately when unhidden while still hovered', async () => {
      render(
        <MatrixTestWrapper>
          <ImageContent {...gifProps} markedAsSpoiler />
        </MatrixTestWrapper>
      );
      await act(async () => {});
      fireEvent.load(screen.getByTestId('test-image'));
      const canvas = screen.getByTestId('animated-image-overlay-canvas');

      fireEvent.mouseEnter(screen.getByTestId('image-content'));
      expect(canvas).toHaveStyle({ visibility: 'visible' });

      fireEvent.click(screen.getByTestId('image-content-spoiler-chip'));
      expect(canvas).toHaveStyle({ visibility: 'hidden' });
    });

    it('freezes an animated spoiler even when pauseGifs is disabled', async () => {
      vi.mocked(useSetting).mockReturnValue([false, vi.fn()] as any);
      render(
        <MatrixTestWrapper>
          <ImageContent {...gifProps} markedAsSpoiler />
        </MatrixTestWrapper>
      );
      await act(async () => {});
      fireEvent.load(screen.getByTestId('test-image'));
      expect(screen.getByTestId('animated-image-overlay-canvas')).toBeInTheDocument();
    });
  });

  describe('encrypted blob mime type', () => {
    const encryptionInfo = { key: 'k', iv: 'iv', hashes: {}, v: 'v2' } as any;

    beforeEach(() => {
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    });

    const renderEncryptedImage = (mimeType: string) =>
      render(
        <MatrixTestWrapper>
          <ImageContent
            body="image"
            mimeType={mimeType}
            url="mxc://matrix.org/encrypted"
            encryptionInfo={encryptionInfo}
            autoPlay
            renderImage={renderImageWithTestId}
          />
        </MatrixTestWrapper>
      );

    it('degrades a sender-controlled script-capable mime type to the safe fallback', async () => {
      renderEncryptedImage('image/svg+xml');
      await waitFor(() => expect(decryptFile).toHaveBeenCalled());
      expect(decryptFile).toHaveBeenCalledWith(
        expect.anything(),
        FALLBACK_MIMETYPE,
        encryptionInfo
      );
    });

    it('degrades a non-image document mime type to the safe fallback', async () => {
      renderEncryptedImage('text/html');
      await waitFor(() => expect(decryptFile).toHaveBeenCalled());
      expect(decryptFile).toHaveBeenCalledWith(
        expect.anything(),
        FALLBACK_MIMETYPE,
        encryptionInfo
      );
    });

    it('preserves an allowed image mime type', async () => {
      renderEncryptedImage('image/png');
      await waitFor(() => expect(decryptFile).toHaveBeenCalled());
      expect(decryptFile).toHaveBeenCalledWith(expect.anything(), 'image/png', encryptionInfo);
    });
  });
});
