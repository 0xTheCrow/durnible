import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import type { Room } from 'matrix-js-sdk';
import { ScreenSize, ScreenSizeProvider } from '../../hooks/useScreenSize';
import { SpaceProvider } from '../../hooks/useSpace';
import { RoomDrawer } from './RoomDrawer';

vi.mock('./space', () => ({
  Space: ({ isDrawerMode }: { isDrawerMode?: boolean }) => (
    <div data-testid="space-nav">{isDrawerMode ? 'drawer' : 'full'}</div>
  ),
}));

vi.mock('../../components/swipe-drawer', () => ({
  SwipeDrawer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="swipe-drawer">{children}</div>
  ),
}));

vi.mock('./direct/Direct', () => ({
  Direct: () => <div data-testid="direct-nav" />,
}));

vi.mock('./home/Home', () => ({
  Home: () => <div data-testid="home-nav" />,
}));

vi.mock('../../hooks/useMatrixClient', () => ({
  useMatrixClient: () => ({}),
}));

vi.mock('../../hooks/useFavoriteRooms', () => ({
  useFavoriteRooms: vi.fn().mockReturnValue([]),
}));

vi.mock('../../hooks/useRoomsNotificationPreferences', () => ({
  useRoomsNotificationPreferencesContext: () => ({}),
  getRoomNotificationMode: () => undefined,
}));

const mockSpace = { roomId: '!space:example.com' } as Room;

function renderDrawer(opts: { screenSize: ScreenSize; route: string; space?: Room | null }) {
  return render(
    <MemoryRouter
      initialEntries={[opts.route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <ScreenSizeProvider value={opts.screenSize}>
        <SpaceProvider value={opts.space ?? null}>
          <Routes>
            <Route
              path="/:idOrAlias/*"
              element={
                <RoomDrawer>
                  <div data-testid="children">Room Content</div>
                </RoomDrawer>
              }
            />
          </Routes>
        </SpaceProvider>
      </ScreenSizeProvider>
    </MemoryRouter>
  );
}

describe('RoomDrawer', () => {
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
      space: mockSpace,
    });
    expect(screen.getByTestId('children')).toBeInTheDocument();
    expect(screen.queryByTestId('swipe-drawer')).not.toBeInTheDocument();
  });

  it('renders drawer with Space nav on mobile inside a space room', () => {
    renderDrawer({
      screenSize: ScreenSize.Mobile,
      route: '/!space:example.com/!room:example.com',
      space: mockSpace,
    });
    expect(screen.getByTestId('children')).toBeInTheDocument();
    expect(screen.getByTestId('swipe-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('space-nav')).toHaveTextContent('drawer');
  });

  it('renders drawer with Space nav on tablet inside a space room', () => {
    renderDrawer({
      screenSize: ScreenSize.Tablet,
      route: '/!space:example.com/!room:example.com',
      space: mockSpace,
    });
    expect(screen.getByTestId('swipe-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('space-nav')).toHaveTextContent('drawer');
  });

  it('renders drawer without Space nav on mobile outside a space', () => {
    renderDrawer({ screenSize: ScreenSize.Mobile, route: '/!room:example.com/' });
    expect(screen.getByTestId('children')).toBeInTheDocument();
    expect(screen.getByTestId('swipe-drawer')).toBeInTheDocument();
    expect(screen.queryByTestId('space-nav')).not.toBeInTheDocument();
  });
});
