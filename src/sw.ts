/// <reference lib="WebWorker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { CacheExpiration } from 'workbox-expiration';
import type { MediaCacheBucket } from './app/utils/mediaCache';
import {
  MEDIA_CACHE_PREFIX,
  MEDIA_CACHE_BUCKETS,
  getCachedMediaTarget,
} from './app/utils/mediaCache';

export type {};
declare const self: ServiceWorkerGlobalScope;

const expirationByBucket = new Map<MediaCacheBucket, CacheExpiration>();
const getExpiration = (bucket: MediaCacheBucket): CacheExpiration => {
  let expiration = expirationByBucket.get(bucket);
  if (!expiration) {
    expiration = new CacheExpiration(MEDIA_CACHE_BUCKETS[bucket].cacheName, {
      maxEntries: MEDIA_CACHE_BUCKETS[bucket].maxEntries,
    });
    expirationByBucket.set(bucket, expiration);
  }
  return expiration;
};

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

async function getAccessToken(event: FetchEvent): Promise<string | undefined> {
  const client = await self.clients.get(event.clientId);
  if (client) {
    // Controlled client: ask for the live token and keep storedToken up to date.
    const token = await askForAccessToken(client);
    storedToken = token;
    return token;
  }
  // Uncontrolled client (e.g. hard refresh): the bidirectional message channel
  // between SW and page is unreliable, so use the token pushed by the page via
  // the 'setToken' message sent from navigator.serviceWorker.ready.then().
  return storedToken;
}

async function handleCachedMedia(
  event: FetchEvent,
  target: { cacheKey: string; bucket: MediaCacheBucket }
): Promise<Response> {
  const { cacheKey, bucket } = target;
  const expiration = getExpiration(bucket);
  const cache = await caches.open(MEDIA_CACHE_BUCKETS[bucket].cacheName);
  const cached = await cache.match(cacheKey);
  if (cached) {
    event.waitUntil(expiration.updateTimestamp(cacheKey).then(() => expiration.expireEntries()));
    return cached;
  }

  const token = await getAccessToken(event);
  const response = await fetch(cacheKey, fetchConfig(token));
  // cache.put() rejects on redirected responses (e.g. CDN-backed media), so skip those.
  if (response.ok && !response.redirected) {
    try {
      await cache.put(cacheKey, response.clone());
      event.waitUntil(expiration.updateTimestamp(cacheKey).then(() => expiration.expireEntries()));
    } catch {
      // Caching is best-effort; a write failure must not break image loading.
    }
  }
  return response;
}

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const currentNames = Object.values(MEDIA_CACHE_BUCKETS).map((bucket) => bucket.cacheName);
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith(MEDIA_CACHE_PREFIX) && !currentNames.includes(name))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
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

  const cachedMediaTarget = getCachedMediaTarget(url);
  if (cachedMediaTarget) {
    event.respondWith(handleCachedMedia(event, cachedMediaTarget));
    return;
  }

  if (
    !url.includes('/_matrix/client/v1/media/download') &&
    !url.includes('/_matrix/client/v1/media/thumbnail')
  ) {
    return;
  }
  event.respondWith(
    (async (): Promise<Response> => {
      const token = await getAccessToken(event);
      return fetch(url, fetchConfig(token));
    })()
  );
});
