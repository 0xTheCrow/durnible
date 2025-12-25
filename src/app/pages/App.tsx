import React, { useContext, useEffect } from 'react';
import { Provider as JotaiProvider, useAtomValue } from 'jotai';
import { OverlayContainerProvider, PopOutContainerProvider, TooltipContainerProvider } from 'folds';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { ClientConfigLoader } from '../components/ClientConfigLoader';
import { ClientConfigProvider } from '../hooks/useClientConfig';
import { ConfigConfigError, ConfigConfigLoading } from './ConfigConfig';
import { FeatureCheck } from './FeatureCheck';
import { createRouter } from './Router';
import { ScreenSizeProvider, useScreenSize } from '../hooks/useScreenSize';
import { useCompositionEndTracking } from '../hooks/useComposingCheck';

import { Provider as InternationalizationProvider, context } from '../internationalization';
import { getSettings, settingsAtom } from '../state/settings';

const queryClient = new QueryClient();

function LanguageSync() {
  const settings = useAtomValue(settingsAtom);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const [, setLanguages] = useContext(context)!;

  useEffect(() => {
    if (settings.languageTag) {
      setLanguages([settings.languageTag]);
    }
  }, [settings.languageTag, setLanguages]);

  return null;
}

function AppContent() {
  const screenSize = useScreenSize();
  useCompositionEndTracking();

  const portalContainer = document.getElementById('portalContainer') ?? undefined;

  return (
    <TooltipContainerProvider value={portalContainer}>
      <PopOutContainerProvider value={portalContainer}>
        <OverlayContainerProvider value={portalContainer}>
          <ScreenSizeProvider value={screenSize}>
            <FeatureCheck>
              <ClientConfigLoader
                fallback={() => <ConfigConfigLoading />}
                error={(err, retry, ignore) => (
                  <ConfigConfigError error={err} retry={retry} ignore={ignore} />
                )}
              >
                {(clientConfig) => (
                  <ClientConfigProvider value={clientConfig}>
                    <QueryClientProvider client={queryClient}>
                      <JotaiProvider>
                        <LanguageSync />
                        <RouterProvider router={createRouter(clientConfig, screenSize)} />
                      </JotaiProvider>
                      <ReactQueryDevtools initialIsOpen={false} />
                    </QueryClientProvider>
                  </ClientConfigProvider>
                )}
              </ClientConfigLoader>
            </FeatureCheck>
          </ScreenSizeProvider>
        </OverlayContainerProvider>
      </PopOutContainerProvider>
    </TooltipContainerProvider>
  );
}

function App() {
  const initialSettings = getSettings();
  const initialLanguageTags = initialSettings.languageTag ? [initialSettings.languageTag] : undefined;

  return (
    <InternationalizationProvider tags={initialLanguageTags}>
      <AppContent />
    </InternationalizationProvider>
  );
}

export default App;
