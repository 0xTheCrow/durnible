import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ImageContent } from './ImageContent';
import { MatrixTestWrapper } from '../../../../test/wrapper';

describe('ImageContent', () => {
  const defaultProps = {
    body: 'test image',
    mimeType: 'image/png',
    url: 'mxc://matrix.org/test',
    autoPlay: true,
    renderImage: ({ alt, title, src, onLoad, onError, onClick, tabIndex }: any) => (
      <img
        alt={alt}
        title={title}
        src={src}
        onLoad={onLoad}
        onError={onError}
        onClick={onClick}
        tabIndex={tabIndex}
      />
    ),
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
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
  });

  it('shows a View button when autoPlay is false and image is not a spoiler', async () => {
    render(
      <MatrixTestWrapper>
        <ImageContent {...defaultProps} autoPlay={false} />
      </MatrixTestWrapper>
    );
    await act(async () => {});
    expect(screen.getByText(/view/i)).toBeInTheDocument();
  });

  it('shows a Spoiler chip when markedAsSpoiler is true', async () => {
    render(
      <MatrixTestWrapper>
        <ImageContent {...defaultProps} autoPlay={false} markedAsSpoiler />
      </MatrixTestWrapper>
    );
    await act(async () => {});
    expect(screen.getByText(/spoiler/i)).toBeInTheDocument();
  });

});
