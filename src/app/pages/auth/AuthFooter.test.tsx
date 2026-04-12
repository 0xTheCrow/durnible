import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AuthFooter } from './AuthFooter';

describe('AuthFooter', () => {
  it('renders the footer and its canonical links', () => {
    render(<AuthFooter />);
    expect(screen.getByTestId('auth-footer')).toBeInTheDocument();
    expect(screen.getByTestId('auth-footer-about-link')).toBeInTheDocument();
    expect(screen.getByTestId('auth-footer-matrix-link')).toBeInTheDocument();
  });
});
