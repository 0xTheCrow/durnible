/// <reference lib="WebWorker" />

export type {};
declare const self: ServiceWorkerGlobalScope;

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
  event.waitUntil(clients.claim());
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
      // clients.get() only returns controlled clients.
      // On hard refresh the page bypasses the SW for the navigation request, leaving it
      // uncontrolled — so clients.get() returns undefined even though the client exists.
      // Fall back to matchAll with includeUncontrolled to find it by ID.
      let client: Client | undefined = await self.clients.get(event.clientId);
      if (!client && event.clientId) {
        const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        client = all.find((c) => c.id === event.clientId);
      }

      let token: string | undefined;
      if (client) token = await askForAccessToken(client);

      return fetch(url, fetchConfig(token));
    })()
  );
});
