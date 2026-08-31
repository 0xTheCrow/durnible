import type { OnBeforeSendHeadersListenerDetails, Session } from 'electron';

const RENDERER_ORIGIN = 'app://durnible';

const AUTHENTICATED_MEDIA_PATH_PREFIXES = [
  '/_matrix/client/v1/media/download/',
  '/_matrix/client/v1/media/thumbnail/',
];

const MEDIA_REQUEST_URL_FILTER = { urls: ['*://*/_matrix/client/v1/media/*'] };

const MAX_ACCESS_TOKEN_LENGTH = 8192;

let homeserverMediaOrigin: string | null = null;
let homeserverAccessToken: string | null = null;

const isLoopbackHost = (hostname: string): boolean =>
  hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]';

export const setMediaAuth = (homeserverBaseUrl: unknown, accessToken: unknown): void => {
  homeserverMediaOrigin = null;
  homeserverAccessToken = null;

  if (
    typeof homeserverBaseUrl !== 'string' ||
    typeof accessToken !== 'string' ||
    accessToken.length === 0 ||
    accessToken.length > MAX_ACCESS_TOKEN_LENGTH
  ) {
    return;
  }

  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(homeserverBaseUrl);
  } catch {
    return;
  }

  const isSecureTransport =
    parsedBaseUrl.protocol === 'https:' ||
    (parsedBaseUrl.protocol === 'http:' && isLoopbackHost(parsedBaseUrl.hostname));
  if (!isSecureTransport) {
    return;
  }

  homeserverMediaOrigin = parsedBaseUrl.origin;
  homeserverAccessToken = accessToken;
};

const checkIsHomeserverMediaRequest = (requestUrl: string): boolean => {
  if (!homeserverMediaOrigin || !homeserverAccessToken) return false;

  let parsedRequestUrl: URL;
  try {
    parsedRequestUrl = new URL(requestUrl);
  } catch {
    return false;
  }

  if (parsedRequestUrl.origin !== homeserverMediaOrigin) return false;

  return AUTHENTICATED_MEDIA_PATH_PREFIXES.some((prefix) =>
    parsedRequestUrl.pathname.startsWith(prefix)
  );
};

export const getMediaAuthorizationRequestHeaders = (
  details: OnBeforeSendHeadersListenerDetails
): Record<string, string> => {
  if (
    details.method !== 'GET' ||
    !homeserverAccessToken ||
    !checkIsHomeserverMediaRequest(details.url)
  ) {
    return {};
  }
  return { Authorization: `Bearer ${homeserverAccessToken}` };
};

export const installMediaAuthResponseHeaders = (targetSession: Session): void => {
  targetSession.webRequest.onHeadersReceived(MEDIA_REQUEST_URL_FILTER, (details, callback) => {
    if (!checkIsHomeserverMediaRequest(details.url)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }

    const responseHeaders = { ...details.responseHeaders };
    Object.keys(responseHeaders)
      .filter((headerName) => headerName.toLowerCase() === 'access-control-allow-origin')
      .forEach((headerName) => delete responseHeaders[headerName]);
    responseHeaders['Access-Control-Allow-Origin'] = [RENDERER_ORIGIN];

    callback({ responseHeaders });
  });
};
