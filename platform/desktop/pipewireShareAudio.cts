import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { ShareAudioSelection } from './shareAudioSelection.cjs';
import {
  createSelectedProcessChecker,
  findShareAudioSelection,
  readOwnProcessIds,
  runCommand,
} from './shareAudioSelection.cjs';

const RECONCILE_DEBOUNCE_MS = 200;
const MONITOR_OUTPUT_OVERLAP_CHARACTERS = 200;
const AUDIO_GRAPH_OBJECT_TYPES = new Set([
  'PipeWire:Interface:Node',
  'PipeWire:Interface:Port',
  'PipeWire:Interface:Link',
]);
const AUDIO_GRAPH_OBJECT_TYPE_PATTERN = /"type": "PipeWire:Interface:(Node|Port|Link)"/;
const REMOVED_OBJECT_PATTERN = /"id": (\d+),\s*"info": null/g;
const VIRTUAL_NODE_READY_TIMEOUT_MS = 3000;
const CAPTURE_START_TIMEOUT_MS = 30 * 1000;
const AUDIO_OUTPUT_STREAM_MEDIA_CLASS = 'Stream/Output/Audio';
const LEFT_CHANNEL = 'FL';
const RIGHT_CHANNEL = 'FR';

type PipewireObjectInfo = {
  props?: Record<string, unknown>;
  direction?: string;
  'output-node-id'?: number;
  'output-port-id'?: number;
  'input-node-id'?: number;
  'input-port-id'?: number;
};

type PipewireObject = {
  id: number;
  type: string;
  info?: PipewireObjectInfo | null;
};

type AudioOutputStream = {
  nodeId: number;
  processId: number | undefined;
};

type AudioPort = {
  portId: number;
  channel: string | undefined;
};

let stopActiveShareAudio: (() => void) | undefined;
let shareAudioSessionCount = 0;

const readPipewireObjects = async (): Promise<PipewireObject[]> => {
  const dump = await runCommand('pw-dump', ['--no-colors']);
  const snapshotEndIndex = dump.indexOf('\n]');
  return JSON.parse(snapshotEndIndex === -1 ? dump : dump.slice(0, snapshotEndIndex + 2));
};

const readProperty = (object: PipewireObject, key: string): string | undefined => {
  const value = object.info?.props?.[key];
  return value === undefined || value === null ? undefined : String(value);
};

const readNumberProperty = (object: PipewireObject, key: string): number | undefined => {
  const value = Number(readProperty(object, key));
  return Number.isInteger(value) ? value : undefined;
};

const checkIsPipewireAudioAvailable = async (): Promise<boolean> => {
  try {
    const serverInfo = await runCommand('pactl', ['info']);
    if (!serverInfo.includes('on PipeWire')) return false;
    await Promise.all([
      runCommand('pw-cli', ['--version']),
      runCommand('pw-link', ['--version']),
      runCommand('pw-dump', ['--version']),
    ]);
    return true;
  } catch {
    return false;
  }
};

const findVirtualNode = (
  objects: PipewireObject[],
  virtualNodeName: string
): PipewireObject | undefined =>
  objects.find(
    (object) =>
      object.type === 'PipeWire:Interface:Node' &&
      readProperty(object, 'node.name') === virtualNodeName
  );

const findNodes = (objects: PipewireObject[]): PipewireObject[] =>
  objects.filter((object) => object.type === 'PipeWire:Interface:Node');

const createNodeProcessIdReader = (objects: PipewireObject[]) => {
  const clientsById = new Map(
    objects
      .filter((object) => object.type === 'PipeWire:Interface:Client')
      .map((client) => [client.id, client])
  );
  return (node: PipewireObject): number | undefined => {
    const clientId = readNumberProperty(node, 'client.id');
    const client = clientId === undefined ? undefined : clientsById.get(clientId);
    return (
      readNumberProperty(node, 'application.process.id') ??
      (client ? readNumberProperty(client, 'application.process.id') : undefined)
    );
  };
};

