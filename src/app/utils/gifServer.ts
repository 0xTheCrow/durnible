export const GIF_SERVER_URL = import.meta.env.VITE_GIF_SERVER_URL || '';
export const GIF_API_KEY = import.meta.env.VITE_GIF_API_KEY || '';
export const gifServerEnabled = !!(GIF_SERVER_URL && GIF_API_KEY);

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

export type GifItem = {
  id: string;
  filename: string;
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

const gifFetch = (url: string, options?: RequestInit): Promise<Response> =>
  fetch(url, {
    ...options,
    headers: {
      'X-API-Key': GIF_API_KEY,
      ...options?.headers,
    },
  });

export async function searchGifs(query: string, limit = 20, pos?: string): Promise<GifListResponse> {
  const url = new URL(`${GIF_SERVER_URL}/gifs/search`);
  if (query) url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  if (pos) url.searchParams.set('pos', pos);
  const res = await gifFetch(url.toString());
  if (!res.ok) throw new Error(`GIF search failed: ${res.status}`);
  return res.json();
}

export async function getFeaturedGifs(limit = 20, pos?: string): Promise<GifListResponse> {
  const url = new URL(`${GIF_SERVER_URL}/gifs/featured`);
  url.searchParams.set('limit', String(limit));
  if (pos) url.searchParams.set('pos', pos);
  const res = await gifFetch(url.toString());
  if (!res.ok) throw new Error(`GIF featured failed: ${res.status}`);
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
