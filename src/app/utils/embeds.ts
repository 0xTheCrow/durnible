// ── YouTube ──────────────────────────────────────────────────────────────────

const YOUTUBE_URL_REG =
  /^https?:\/\/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export const testYouTubeUrl = (url: string): boolean => YOUTUBE_URL_REG.test(url);

export const getYouTubeVideoId = (url: string): string | undefined => {
  const match = url.match(YOUTUBE_URL_REG);
  return match?.[1];
};

// ── Spotify ──────────────────────────────────────────────────────────────────

const SPOTIFY_URL_REG =
  /^https?:\/\/open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/;

export type SpotifyEmbedInfo = { type: string; id: string };

export const testSpotifyUrl = (url: string): boolean => SPOTIFY_URL_REG.test(url);

export const getSpotifyEmbedInfo = (url: string): SpotifyEmbedInfo | undefined => {
  const match = url.match(SPOTIFY_URL_REG);
  if (!match) return undefined;
  return { type: match[1], id: match[2] };
};

// ── SoundCloud ────────────────────────────────────────────────────────────────

// Matches tracks and sets; excludes bare profile pages (no second path segment).
const SOUNDCLOUD_URL_REG =
  /^https?:\/\/(?:www\.|m\.)?soundcloud\.com\/([\w-]+)\/(sets\/[\w-]+|[\w-]+)/;

export type SoundCloudEmbedInfo = { cleanUrl: string; isSet: boolean };

export const testSoundCloudUrl = (url: string): boolean => SOUNDCLOUD_URL_REG.test(url);

export const getSoundCloudEmbedInfo = (url: string): SoundCloudEmbedInfo | undefined => {
  const match = url.match(SOUNDCLOUD_URL_REG);
  if (!match) return undefined;
  // Normalize away mobile subdomain and strip any query tracking params
  const cleanUrl = `https://soundcloud.com/${match[1]}/${match[2]}`;
  return { cleanUrl, isSet: match[2].startsWith('sets/') };
};

// ── Bandcamp ──────────────────────────────────────────────────────────────────
// Note: Bandcamp's embed player requires a numeric track/album ID that is NOT
// present in the URL — it's only in the page's JSON blob. A proper iframe embed
// would need a server-side oEmbed fetch. Until then we render a link card.

const BANDCAMP_URL_REG =
  /^https?:\/\/([\w-]+)\.bandcamp\.com\/(track|album)\/([\w-]+)/;

export type BandcampInfo = { artist: string; type: 'track' | 'album'; slug: string };

export const testBandcampUrl = (url: string): boolean => BANDCAMP_URL_REG.test(url);

export const getBandcampInfo = (url: string): BandcampInfo | undefined => {
  const match = url.match(BANDCAMP_URL_REG);
  if (!match) return undefined;
  return { artist: match[1], type: match[2] as 'track' | 'album', slug: match[3] };
};
