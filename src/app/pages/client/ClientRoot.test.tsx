import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MatrixClient } from 'matrix-js-sdk';
import { ClientRoot, isChunkLoadError } from './ClientRoot';
import { initClient } from '../../../client/initMatrix';
import { getFallbackSession } from '../../state/sessions';
import { checkSessionLockFree, getSessionLock } from '../../utils/sessionLock';

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

vi.mock('../../utils/sessionLock', () => ({
  checkSessionLockFree: vi.fn(() => true),
  getSessionLock: vi.fn(async () => true),
}));

const mockInitClient = vi.mocked(initClient);
const mockGetFallbackSession = vi.mocked(getFallbackSession);
const mockCheckSessionLockFree = vi.mocked(checkSessionLockFree);
const mockGetSessionLock = vi.mocked(getSessionLock);

const MOCK_SESSION = {
  baseUrl: 'https://matrix.example.com',
  userId: '@user:example.com',
  deviceId: 'DEVICE123',
  accessToken: 'token123',
  homeserver: 'example.com',
};

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

const CHUNK_ERROR = new Error(
  'Failed to fetch dynamically imported module: https://app.example.com/assets/index-D882sB8o.js'
);
const GENERIC_ERROR = new Error('No session Found!');

describe('ClientRoot error dialog', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadSpy },
    });
    mockGetFallbackSession.mockReturnValue(MOCK_SESSION as ReturnType<typeof getFallbackSession>);
    // ClientRoot logs failed loads via console.error; these tests intentionally
    // reject initClient, so silence the expected noise.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('when initClient fails with a chunk load error', () => {
    beforeEach(() => {
      mockInitClient.mockRejectedValue(CHUNK_ERROR);
    });

    it('shows a chunk-load error message with a reload action', async () => {
      render(<ClientRoot>loaded</ClientRoot>);
      await waitFor(() =>
        expect(screen.getByTestId('client-root-load-error-chunk')).toBeInTheDocument()
      );
      expect(screen.queryByTestId('client-root-load-error-generic')).not.toBeInTheDocument();
      expect(screen.getByTestId('client-root-error-action')).toHaveAttribute(
        'data-variant',
        'reload'
      );
    });

    it('keeps the raw module URL out of the user-facing error text', async () => {
      render(<ClientRoot>loaded</ClientRoot>);
      await waitFor(() =>
        expect(screen.getByTestId('client-root-load-error-chunk')).toBeInTheDocument()
      );
      expect(screen.getByTestId('client-root-error-dialog').textContent).not.toMatch(
        /index-D882sB8o/
      );
    });

    it('calls window.location.reload() when the action button is clicked', async () => {
      render(<ClientRoot>loaded</ClientRoot>);
      await waitFor(() =>
        expect(screen.getByTestId('client-root-error-action')).toBeInTheDocument()
      );

      fireEvent.click(screen.getByTestId('client-root-error-action'));

      expect(reloadSpy).toHaveBeenCalledOnce();
    });
  });

  describe('when initClient fails with a non-chunk error', () => {
    beforeEach(() => {
      mockInitClient.mockRejectedValue(GENERIC_ERROR);
    });

    it('renders a reload action for all load failures', async () => {
      render(<ClientRoot>loaded</ClientRoot>);
      await waitFor(() =>
        expect(screen.getByTestId('client-root-error-action')).toHaveAttribute(
          'data-variant',
          'reload'
        )
      );
    });

    it('surfaces the original error message to the user', async () => {
      render(<ClientRoot>loaded</ClientRoot>);
      await waitFor(() =>
        expect(screen.getByTestId('client-root-load-error-generic')).toHaveTextContent(
          GENERIC_ERROR.message
        )
      );
    });

    it('calls window.location.reload() when the action button is clicked', async () => {
      render(<ClientRoot>loaded</ClientRoot>);
      await waitFor(() =>
        expect(screen.getByTestId('client-root-error-action')).toBeInTheDocument()
      );

      fireEvent.click(screen.getByTestId('client-root-error-action'));

      expect(reloadSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('ClientRoot single-tab session lock', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockGetFallbackSession.mockReturnValue(MOCK_SESSION as ReturnType<typeof getFallbackSession>);
    mockCheckSessionLockFree.mockReset().mockReturnValue(true);
    mockGetSessionLock.mockReset().mockResolvedValue(true);
    mockInitClient.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('shows the takeover-confirm view and defers initClient until confirmed', async () => {
    mockCheckSessionLockFree.mockReturnValue(false);
    mockInitClient.mockImplementation(() => new Promise<MatrixClient>(() => {}));

    render(<ClientRoot>loaded</ClientRoot>);

    expect(await screen.findByTestId('client-root-takeover-confirm')).toBeInTheDocument();
    expect(mockInitClient).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('client-root-takeover-confirm-action'));

    await waitFor(() => expect(mockInitClient).toHaveBeenCalledTimes(1));
  });

  it('stops the client and shows the other-tab view when the lock is taken over', async () => {
    const fakeMx = {
      on: vi.fn(),
      removeListener: vi.fn(),
      stopClient: vi.fn(),
      clientRunning: false,
    };
    let capturedOnNewInstance: (() => void | Promise<void>) | undefined;
    mockGetSessionLock.mockImplementation(async (onNewInstance) => {
      capturedOnNewInstance = onNewInstance;
      return true;
    });
    mockInitClient.mockResolvedValue(fakeMx as unknown as MatrixClient);

    render(<ClientRoot>loaded</ClientRoot>);

    // mx is mounted (its listeners are bound) once initClient resolves and mxRef is set.
    await waitFor(() => expect(fakeMx.on).toHaveBeenCalled());

    await act(async () => {
      await capturedOnNewInstance!();
    });

    expect(await screen.findByTestId('client-root-other-tab-active')).toBeInTheDocument();
    expect(fakeMx.stopClient).toHaveBeenCalledTimes(1);
  });
});
