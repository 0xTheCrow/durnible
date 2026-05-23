export const MEDIA_CACHE_MARKER = 'durnible_cache';
export const MEDIA_CACHE_PREFIX = 'durnible-media-cache';

export type MediaCacheBucket = 'emoji' | 'avatar';

type BucketConfig = { cacheName: string; maxEntries: number };

export const MEDIA_CACHE_BUCKETS: Record<MediaCacheBucket, BucketConfig> = {
  emoji: { cacheName: `${MEDIA_CACHE_PREFIX}-emoji-v1`, maxEntries: 512 },
  avatar: { cacheName: `${MEDIA_CACHE_PREFIX}-avatar-v1`, maxEntries: 1024 },
};

export const markCachedMediaUrl = (httpUrl: string, bucket: MediaCacheBucket): string => {
  try {
    const url = new URL(httpUrl);
    if (!url.protocol.startsWith('http') || !url.pathname.includes('/media/')) {
      return httpUrl;
    }
    url.searchParams.set(MEDIA_CACHE_MARKER, bucket);
    return url.toString();
  } catch {
    return httpUrl;
  }
};

export const getCachedMediaTarget = (
  rawUrl: string
): { cacheKey: string; bucket: MediaCacheBucket } | null => {
  if (!rawUrl.includes(MEDIA_CACHE_MARKER)) return null;
  const url = new URL(rawUrl);
  const bucket = url.searchParams.get(MEDIA_CACHE_MARKER);
  if (!bucket || !Object.prototype.hasOwnProperty.call(MEDIA_CACHE_BUCKETS, bucket)) return null;
  url.searchParams.delete(MEDIA_CACHE_MARKER);
  return { cacheKey: url.toString(), bucket: bucket as MediaCacheBucket };
};
