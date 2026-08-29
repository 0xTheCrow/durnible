import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OverlayModal } from './OverlayModal';

// focus-trap needs real layout to find tabbable nodes; it throws in the test DOM.
vi.mock('focus-trap-react', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('OverlayModal', () => {
  it('renders children when open', () => {
    render(
      <OverlayModal open onClose={vi.fn()}>
        <div data-testid="overlay-modal-child">Modal Content</div>
      </OverlayModal>
    );
    expect(screen.getByTestId('overlay-modal-child')).toBeInTheDocument();
  });

  it('does not render children when closed', () => {
    render(
      <OverlayModal open={false} onClose={vi.fn()}>
        <div data-testid="overlay-modal-child">Modal Content</div>
      </OverlayModal>
    );
    expect(screen.queryByTestId('overlay-modal-child')).not.toBeInTheDocument();
  });
});
