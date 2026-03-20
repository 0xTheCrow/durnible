import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AuthFooter } from './AuthFooter';

describe('AuthFooter', () => {
  it('renders without crashing', () => {
    render(<AuthFooter />);
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Powered by Matrix')).toBeInTheDocument();
  });
});
