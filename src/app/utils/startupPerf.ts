const PREFIX = 'startup:';

const ENABLED = false;

export const startupMark = (name: string) => {
  if (!ENABLED) return;
  performance.mark(`${PREFIX}${name}`);
};

type PreConfigRow = { label: string; ms: number | null };

const getPreConfigBreakdown = (): PreConfigRow[] => {
  const nav = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (!nav) return [];
  const cfgStart = performance.getEntriesByName(`${PREFIX}config-fetch-start`, 'mark')[0]
    ?.startTime;
  const rows: PreConfigRow[] = [
    { label: 'request -> responseStart', ms: Math.round(nav.responseStart - nav.requestStart) },
    { label: 'response body', ms: Math.round(nav.responseEnd - nav.responseStart) },
    {
      label: 'HTML parse (-> domInteractive)',
      ms: Math.round(nav.domInteractive - nav.responseEnd),
    },
    {
      label: 'scripts executed (-> DCL)',
      ms: Math.round(nav.domContentLoadedEventEnd - nav.domInteractive),
    },
  ];
  if (cfgStart !== undefined) {
    rows.push({
      label: 'DCL -> config-fetch-start',
      ms: Math.round(cfgStart - nav.domContentLoadedEventEnd),
    });
  }
  return rows;
};

export const getStartupSummary = () =>
  performance
    .getEntriesByType('mark')
    .filter((m) => m.name.startsWith(PREFIX))
    .map((m) => ({ name: m.name, startTime: Math.round(m.startTime) }));

type WasmRow = { label: string; value: string };

const getCryptoWasmTiming = (): WasmRow[] => {
  const entry = performance
    .getEntriesByType('resource')
    .find((r) => r.name.includes('matrix_sdk_crypto_wasm')) as
    | PerformanceResourceTiming
    | undefined;
  if (!entry) return [];
  return [
    { label: 'wasm file', value: entry.name.split('/').pop() ?? '' },
    { label: 'wasm size', value: `${Math.round(entry.transferSize / 1024)}KB` },
    { label: 'wasm download', value: `${Math.round(entry.responseEnd - entry.fetchStart)}ms` },
    { label: 'wasm fetchStart', value: `${Math.round(entry.fetchStart)}ms` },
  ];
};

export const logStartupSummary = () => {
  if (!ENABLED) return;
  const pre = getPreConfigBreakdown();
  const marks = getStartupSummary();
  const wasm = getCryptoWasmTiming();
  const preBody = pre.map((r) => `${String(r.ms ?? '-').padStart(6, ' ')}  ${r.label}`).join('\n');
  const markBody = marks
    .map((r) => `${String(r.startTime).padStart(6, ' ')}  ${r.name}`)
    .join('\n');
  const wasmBody = wasm.map((r) => `${r.value.padStart(6, ' ')}  ${r.label}`).join('\n');
  const sections = [preBody, markBody, wasmBody].filter(Boolean).join('\n---\n');
  console.warn(`[startup perf]\n${sections}`);
};

if (typeof window !== 'undefined') {
  (
    window as unknown as { __startupPerf: () => ReturnType<typeof getStartupSummary> }
  ).__startupPerf = getStartupSummary;
}
