import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { AuthLayout } from './AuthLayout';
import { TestWrapper } from '../../../test/wrapper';

// Matrix-sdk calls fetch with Request objects, not plain strings — extract the URL from any input type
function getUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url;
}

// Mock fetch: well-known 404 (IGNORE → use defaults), valid responses for all auth endpoints
vi.stubGlobal(
  'fetch',
  vi.fn((input: RequestInfo | URL) => {
    const url = getUrl(input);
    if (url.includes('/_matrix/client/versions')) {
      return Promise.resolve(
        new Response(JSON.stringify({ versions: ['v1.11'] }), { status: 200 })
      );
    }
    if (url.includes('/login')) {
      return Promise.resolve(
        new Response(JSON.stringify({ flows: [{ type: 'm.login.password' }] }), { status: 200 })
      );
    }
    if (url.includes('/register')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ session: 'test', flows: [{ stages: ['m.login.dummy'] }], params: {} }),
          { status: 401 }
        )
      );
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
  })
);

describe('AuthLayout', () => {
  it('renders without crashing', async () => {
    render(
      <TestWrapper route="/login/matrix.org">
        <Routes>
          <Route path="/login/:server" element={<AuthLayout />} />
        </Routes>
      </TestWrapper>
    );
    await act(async () => {});
    expect(screen.getByText('Cinny')).toBeInTheDocument();
    expect(screen.getByText('Homeserver')).toBeInTheDocument();
  });

  it('renders the auth footer', async () => {
    render(
      <TestWrapper route="/login/matrix.org">
        <Routes>
          <Route path="/login/:server" element={<AuthLayout />} />
        </Routes>
      </TestWrapper>
    );
    await act(async () => {});
    expect(screen.getByText('Powered by Matrix')).toBeInTheDocument();
  });
});
