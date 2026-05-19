import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WelcomePage } from './WelcomePage';

describe('WelcomePage', () => {
  it('renders the welcome page', () => {
    render(<WelcomePage />);
    expect(screen.getByTestId('welcome-page')).toBeInTheDocument();
  });
});
