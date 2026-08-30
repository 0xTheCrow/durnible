/* eslint-disable import/first */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { enableMapSet } from 'immer';
import '@fontsource/inter/variable.css';
import { configClass, varsClass } from 'folds';

enableMapSet();

import './index.css';

import { trimTrailingSlash } from './app/utils/common';
import { getSettings } from './app/state/settings';
import { isIOS, mobileOrTablet } from './app/utils/user-agent';
import {
  checkIsDesktopApp,
  restartDesktopAppForUpdate,
  subscribeDesktopAppUpdateStatus,
  syncDesktopMediaAuth,
} from './app/platform/desktop';
import { showUpdateToast } from './app/utils/updateToast';
import App from './app/pages/App';

document.body.classList.add(configClass, varsClass);

syncDesktopMediaAuth();

subscribeDesktopAppUpdateStatus((status) => {
  if (status.availability === 'ready-to-install') {
    showUpdateToast({
      message: `Durnible ${status.version} is ready to install`,
      actionLabel: 'Restart',
      onAction: restartDesktopAppForUpdate,
    });
    return;
  }
  showUpdateToast({
    message: `Durnible ${status.version} is available`,
    actionLabel: 'Download',
    onAction: () => window.open(status.releaseUrl),
  });
});

if ('serviceWorker' in navigator && !checkIsDesktopApp()) {
  const swUrl =
    import.meta.env.MODE === 'production'
      ? `${trimTrailingSlash(import.meta.env.BASE_URL)}/sw.js`
      : `/dev-sw.js?dev-sw`;

  navigator.serviceWorker.register(swUrl).then((reg) => {
    // Check for SW updates periodically (every 30 minutes)
    setInterval(() => reg.update(), 30 * 60 * 1000);

    const promptUpdate = (waitingSW: ServiceWorker) => {
      if (!getSettings().pwaMode) return;
      showUpdateToast({
        message: 'A new version is available',
        actionLabel: 'Update',
        onAction: () => waitingSW.postMessage({ type: 'SKIP_WAITING' }),
      });
    };

    // A new SW is already waiting (e.g. installed while the page was idle)
    if (reg.waiting) {
      promptUpdate(reg.waiting);
    }

    // A new SW has been installed and is waiting to activate
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          promptUpdate(newSW);
        }
      });
    });
  });

  // Reload the page when the new SW takes over (but not on first registration)
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    window.location.reload();
  });

  // On mobile PWAs, pages are frozen in bfcache when backgrounded. The controllerchange
  // event fires while the page is frozen and the reload above may never execute.
  // When the page is restored from bfcache, check if the SW controller changed and
  // reload so the page gets fresh HTML with the correct asset hashes.
  const initialController = navigator.serviceWorker.controller;
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && navigator.serviceWorker.controller !== initialController) {
      window.location.reload();
    }
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'token' && event.data?.responseKey && event.source) {
      // Get the token for SW.
      const token = localStorage.getItem('cinny_access_token') ?? undefined;
      event.source.postMessage({
        responseKey: event.data.responseKey,
        token,
      });
    }
  });

  // Proactively push the auth token to the SW so it is available for uncontrolled
  // pages (e.g. hard refresh) where the SW cannot ask the client for the token because
  // the client↔SW message channel may not be bidirectional for uncontrolled clients.
  navigator.serviceWorker.ready.then((reg) => {
    const token = localStorage.getItem('cinny_access_token');
    if (token) reg.active?.postMessage({ type: 'setToken', token });
  });
}

const setupVirtualKeyboard = () => {
  if (!mobileOrTablet()) return;
  const isBrave = (navigator as unknown as { brave?: unknown }).brave !== undefined;
  const isIOSDevice = isIOS();
  const visualViewport = window.visualViewport;
  if (!visualViewport) return;
  let visualViewportHeight = visualViewport.height;
  const update = () => {
    if (visualViewport.height > visualViewportHeight) visualViewportHeight = visualViewport.height;
    if (isIOSDevice) {
      document.documentElement.style.removeProperty('--app-height');
      return;
    }
    const keyboardOpen =
      visualViewport.height < window.innerHeight || visualViewport.height < visualViewportHeight;
    if (keyboardOpen) {
      if (isBrave || visualViewport.height === window.innerHeight) {
        document.documentElement.style.removeProperty('--app-height');
      } else {
        document.documentElement.style.setProperty('--app-height', `${visualViewport.height}px`);
      }
    } else {
      document.documentElement.style.removeProperty('--app-height');
    }
  };
  update();
  visualViewport.addEventListener('resize', update);
  window.screen.orientation?.addEventListener('change', () => {
    visualViewportHeight = 0;
  });
};

setupVirtualKeyboard();

const mountApp = () => {
  const rootContainer = document.getElementById('root');

  if (rootContainer === null) {
    console.error('Root container element not found!');
    return;
  }

  const root = createRoot(rootContainer);
  root.render(<App />);
};

mountApp();
