import React from 'react';
import { render, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { AuthLayout } from './AuthLayout';
import { TestWrapper } from '../../../test/wrapper';

// Mock fetch for auto-discovery
vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve(new Response(JSON.stringify({}), { status: 404 }))
));

describe('AuthLayout', () => {
  it('renders without crashing', () => {
    render(
      <TestWrapper route="/login/matrix.org">
        <Routes>
          <Route path="/login/:server" element={<AuthLayout />} />
        </Routes>
      </TestWrapper>
    );
    expect(screen.getByText('Cinny')).toBeInTheDocument();
    expect(screen.getByText('Homeserver')).toBeInTheDocument();
  });

  it('renders the auth footer', () => {
    render(
      <TestWrapper route="/login/matrix.org">
        <Routes>
          <Route path="/login/:server" element={<AuthLayout />} />
        </Routes>
      </TestWrapper>
    );
    expect(screen.getByText('Powered by Matrix')).toBeInTheDocument();
  });
});
