import type { OnBeforeSendHeadersListenerDetails, Session } from 'electron';
import { getMediaAuthorizationRequestHeaders } from './mediaAuth.cjs';

const YOUTUBE_EMBED_HOST_SUFFIX = '.youtube-nocookie.com';

const REQUEST_HEADER_URL_FILTER = {
  urls: ['*://*/_matrix/client/v1/media/*', '*://*.youtube-nocookie.com/embed/*'],
};

const checkHasRefererHeader = (requestHeaders: Record<string, string>): boolean =>
  Object.keys(requestHeaders).some((headerName) => headerName.toLowerCase() === 'referer');

const getYouTubeEmbedRefererHeader = (
  details: OnBeforeSendHeadersListenerDetails
): Record<string, string> => {
  if (details.resourceType !== 'subFrame') return {};
  if (checkHasRefererHeader(details.requestHeaders)) return {};

  let parsedRequestUrl: URL;
  try {
    parsedRequestUrl = new URL(details.url);
  } catch {
    return {};
  }

  if (
    !parsedRequestUrl.hostname.endsWith(YOUTUBE_EMBED_HOST_SUFFIX) ||
    !parsedRequestUrl.pathname.startsWith('/embed/')
  ) {
    return {};
  }

  return { Referer: `${parsedRequestUrl.origin}/` };
};

export const installRequestHeaders = (targetSession: Session): void => {
  targetSession.webRequest.onBeforeSendHeaders(REQUEST_HEADER_URL_FILTER, (details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        ...getMediaAuthorizationRequestHeaders(details),
        ...getYouTubeEmbedRefererHeader(details),
      },
    });
  });
};
