import type { MatrixClient } from 'matrix-js-sdk';

export const GIF_SERVER_URL = import.meta.env.VITE_GIF_SERVER_URL || '';
export const gifServerEnabled = !!GIF_SERVER_URL;
export const GIF_MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

export type GifRendition = {
  url: string;
  width: number;
  height: number;
  size_bytes: number;
};

export type GifRenditions = {
  original: GifRendition;
  preview: GifRendition;
  thumbnail: GifRendition;
};

export type GifVisibility = 'shared' | 'private';

export type GifItem = {
  id: string;
  filename: string;
  uploader_id: string;
  visibility: GifVisibility;
  is_nsfw: boolean;
  tags: string[];
  frame_count: number;
  duration_ms: number;
  uses: number;
  uploaded_at: string;
  renditions: GifRenditions;
};

export type GifListResponse = {
  results: GifItem[];
  next: string | null;
};

export class GifAuthError extends Error {}

let gifClient: MatrixClient | null = null;

export function setGifServerClient(mx: MatrixClient | null): void {
  gifClient = mx;
}

const EXPIRY_SKEW_MS = 60_000;
let sessionToken: string | null = null;
let sessionExpiresAt = 0;
let sessionIsAdmin = false;
let mintPromise: Promise<string> | null = null;

function clearGifSession(): void {
  sessionToken = null;
  sessionExpiresAt = 0;
}

