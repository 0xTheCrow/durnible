/* eslint-disable import/first */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { enableMapSet } from 'immer';
import '@fontsource/inter/variable.css';
import 'folds/dist/style.css';
import { configClass, varsClass } from 'folds';

enableMapSet();

import './index.css';

import { trimTrailingSlash } from './app/utils/common';
import { mobileOrTablet } from './app/utils/user-agent';
import App from './app/pages/App';

// import i18n (needs to be bundled ;))
import './app/i18n';

document.body.classList.add(configClass, varsClass);

// Register Service Worker
if ('serviceWorker' in navigator) {
  const swUrl =
    import.meta.env.MODE === 'production'
      ? `${trimTrailingSlash(import.meta.env.BASE_URL)}/sw.js`
      : `/dev-sw.js?dev-sw`;

  navigator.serviceWorker.register(swUrl);
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'token' && event.data?.responseKey) {
      // Get the token for SW.
      const token = localStorage.getItem('cinny_access_token') ?? undefined;
      event.source!.postMessage({
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
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    if (vv.height < window.innerHeight) {
      document.documentElement.style.setProperty('--app-height', `${vv.height}px`);
    } else {
      document.documentElement.style.removeProperty('--app-height');
    }
  };
  update();
  vv.addEventListener('resize', update);
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
