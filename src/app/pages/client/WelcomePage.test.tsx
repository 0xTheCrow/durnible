import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WelcomePage } from './WelcomePage';

describe('WelcomePage', () => {
  it('renders without crashing', () => {
    render(<WelcomePage />);
    expect(screen.getByText('Welcome to Durnible')).toBeInTheDocument();
  });

  it('renders source code and support links', () => {
    render(<WelcomePage />);
    expect(screen.getByText('Source Code')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
  });
});
