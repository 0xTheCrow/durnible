import type { ReactNode } from 'react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { MatrixClient } from 'matrix-js-sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ClientConfig } from '../app/hooks/useClientConfig';
import { ClientConfigProvider } from '../app/hooks/useClientConfig';
import { ScreenSize, ScreenSizeProvider } from '../app/hooks/useScreenSize';
import { MatrixClientProvider } from '../app/hooks/useMatrixClient';
import { SpecVersionsProvider } from '../app/hooks/useSpecVersions';
import { createMockMatrixClient } from './mocks';

const DEFAULT_CLIENT_CONFIG: ClientConfig = {
  defaultHomeserver: 0,
  homeserverList: ['matrix.org'],
  allowCustomHomeservers: true,
};

const DEFAULT_SPEC_VERSIONS = {
  versions: ['v1.11'],
};

type TestWrapperProps = {
  children: ReactNode;
  route?: string;
  clientConfig?: ClientConfig;
  screenSize?: ScreenSize;
};

export function TestWrapper({
  children,
  route = '/',
  clientConfig = DEFAULT_CLIENT_CONFIG,
  screenSize = ScreenSize.Desktop,
}: TestWrapperProps) {
  const queryClient = React.useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    []
  );
  return (
    <MemoryRouter
      initialEntries={[route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <ScreenSizeProvider value={screenSize}>
        <ClientConfigProvider value={clientConfig}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </ClientConfigProvider>
      </ScreenSizeProvider>
    </MemoryRouter>
  );
}

type MatrixTestWrapperProps = TestWrapperProps & {
  matrixClient?: Partial<MatrixClient>;
};

export function MatrixTestWrapper({ children, matrixClient, ...rest }: MatrixTestWrapperProps) {
  const mx = matrixClient ?? createMockMatrixClient();
  return (
    <TestWrapper {...rest}>
      <SpecVersionsProvider value={DEFAULT_SPEC_VERSIONS}>
        <MatrixClientProvider value={mx as MatrixClient}>{children}</MatrixClientProvider>
      </SpecVersionsProvider>
    </TestWrapper>
  );
}
