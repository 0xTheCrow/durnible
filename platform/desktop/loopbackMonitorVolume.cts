import { app } from 'electron';
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const FULL_VOLUME_PERCENT = 100;
const PACTL_TIMEOUT_MS = 2000;

const getRestoredMonitorsFilePath = (): string =>
  path.join(app.getPath('userData'), 'restored-loopback-monitors.json');

const runPactl = async (pactlArguments: string[]): Promise<string> => {
  const { stdout } = await execFileAsync('pactl', pactlArguments, {
    timeout: PACTL_TIMEOUT_MS,
    env: { ...process.env, LC_ALL: 'C' },
  });
  return stdout.trim();
};

const readRestoredMonitorNames = async (): Promise<string[]> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(getRestoredMonitorsFilePath(), 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((monitorName): monitorName is string => typeof monitorName === 'string');
  } catch {
    return [];
  }
};

const parseChannelVolumePercents = (pactlVolumeOutput: string): number[] =>
  Array.from(pactlVolumeOutput.matchAll(/(\d+)%/g), (match) => Number(match[1]));

const restoreMonitorVolume = async (): Promise<void> => {
  const monitorName = `${await runPactl(['get-default-sink'])}.monitor`;
  const restoredMonitorNames = await readRestoredMonitorNames();
  if (restoredMonitorNames.includes(monitorName)) return;

  const channelVolumePercents = parseChannelVolumePercents(
    await runPactl(['get-source-volume', monitorName])
  );
  if (channelVolumePercents.some((volumePercent) => volumePercent < FULL_VOLUME_PERCENT)) {
    await runPactl(['set-source-volume', monitorName, `${FULL_VOLUME_PERCENT}%`]);
  }
  await writeFile(
    getRestoredMonitorsFilePath(),
    JSON.stringify([...restoredMonitorNames, monitorName])
  );
};

export const restoreLoopbackMonitorVolumeOnce = async (): Promise<void> => {
  if (process.platform !== 'linux') return;
  await restoreMonitorVolume().catch(() => undefined);
};
