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
import { getSettings } from './app/state/settings';
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

  navigator.serviceWorker.register(swUrl).then((reg) => {
    // Check for SW updates periodically (every 30 minutes)
    setInterval(() => reg.update(), 30 * 60 * 1000);

    const promptUpdate = (waitingSW: ServiceWorker) => {
      if (!getSettings().pwaMode) return;
      // Remove any existing toast
      document.getElementById('sw-update-toast')?.remove();

      const toast = document.createElement('div');
      toast.id = 'sw-update-toast';
      Object.assign(toast.style, {
        position: 'fixed',
        top: '4.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '0.75rem',
        background: '#1a1a1a',
        color: '#fff',
        fontSize: '0.875rem',
        fontFamily: 'inherit',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        minWidth: '24rem',
        maxWidth: 'calc(100vw - 2rem)',
      });

      const content = document.createElement('div');
      Object.assign(content.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      });

      const style = document.createElement('style');
      style.textContent = `@keyframes sw-toast-progress { from { width: 100%; } to { width: 0%; } }`;
      toast.appendChild(style);

      const progressBar = document.createElement('div');
      Object.assign(progressBar.style, {
        height: '3px',
        background: '#3b82f6',
        animation: 'sw-toast-progress 20s linear forwards',
      });

      const msg = document.createElement('span');
      msg.textContent = 'A new version is available';
      msg.style.flexGrow = '1';
      msg.style.padding = '0.75rem 0 0.75rem 1.25rem';

      const btn = document.createElement('button');
      btn.textContent = 'Update';
      Object.assign(btn.style, {
        padding: '0.375rem 0.75rem',
        borderRadius: '0.5rem',
        border: 'none',
        background: '#3b82f6',
        color: '#fff',
        fontSize: '0.875rem',
        fontWeight: '500',
        cursor: 'pointer',
      });
      btn.addEventListener('click', () => {
        waitingSW.postMessage({ type: 'SKIP_WAITING' });
        toast.remove();
      });

      const dismiss = document.createElement('button');
      dismiss.textContent = '\u00d7';
      Object.assign(dismiss.style, {
        background: 'none',
        border: 'none',
        borderLeft: '1px solid #333',
        color: '#999',
        fontSize: '1.25rem',
        cursor: 'pointer',
        padding: '0.75rem 1.25rem',
        lineHeight: '1',
      });
      dismiss.addEventListener('click', () => toast.remove());

      content.append(msg, btn, dismiss);
      toast.append(content, progressBar);
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 20000);
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
  // Tracks the natural (no-keyboard) height for the current orientation.
  // Some browsers (e.g. Brave) resize both vv.height and window.innerHeight
  // equally when the keyboard opens, so vv.height < window.innerHeight is
  // never true. Comparing against maxSeenHeight catches that case.
  let maxSeenHeight = vv.height;
  const update = () => {
    if (vv.height > maxSeenHeight) maxSeenHeight = vv.height;
    if (vv.height < window.innerHeight || vv.height < maxSeenHeight) {
      document.documentElement.style.setProperty('--app-height', `${vv.height}px`);
    } else {
      document.documentElement.style.removeProperty('--app-height');
    }
  };
  update();
  vv.addEventListener('resize', update);
  // Zero out maxSeenHeight on orientation change so the next vv resize
  // recalibrates it to the new orientation's natural height.
  screen.orientation?.addEventListener('change', () => {
    maxSeenHeight = 0;
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
