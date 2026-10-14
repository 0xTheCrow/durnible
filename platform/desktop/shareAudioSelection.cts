import { app } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const COMMAND_TIMEOUT_MS = 2000;
const COMMAND_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const MAX_PROCESS_ANCESTRY_DEPTH = 64;
const WINDOW_SOURCE_ID_PATTERN = /^window:(\d+):/;

export type ShareAudioSelection =
  | { kind: 'all-except-durnible' }
  | { kind: 'process-tree'; rootProcessId: number };

export const runCommand = async (command: string, commandArguments: string[]): Promise<string> => {
  const { stdout } = await execFileAsync(command, commandArguments, {
    timeout: COMMAND_TIMEOUT_MS,
    maxBuffer: COMMAND_MAX_BUFFER_BYTES,
    env: { ...process.env, LC_ALL: 'C' },
  });
  return stdout;
};

export const readOwnProcessIds = (): Set<number> =>
  new Set(app.getAppMetrics().map((metric) => metric.pid));

const readParentProcessIds = async (): Promise<Map<number, number>> => {
  const processTable = await runCommand('ps', ['-eo', 'pid=,ppid=']);
  return new Map(
    processTable
      .split('\n')
      .map((line) => line.trim().split(/\s+/).map(Number))
      .filter(([processId, parentProcessId]) => processId > 0 && parentProcessId >= 0)
      .map(([processId, parentProcessId]) => [processId, parentProcessId])
  );
};

const checkIsInProcessTree = (
  processId: number,
  rootProcessId: number,
  parentProcessIds: Map<number, number>
): boolean => {
  let currentProcessId: number | undefined = processId;
  let depth = 0;
  while (currentProcessId !== undefined && currentProcessId > 1) {
    if (currentProcessId === rootProcessId) return true;
    if (depth >= MAX_PROCESS_ANCESTRY_DEPTH) return false;
    currentProcessId = parentProcessIds.get(currentProcessId);
    depth += 1;
  }
  return false;
};

export const createSelectedProcessChecker = async (
  selection: ShareAudioSelection
): Promise<(processId: number | undefined) => boolean> => {
  const ownProcessIds = readOwnProcessIds();
  if (selection.kind === 'all-except-durnible') {
    return (processId) => processId !== undefined && !ownProcessIds.has(processId);
  }
  const parentProcessIds = await readParentProcessIds();
  return (processId) =>
    processId !== undefined &&
    !ownProcessIds.has(processId) &&
    checkIsInProcessTree(processId, selection.rootProcessId, parentProcessIds);
};

const findWindowProcessId = async (sourceId: string): Promise<number | undefined> => {
  const windowIdMatch = sourceId.match(WINDOW_SOURCE_ID_PATTERN);
  if (!windowIdMatch) return undefined;
  try {
    const windowProperty = await runCommand('xprop', ['-id', windowIdMatch[1], '_NET_WM_PID']);
    const processIdMatch = windowProperty.match(/=\s*(\d+)/);
    return processIdMatch ? Number(processIdMatch[1]) : undefined;
  } catch {
    return undefined;
  }
};

export const findShareAudioSelection = async (sourceId: string): Promise<ShareAudioSelection> => {
  const windowProcessId = await findWindowProcessId(sourceId);
  return windowProcessId === undefined
    ? { kind: 'all-except-durnible' }
    : { kind: 'process-tree', rootProcessId: windowProcessId };
};
