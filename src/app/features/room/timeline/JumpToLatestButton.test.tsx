import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { JumpToLatestButton } from './JumpToLatestButton';

describe('JumpToLatestButton', () => {
  it('renders with data-visible="true" when visible is true', () => {
    const { container } = render(<JumpToLatestButton visible onClick={() => undefined} />);
    const overlay = container.querySelector('[data-testid="jump-to-latest-overlay"]');
    expect(overlay?.getAttribute('data-visible')).toBe('true');
  });

  it('renders with data-visible="false" when visible is false', () => {
    const { container } = render(<JumpToLatestButton visible={false} onClick={() => undefined} />);
    const overlay = container.querySelector('[data-testid="jump-to-latest-overlay"]');
    expect(overlay?.getAttribute('data-visible')).toBe('false');
  });

  it('calls onClick when the chip is clicked', () => {
    const onClick = vi.fn();
    const { container } = render(<JumpToLatestButton visible onClick={onClick} />);
    const chip = container.querySelector('[data-testid="jump-to-latest-button"]') as HTMLElement;
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
