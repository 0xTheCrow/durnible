import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { ScreenSize, ScreenSizeProvider } from '../../../hooks/useScreenSize';
import { SpaceRoomDrawer } from './SpaceRoomDrawer';

// Mock Space — deep dependency tree, not what we're testing
vi.mock('./Space', () => ({
  Space: ({ isDrawerMode }: { isDrawerMode?: boolean }) => (
    <div data-testid="space-nav">{isDrawerMode ? 'drawer' : 'full'}</div>
  ),
}));

// Mock SwipeDrawer to always render children so we can detect the drawer branch
vi.mock('../../../components/swipe-drawer', () => ({
  SwipeDrawer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="swipe-drawer">{children}</div>
  ),
}));

function renderDrawer(opts: {
  screenSize: ScreenSize;
  route: string;
}) {
  return render(
    <MemoryRouter initialEntries={[opts.route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScreenSizeProvider value={opts.screenSize}>
        <Routes>
          <Route
            path="/:spaceIdOrAlias/*"
            element={
              <SpaceRoomDrawer>
                <div data-testid="children">Room Content</div>
              </SpaceRoomDrawer>
            }
          />
        </Routes>
      </ScreenSizeProvider>
    </MemoryRouter>
  );
}

describe('SpaceRoomDrawer', () => {
  it('renders only children on desktop (no drawer)', () => {
    renderDrawer({
      screenSize: ScreenSize.Desktop,
      route: '/!space:example.com/!room:example.com',
    });
    expect(screen.getByTestId('children')).toBeInTheDocument();
    expect(screen.queryByTestId('swipe-drawer')).not.toBeInTheDocument();
  });

  it('renders only children at space root on mobile (no drawer)', () => {
    renderDrawer({
      screenSize: ScreenSize.Mobile,
      route: '/!space:example.com/',
    });
    expect(screen.getByTestId('children')).toBeInTheDocument();
    expect(screen.queryByTestId('swipe-drawer')).not.toBeInTheDocument();
  });

  it('renders drawer with Space on mobile inside a room', () => {
    renderDrawer({
      screenSize: ScreenSize.Mobile,
      route: '/!space:example.com/!room:example.com',
    });
    expect(screen.getByTestId('children')).toBeInTheDocument();
    expect(screen.getByTestId('swipe-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('space-nav')).toBeInTheDocument();
    expect(screen.getByTestId('space-nav')).toHaveTextContent('drawer');
  });

  it('renders drawer with Space on tablet inside a room', () => {
    renderDrawer({
      screenSize: ScreenSize.Tablet,
      route: '/!space:example.com/!room:example.com',
    });
    expect(screen.getByTestId('children')).toBeInTheDocument();
    expect(screen.getByTestId('swipe-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('space-nav')).toHaveTextContent('drawer');
  });
});