async function mintSession(): Promise<string> {
  if (!gifClient) throw new GifAuthError('Matrix client unavailable');
  let openIdToken;
  try {
    openIdToken = await gifClient.getOpenIdToken();
  } catch (e) {
    throw new GifAuthError(`failed to obtain Matrix OpenID token: ${e}`);
  }
  const res = await fetch(`${GIF_SERVER_URL}/auth/matrix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(openIdToken),
  });
  if (!res.ok) throw new GifAuthError(`GIF auth failed: ${res.status}`);
  const data = (await res.json()) as {
    token: string;
    expires_in: number;
    is_admin: boolean;
  };
  sessionToken = data.token;
  sessionExpiresAt = Date.now() + data.expires_in * 1000;
  sessionIsAdmin = data.is_admin;
  return data.token;
}

async function ensureSession(): Promise<string> {
  if (sessionToken && Date.now() < sessionExpiresAt - EXPIRY_SKEW_MS) {
    return sessionToken;
  }
  if (!mintPromise) {
    mintPromise = mintSession().finally(() => {
      mintPromise = null;
    });
  }
  return mintPromise;
}

async function gifFetch(url: string, options?: RequestInit, retry = true): Promise<Response> {
  const token = await ensureSession();
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (res.status === 401 && retry) {
    clearGifSession();
    return gifFetch(url, options, false);
  }
  return res;
}

export async function getGifAdminStatus(): Promise<boolean> {
  await ensureSession();
  return sessionIsAdmin;
}

function listUrl(
  path: string,
  limit: number,
  pos?: string,
  showNsfw?: boolean,
  showHidden?: boolean,
  mine?: boolean,
  random?: boolean
): string {
  const url = new URL(`${GIF_SERVER_URL}${path}`);
  url.searchParams.set('limit', String(limit));
  if (pos) url.searchParams.set('pos', pos);
  if (showNsfw) url.searchParams.set('grab_nsfw', 'true');
  if (showHidden) url.searchParams.set('grab_hidden', 'true');
  if (mine) url.searchParams.set('mine', 'true');
  if (random) url.searchParams.set('random', 'true');
  return url.toString();
}

export async function searchGifs(
  query: string,
  limit: number,
  pos?: string,
  showNsfw?: boolean,
  showHidden?: boolean
): Promise<GifListResponse> {
  const url = new URL(`${GIF_SERVER_URL}/gifs/search`);
  if (query) url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  if (pos) url.searchParams.set('pos', pos);
  if (showNsfw) url.searchParams.set('grab_nsfw', 'true');
  if (showHidden) url.searchParams.set('grab_hidden', 'true');
  const res = await gifFetch(url.toString());
  if (!res.ok) throw new Error(`GIF search failed: ${res.status}`);
  return res.json();
}

export async function getFeaturedGifs(
  limit: number,
  pos?: string,
  showNsfw?: boolean,
  showHidden?: boolean,
  random?: boolean
): Promise<GifListResponse> {
  const res = await gifFetch(
    listUrl('/gifs/featured', limit, pos, showNsfw, showHidden, false, random)
  );
  if (!res.ok) throw new Error(`GIF featured failed: ${res.status}`);
  return res.json();
}

export async function getFavoriteGifs(
  limit: number,
  pos?: string,
  showNsfw?: boolean,
  showHidden?: boolean
): Promise<GifListResponse> {
  const res = await gifFetch(listUrl('/gifs/favorites', limit, pos, showNsfw, showHidden));
  if (!res.ok) throw new Error(`GIF favorites failed: ${res.status}`);
  return res.json();
}

export async function getHistoryGifs(
  limit: number,
  pos?: string,
  showNsfw?: boolean,
  showHidden?: boolean
): Promise<GifListResponse> {
  const res = await gifFetch(listUrl('/gifs/history', limit, pos, showNsfw, showHidden));
  if (!res.ok) throw new Error(`GIF history failed: ${res.status}`);
  return res.json();
}

export async function getMyGifs(
  limit: number,
  pos?: string,
  showNsfw?: boolean,
  showHidden?: boolean
): Promise<GifListResponse> {
  const res = await gifFetch(listUrl('/gifs/recent', limit, pos, showNsfw, showHidden, true));
  if (!res.ok) throw new Error(`GIF mine failed: ${res.status}`);
  return res.json();
}

export async function getHiddenGifs(
  limit: number,
  pos?: string,
  showNsfw?: boolean
): Promise<GifListResponse> {
  const res = await gifFetch(listUrl('/gifs/hidden', limit, pos, showNsfw));
  if (!res.ok) throw new Error(`GIF hidden failed: ${res.status}`);
  return res.json();
}

export async function addFavorite(gifId: string): Promise<void> {
  const res = await gifFetch(`${GIF_SERVER_URL}/gifs/${gifId}/favorite`, { method: 'PUT' });
  if (!res.ok) throw new Error(`GIF favorite failed: ${res.status}`);
}

export async function removeFavorite(gifId: string): Promise<void> {
  const res = await gifFetch(`${GIF_SERVER_URL}/gifs/${gifId}/favorite`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`GIF unfavorite failed: ${res.status}`);
}

export async function addHidden(gifId: string): Promise<void> {
  const res = await gifFetch(`${GIF_SERVER_URL}/gifs/${gifId}/hide`, { method: 'PUT' });
  if (!res.ok) throw new Error(`GIF hide failed: ${res.status}`);
}

export async function removeHidden(gifId: string): Promise<void> {
  const res = await gifFetch(`${GIF_SERVER_URL}/gifs/${gifId}/hide`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`GIF unhide failed: ${res.status}`);
}

export type GifMetaPatch = {
  visibility?: GifVisibility;
  is_nsfw?: boolean;
};

export async function patchGifMeta(gifId: string, patch: GifMetaPatch): Promise<void> {
  const res = await gifFetch(`${GIF_SERVER_URL}/gifs/${gifId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`GIF update failed: ${res.status}`);
}

export async function replaceGifTags(gifId: string, tags: string[]): Promise<void> {
  const res = await gifFetch(`${GIF_SERVER_URL}/gifs/${gifId}/tags`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) throw new Error(`GIF tag update failed: ${res.status}`);
}

export async function deleteGif(gifId: string): Promise<void> {
  const res = await gifFetch(`${GIF_SERVER_URL}/gifs/${gifId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`GIF delete failed: ${res.status}`);
}

export type UploadGifParams = {
  tags?: string;
  visibility?: GifVisibility;
  nsfw?: boolean;
};

export async function uploadGif(file: File, params: UploadGifParams = {}): Promise<GifItem> {
  const form = new FormData();
  form.append('file', file);
  if (params.tags) form.append('tags', params.tags);
  if (params.visibility) form.append('visibility', params.visibility);
  if (params.nsfw) form.append('nsfw', 'true');
  const res = await gifFetch(`${GIF_SERVER_URL}/gifs`, { method: 'POST', body: form });
  if (res.status === 507) throw new Error('The GIF server is out of storage');
  if (!res.ok) {
    let message = `GIF upload failed: ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* keep status-based message */
    }
    throw new Error(message);
  }
  return res.json();
}

export async function replaceGifFile(gifId: string, file: File): Promise<GifItem> {
  const form = new FormData();
  form.append('file', file);
  const res = await gifFetch(`${GIF_SERVER_URL}/gifs/${gifId}/file`, { method: 'PUT', body: form });
  if (res.status === 507) throw new Error('The GIF server is out of storage');
  if (!res.ok) {
    let message = `GIF replace failed: ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* keep status-based message */
    }
    throw new Error(message);
  }
  return res.json();
}

export async function fetchGifBlob(renditionUrl: string): Promise<Blob> {
  const res = await gifFetch(renditionUrl);
  if (!res.ok) throw new Error(`GIF blob fetch failed: ${res.status}`);
  return res.blob();
}

export async function recordGifSelect(gifId: string): Promise<void> {
  await gifFetch(`${GIF_SERVER_URL}/gifs/${gifId}/select`, { method: 'POST' });
}
