import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WelcomePage } from './WelcomePage';

describe('WelcomePage', () => {
  it('renders the welcome page with source and support links', () => {
    render(<WelcomePage />);
    expect(screen.getByTestId('welcome-page')).toBeInTheDocument();
    expect(screen.getByTestId('welcome-source-link')).toBeInTheDocument();
    expect(screen.getByTestId('welcome-support-link')).toBeInTheDocument();
  });
});
