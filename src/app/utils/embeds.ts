// ── YouTube ──────────────────────────────────────────────────────────────────

const YOUTUBE_URL_REG =
  /^https?:\/\/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export type YouTubeEmbedInfo = { videoId: string; start?: number };

export const testYouTubeUrl = (url: string): boolean => YOUTUBE_URL_REG.test(url);

// Parse YouTube's `t` / `start` query parameter into seconds. Accepts:
//   - plain integer seconds: "42"
//   - trailing-unit seconds: "42s"
//   - colloquial duration: "1h2m3s", "1m30s", "90s"
function parseYouTubeStart(value: string): number | undefined {
  if (/^\d+$/.test(value)) {
    const n = parseInt(value, 10);
    return n > 0 ? n : undefined;
  }
  const m = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!m) return undefined;
  const h = parseInt(m[1] ?? '0', 10);
  const min = parseInt(m[2] ?? '0', 10);
  const s = parseInt(m[3] ?? '0', 10);
  const total = h * 3600 + min * 60 + s;
  return total > 0 ? total : undefined;
}

export const getYouTubeEmbedInfo = (url: string): YouTubeEmbedInfo | undefined => {
  const match = url.match(YOUTUBE_URL_REG);
  if (!match) return undefined;
  const videoId = match[1];
  let start: number | undefined;
  try {
    const u = new URL(url);
    const t = u.searchParams.get('t') ?? u.searchParams.get('start');
    if (t) start = parseYouTubeStart(t);
  } catch {
    // malformed URL — videoId from the regex is still good, just no start time
  }
  return { videoId, start };
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

// ── Twitter / X ──────────────────────────────────────────────────────────────
// Embedded via a configurable Nitter instance to avoid Twitter's tracking script.
// Set VITE_NITTER_INSTANCES in your .env to override the default.

const TWITTER_URL_REG =
  /^https?:\/\/(?:(?:www\.|mobile\.)?twitter\.com|x\.com)\/([\w]+)\/status\/(\d+)/;

export type TwitterEmbedInfo = { user: string; id: string };

export const testTwitterUrl = (url: string): boolean => TWITTER_URL_REG.test(url);

export const getTwitterEmbedInfo = (url: string): TwitterEmbedInfo | undefined => {
  const match = url.match(TWITTER_URL_REG);
  if (!match) return undefined;
  return { user: match[1], id: match[2] };
};

