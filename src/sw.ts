/// <reference lib="WebWorker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

export type {};
declare const self: ServiceWorkerGlobalScope;

// Precache all assets built by Vite (injected by vite-plugin-pwa at build time).
// This ensures lazy-loaded chunks survive deploys.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Token pushed proactively by the main page on every load (including hard refresh).
// Used as fallback when the requesting client is uncontrolled (i.e. clients.get() fails).
let storedToken: string | undefined;

async function askForAccessToken(client: Client): Promise<string | undefined> {
  return new Promise((resolve) => {
    const responseKey = Math.random().toString(36);
    const listener = (event: ExtendableMessageEvent) => {
      if (event.data.responseKey !== responseKey) return;
      resolve(event.data.token);
      self.removeEventListener('message', listener);
    };
    self.addEventListener('message', listener);
    client.postMessage({ responseKey, type: 'token' });
  });
}

function fetchConfig(token?: string): RequestInit | undefined {
  if (!token) return undefined;

  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'default',
  };
}

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'setToken') {
    storedToken = event.data.token;
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const { url, method } = event.request;
  if (method !== 'GET') return;
  if (
    !url.includes('/_matrix/client/v1/media/download') &&
    !url.includes('/_matrix/client/v1/media/thumbnail')
  ) {
    return;
  }
  event.respondWith(
    (async (): Promise<Response> => {
      const client = await self.clients.get(event.clientId);
      let token: string | undefined;
      if (client) {
        // Controlled client: ask for the live token and keep storedToken up to date.
        token = await askForAccessToken(client);
        storedToken = token;
      } else {
        // Uncontrolled client (e.g. hard refresh): the bidirectional message channel
        // between SW and page is unreliable, so use the token pushed by the page via
        // the 'setToken' message sent from navigator.serviceWorker.ready.then().
        token = storedToken;
      }

      return fetch(url, fetchConfig(token));
    })()
  );
});