const findAudioOutputStreams = (objects: PipewireObject[]): AudioOutputStream[] => {
  const readNodeProcessId = createNodeProcessIdReader(objects);
  return findNodes(objects)
    .filter((node) => readProperty(node, 'media.class') === AUDIO_OUTPUT_STREAM_MEDIA_CLASS)
    .map((node) => ({ nodeId: node.id, processId: readNodeProcessId(node) }));
};

const findPorts = (objects: PipewireObject[], nodeId: number, direction: string): AudioPort[] =>
  objects
    .filter((object) => object.type === 'PipeWire:Interface:Port')
    .filter((port) => readNumberProperty(port, 'node.id') === nodeId)
    .filter((port) => port.info?.direction === direction)
    .map((port) => ({ portId: port.id, channel: readProperty(port, 'audio.channel') }));

const findMatchingInputPorts = (
  outputChannel: string | undefined,
  inputPorts: AudioPort[]
): AudioPort[] => {
  const sameChannelPorts = inputPorts.filter((inputPort) => inputPort.channel === outputChannel);
  if (sameChannelPorts.length > 0) return sameChannelPorts;
  if (outputChannel?.endsWith('L')) {
    return inputPorts.filter((inputPort) => inputPort.channel === LEFT_CHANNEL);
  }
  if (outputChannel?.endsWith('R')) {
    return inputPorts.filter((inputPort) => inputPort.channel === RIGHT_CHANNEL);
  }
  return inputPorts;
};

const linkSelectedStreams = async (
  objects: PipewireObject[],
  virtualNodeId: number,
  selection: ShareAudioSelection
): Promise<void> => {
  const virtualInputPorts = findPorts(objects, virtualNodeId, 'input');
  const existingLinkKeys = new Set(
    objects
      .filter((object) => object.type === 'PipeWire:Interface:Link')
      .map((link) => `${link.info?.['output-port-id']}:${link.info?.['input-port-id']}`)
  );
  const checkIsSelectedProcess = await createSelectedProcessChecker(selection);
  const selectedStreams = findAudioOutputStreams(objects).filter((stream) =>
    checkIsSelectedProcess(stream.processId)
  );

  const missingLinks = selectedStreams.flatMap((stream) =>
    findPorts(objects, stream.nodeId, 'output').flatMap((outputPort) =>
      findMatchingInputPorts(outputPort.channel, virtualInputPorts)
        .filter((inputPort) => !existingLinkKeys.has(`${outputPort.portId}:${inputPort.portId}`))
        .map((inputPort) => [String(outputPort.portId), String(inputPort.portId)])
    )
  );
  await Promise.all(
    missingLinks.map((portIds) => runCommand('pw-link', portIds).catch(() => undefined))
  );
};

const checkHasOwnCaptureLink = (objects: PipewireObject[], virtualNodeId: number): boolean => {
  const ownProcessIds = readOwnProcessIds();
  const readNodeProcessId = createNodeProcessIdReader(objects);
  const ownNodeIds = new Set(
    findNodes(objects)
      .filter((node) => {
        const processId = readNodeProcessId(node);
        return processId !== undefined && ownProcessIds.has(processId);
      })
      .map((node) => node.id)
  );
  return objects.some(
    (object) =>
      object.type === 'PipeWire:Interface:Link' &&
      object.info?.['output-node-id'] === virtualNodeId &&
      ownNodeIds.has(object.info?.['input-node-id'] ?? -1)
  );
};

const spawnVirtualNode = (virtualNodeName: string): ChildProcess => {
  const nodeProcess = spawn('pw-cli', [], { stdio: ['pipe', 'ignore', 'ignore'] });
  nodeProcess.stdin?.write(
    `create-node adapter { factory.name=support.null-audio-sink node.name=${virtualNodeName} node.description="Durnible screen share audio" media.class=Audio/Source/Virtual audio.position=[${LEFT_CHANNEL} ${RIGHT_CHANNEL}] priority.session=0 object.linger=false }\n`
  );
  return nodeProcess;
};

export const stopPipewireShareAudio = (): void => {
  stopActiveShareAudio?.();
};

