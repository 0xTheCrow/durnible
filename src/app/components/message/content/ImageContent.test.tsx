import React from 'react';
import { render, screen } from '@testing-library/react';
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

  it('renders without crashing', () => {
    render(
      <MatrixTestWrapper>
        <ImageContent {...defaultProps} />
      </MatrixTestWrapper>
    );
  });

  it('shows size badge when info.size is provided and image not loaded', () => {
    render(
      <MatrixTestWrapper>
        <ImageContent
          {...defaultProps}
          autoPlay={false}
          info={{ size: 1024, mimetype: 'image/png' } as any}
        />
      </MatrixTestWrapper>
    );
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
  });
});
