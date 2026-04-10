import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClientRoot, isChunkLoadError } from './ClientRoot';
import { initClient } from '../../../client/initMatrix';
import { getFallbackSession } from '../../state/sessions';

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../client/initMatrix', () => ({
  initClient: vi.fn(),
  startClient: vi.fn(),
  clearCacheAndReload: vi.fn(),
  logoutClient: vi.fn(),
}));

vi.mock('../../state/sessions', () => ({
  getFallbackSession: vi.fn(),
}));

// Render children directly — avoids SpecVersionsLoader making network calls.
vi.mock('./SpecVersions', () => ({
  SpecVersions: ({ children }: { children: React.ReactNode }): React.ReactNode => children,
}));

const mockInitClient = vi.mocked(initClient);
const mockGetFallbackSession = vi.mocked(getFallbackSession);

const MOCK_SESSION = {
  baseUrl: 'https://matrix.example.com',
  userId: '@user:example.com',
  deviceId: 'DEVICE123',
  accessToken: 'token123',
  homeserver: 'example.com',
};

// ── isChunkLoadError ──────────────────────────────────────────────────────────

describe('isChunkLoadError', () => {
  it('detects the Chrome "Failed to fetch dynamically imported module" message', () => {
    const err = new Error(
      'Failed to fetch dynamically imported module: https://app.example.com/assets/index-D882sB8o.js'
    );
    expect(isChunkLoadError(err)).toBe(true);
  });

  it('detects the Firefox "error loading dynamically imported module" message', () => {
    const err = new Error(
      'error loading dynamically imported module: https://app.example.com/assets/index-D882sB8o.js'
    );
    expect(isChunkLoadError(err)).toBe(true);
  });

  it('does not match a plain network "Failed to fetch" (no module reference)', () => {
    expect(isChunkLoadError(new Error('Failed to fetch'))).toBe(false);
  });

  it('does not match auth or session errors', () => {
    expect(isChunkLoadError(new Error('No session Found!'))).toBe(false);
    expect(isChunkLoadError(new Error('Unknown token'))).toBe(false);
  });

  it('does not match generic runtime errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(new Error('Network request failed'))).toBe(false);
  });
});

// ── ClientRoot error dialog ───────────────────────────────────────────────────

const CHUNK_ERROR = new Error(
  'Failed to fetch dynamically imported module: https://app.example.com/assets/index-D882sB8o.js'
);
const GENERIC_ERROR = new Error('No session Found!');

describe('ClientRoot error dialog', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadSpy },
    });
    mockGetFallbackSession.mockReturnValue(MOCK_SESSION as ReturnType<typeof getFallbackSession>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when initClient fails with a chunk load error', () => {
    beforeEach(() => {
      mockInitClient.mockRejectedValue(CHUNK_ERROR);
    });

    it('shows a "Reload" button instead of "Retry"', async () => {
      render(<ClientRoot>loaded</ClientRoot>);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
      );
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });

    it('shows an "app was updated" message instead of the raw error string', async () => {
      render(<ClientRoot>loaded</ClientRoot>);
      await waitFor(() =>
        expect(
          screen.getByText('Failed to load. The app was updated — please reload.')
        ).toBeInTheDocument()
      );
      // Raw module URL must not be visible — that would be confusing to users.
      expect(screen.queryByText(/index-D882sB8o/)).not.toBeInTheDocument();
    });

    it('calls window.location.reload() when "Reload" is clicked', async () => {
      render(<ClientRoot>loaded</ClientRoot>);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
      );

      fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

      expect(reloadSpy).toHaveBeenCalledOnce();
    });
  });

  describe('when initClient fails with a non-chunk error', () => {
    beforeEach(() => {
      mockInitClient.mockRejectedValue(GENERIC_ERROR);
    });

    it('shows a "Reload" button (all load failures reload)', async () => {
      render(<ClientRoot>loaded</ClientRoot>);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
      );
    });

    it('shows the original error message', async () => {
      render(<ClientRoot>loaded</ClientRoot>);
      await waitFor(() =>
        expect(screen.getByText('Failed to load. No session Found!')).toBeInTheDocument()
      );
    });

    it('calls window.location.reload() when "Reload" is clicked', async () => {
      render(<ClientRoot>loaded</ClientRoot>);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
      );

      fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

      expect(reloadSpy).toHaveBeenCalledOnce();
    });
  });
});
