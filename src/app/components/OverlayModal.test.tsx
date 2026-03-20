import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OverlayModal } from './OverlayModal';

// FocusTrap doesn't work well in jsdom without real layout
vi.mock('focus-trap-react', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('OverlayModal', () => {
  it('renders children when open', () => {
    render(
      <OverlayModal open requestClose={vi.fn()}>
        <div>Modal Content</div>
      </OverlayModal>
    );
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('does not render children when closed', () => {
    render(
      <OverlayModal open={false} requestClose={vi.fn()}>
        <div>Modal Content</div>
      </OverlayModal>
    );
    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
  });
});