const startShareAudioSession = (
  selection: ShareAudioSelection,
  virtualNodeName: string
): Promise<boolean> =>
  new Promise((resolve) => {
    const nodeProcess = spawnVirtualNode(virtualNodeName);
    const monitorProcess = spawn('pw-dump', ['--monitor', '--no-colors'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let isStopped = false;
    let isReady = false;
    let hasHadCaptureLink = false;
    let isReconciling = false;
    let isReconcileQueued = false;
    let reconcileTimeout: NodeJS.Timeout | undefined;
    let audioGraphObjectIds = new Set<number>();
    let previousMonitorOutputTail = '';

    const stop = () => {
      if (isStopped) return;
      isStopped = true;
      clearTimeout(readyTimeout);
      clearTimeout(captureStartTimeout);
      clearTimeout(reconcileTimeout);
      monitorProcess.kill();
      nodeProcess.kill();
      if (stopActiveShareAudio === stop) stopActiveShareAudio = undefined;
      resolve(false);
    };

    const readyTimeout = setTimeout(() => {
      if (!isReady) stop();
    }, VIRTUAL_NODE_READY_TIMEOUT_MS);

    const captureStartTimeout = setTimeout(() => {
      if (!hasHadCaptureLink) stop();
    }, CAPTURE_START_TIMEOUT_MS);

    const reconcile = async (): Promise<void> => {
      if (isReconciling) {
        isReconcileQueued = true;
        return;
      }
      isReconciling = true;
      try {
        const objects = await readPipewireObjects().catch(() => undefined);
        if (!objects || isStopped) return;
        audioGraphObjectIds = new Set(
          objects
            .filter((object) => AUDIO_GRAPH_OBJECT_TYPES.has(object.type))
            .map((object) => object.id)
        );
        const virtualNode = findVirtualNode(objects, virtualNodeName);
        if (!virtualNode) {
          if (isReady) stop();
          return;
        }
        if (checkHasOwnCaptureLink(objects, virtualNode.id)) {
          hasHadCaptureLink = true;
        } else if (hasHadCaptureLink) {
          stop();
          return;
        }
        await linkSelectedStreams(objects, virtualNode.id, selection).catch(() => undefined);
        isReady = true;
        resolve(true);
      } finally {
        isReconciling = false;
        if (isReconcileQueued && !isStopped) {
          isReconcileQueued = false;
          scheduleReconcile();
        }
      }
    };

    const scheduleReconcile = () => {
      if (reconcileTimeout) return;
      reconcileTimeout = setTimeout(() => {
        reconcileTimeout = undefined;
        reconcile().catch(() => undefined);
      }, RECONCILE_DEBOUNCE_MS);
    };

    const checkIsAudioGraphChange = (monitorOutput: string): boolean =>
      AUDIO_GRAPH_OBJECT_TYPE_PATTERN.test(monitorOutput) ||
      Array.from(monitorOutput.matchAll(REMOVED_OBJECT_PATTERN)).some((match) =>
        audioGraphObjectIds.has(Number(match[1]))
      );

    const scheduleReconcileOnAudioGraphChange = (monitorOutputChunk: Buffer) => {
      const monitorOutput = previousMonitorOutputTail + monitorOutputChunk.toString();
      previousMonitorOutputTail = monitorOutput.slice(-MONITOR_OUTPUT_OVERLAP_CHARACTERS);
      if (checkIsAudioGraphChange(monitorOutput)) scheduleReconcile();
    };

    stopActiveShareAudio = stop;
    nodeProcess.once('error', stop);
    nodeProcess.once('exit', stop);
    nodeProcess.stdin?.once('error', stop);
    monitorProcess.once('error', stop);
    monitorProcess.stdout?.on('data', scheduleReconcileOnAudioGraphChange);
  });

export const startPipewireShareAudio = async (sourceId: string): Promise<string | undefined> => {
  stopPipewireShareAudio();
  if (process.platform !== 'linux' || !(await checkIsPipewireAudioAvailable())) return undefined;

  const selection = await findShareAudioSelection(sourceId);
  shareAudioSessionCount += 1;
  const virtualNodeName = `durnible-share-${process.pid}-${shareAudioSessionCount}`;
  return (await startShareAudioSession(selection, virtualNodeName)) ? virtualNodeName : undefined;
};
