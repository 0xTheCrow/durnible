import { useState, useEffect } from 'react';

function parseCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map(String)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } catch {
      // malformed JSON — fall through to plain-string handling
    }
  }
  // Plain string: single host or comma-separated list (legacy / simple config)
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const INVIDIOUS_CANDIDATES: string[] = parseCandidates(
  import.meta.env.VITE_INVIDIOUS_INSTANCES ?? 'inv.nadeko.net'
);

async function probe(host: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    // mode: 'no-cors' returns an opaque response — we can't read it, but a
    // successful (non-throwing) fetch means the host responded.
    await fetch(`https://${host}/`, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

let _promise: Promise<string> | undefined;

export function resolveInvidiousInstance(): Promise<string> {
  if (!_promise) {
    _promise = (async () => {
      // Sequential probe: stop at the first reachable host. Parallelizing
      // would race them and pick a "winner" that may not be the user's
      // preferred order.
      // eslint-disable-next-line no-restricted-syntax
      for (const host of INVIDIOUS_CANDIDATES) {
        // eslint-disable-next-line no-await-in-loop
        if (await probe(host)) return host;
      }
      // None reachable — fall back to first candidate.
      return INVIDIOUS_CANDIDATES[0] ?? 'inv.nadeko.net';
    })();
  }
  return _promise;
}

export function useInvidiousInstance(): string | null {
  const [instance, setInstance] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveInvidiousInstance().then((host) => {
      if (!cancelled) setInstance(host);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return instance;
}
