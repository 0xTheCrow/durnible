import { spawn } from 'node:child_process';
import type { ShareAudioSelection } from './shareAudioSelection.cjs';
import {
  createSelectedProcessChecker,
  findShareAudioSelection,
  readOwnProcessIds,
  runCommand,
} from './shareAudioSelection.cjs';

const RECONCILE_DEBOUNCE_MS = 200;
const STREAM_EVENT_PATTERN = /Event '\w+' on (sink-input|source-output|sink|source) #/;
const CAPTURE_START_TIMEOUT_MS = 30 * 1000;
const SHARE_SINK_NAME_PREFIX = 'durnible_share_';
const SHARE_SINK_PROPERTIES_ARGUMENT = `sink_properties="device.description='Durnible screen share audio'"`;

type PulseaudioSink = { index: number; name: string };

type PulseaudioStream = {
  index: number;
  owner_module?: string | number | null;
  sink?: number;
  source?: number;
  properties?: Record<string, string>;
};

type LoadedModule = { moduleIndex: number; arguments: string };

type CombineSink = { moduleIndex: number; sinkName: string };

let stopActiveShareAudio: (() => Promise<void>) | undefined;
let shareAudioSessionCount = 0;

const readJson = async <Value extends object>(pactlArguments: string[]): Promise<Value> =>
  JSON.parse(await runCommand('pactl', ['-f', 'json', ...pactlArguments]));

const readSinks = () => readJson<PulseaudioSink[]>(['list', 'short', 'sinks']);
const readSources = () => readJson<PulseaudioSink[]>(['list', 'short', 'sources']);
const readSinkInputs = () => readJson<PulseaudioStream[]>(['list', 'sink-inputs']);
const readSourceOutputs = () => readJson<PulseaudioStream[]>(['list', 'source-outputs']);

const readLoadedModules = async (): Promise<LoadedModule[]> =>
  (await runCommand('pactl', ['list', 'short', 'modules']))
    .split('\n')
    .map((line) => line.split('\t'))
    .filter(([moduleIndex]) => moduleIndex !== undefined && /^\d+$/.test(moduleIndex))
    .map(([moduleIndex, , moduleArguments]) => ({
      moduleIndex: Number(moduleIndex),
      arguments: moduleArguments ?? '',
    }));

const loadModule = async (moduleName: string, moduleArguments: string[]): Promise<number> =>
  Number((await runCommand('pactl', ['load-module', moduleName, ...moduleArguments])).trim());

const unloadModule = (moduleIndex: number): Promise<unknown> =>
  runCommand('pactl', ['unload-module', String(moduleIndex)]).catch(() => undefined);

const readStreamProcessId = (stream: PulseaudioStream): number | undefined => {
  const processId = Number(stream.properties?.['application.process.id']);
  return Number.isInteger(processId) ? processId : undefined;
};

const checkIsPulseaudioAvailable = async (): Promise<boolean> => {
  try {
    const serverInfo = await readJson<{ server_name?: string }>(['info']);
    return serverInfo.server_name === 'pulseaudio';
  } catch {
    return false;
  }
};

const unloadLeftoverShareModules = async (): Promise<void> => {
  const shareModules = (await readLoadedModules()).filter((loadedModule) =>
    loadedModule.arguments.includes(`sink_name=${SHARE_SINK_NAME_PREFIX}`)
  );
  const combineModules = shareModules.filter((loadedModule) =>
    loadedModule.arguments.includes('slaves=')
  );
  const nullSinkModules = shareModules.filter(
    (loadedModule) => !combineModules.includes(loadedModule)
  );
  await Promise.all(combineModules.map((loadedModule) => unloadModule(loadedModule.moduleIndex)));
  await Promise.all(nullSinkModules.map((loadedModule) => unloadModule(loadedModule.moduleIndex)));
};

export const checkIsPulseaudioShareAudioActive = (): boolean => stopActiveShareAudio !== undefined;

export const stopPulseaudioShareAudio = async (): Promise<void> => {
  await stopActiveShareAudio?.();
};

const startShareAudioSession = async (
  selection: ShareAudioSelection,
  shareSinkName: string
): Promise<void> => {
  const shareSinkModuleIndex = await loadModule('module-null-sink', [
    `sink_name=${shareSinkName}`,
    SHARE_SINK_PROPERTIES_ARGUMENT,
  ]);
  const monitorSourceName = `${shareSinkName}.monitor`;
  const combineSinksByOriginalSinkName = new Map<string, CombineSink>();
  const originalSinkNamesByStreamIndex = new Map<number, string>();
  const subscribeProcess = spawn(
    'sh',
    ['-c', 'pactl subscribe & subscribe_process_id=$!; read -r _; kill "$subscribe_process_id"'],
    { stdio: ['pipe', 'pipe', 'ignore'] }
  );
  let isStopped = false;
  let hasHadCaptureStream = false;
  let isReconciling = false;
  let isReconcileQueued = false;
  let reconcileTimeout: NodeJS.Timeout | undefined;

  const readOwnModuleIndexes = () =>
    new Set([
      shareSinkModuleIndex,
      ...[...combineSinksByOriginalSinkName.values()].map((combineSink) => combineSink.moduleIndex),
    ]);

  const moveStreamsBack = async () => {
    const [sinks, sinkInputs] = await Promise.all([readSinks(), readSinkInputs()]);
    const sinkNamesByIndex = new Map(sinks.map((sink) => [sink.index, sink.name]));
    const combineSinkNames = new Set(
      [...combineSinksByOriginalSinkName.values()].map((combineSink) => combineSink.sinkName)
    );
    await Promise.all(
      sinkInputs
        .filter((sinkInput) => originalSinkNamesByStreamIndex.has(sinkInput.index))
        .filter((sinkInput) =>
          combineSinkNames.has(sinkNamesByIndex.get(sinkInput.sink ?? -1) ?? '')
        )
        .map((sinkInput) => {
          const originalSinkName = originalSinkNamesByStreamIndex.get(sinkInput.index) ?? '';
          const isOriginalSinkPresent = sinks.some((sink) => sink.name === originalSinkName);
          return runCommand('pactl', [
            'move-sink-input',
            String(sinkInput.index),
            isOriginalSinkPresent ? originalSinkName : '@DEFAULT_SINK@',
          ]).catch(() => undefined);
        })
    );
  };

  const tearDown = async () => {
    isStopped = true;
    clearTimeout(captureStartTimeout);
    clearTimeout(reconcileTimeout);
    subscribeProcess.stdin?.end();
    await moveStreamsBack().catch(() => undefined);
    await Promise.all(
      [...combineSinksByOriginalSinkName.values()].map((combineSink) =>
        unloadModule(combineSink.moduleIndex)
      )
    );
    await unloadModule(shareSinkModuleIndex);
    if (stopActiveShareAudio === stop) stopActiveShareAudio = undefined;
  };

  let tearDownPromise: Promise<void> | undefined;
  const stop = (): Promise<void> => {
    tearDownPromise ??= tearDown();
    return tearDownPromise;
  };

  const captureStartTimeout = setTimeout(() => {
    if (!hasHadCaptureStream) stop().catch(() => undefined);
  }, CAPTURE_START_TIMEOUT_MS);

  const ensureCombineSink = async (originalSinkName: string): Promise<CombineSink> => {
    const existingCombineSink = combineSinksByOriginalSinkName.get(originalSinkName);
    if (existingCombineSink) return existingCombineSink;
    const sinkName = `${shareSinkName}_via_${combineSinksByOriginalSinkName.size + 1}`;
    const moduleIndex = await loadModule('module-combine-sink', [
      `sink_name=${sinkName}`,
      `slaves=${originalSinkName},${shareSinkName}`,
      SHARE_SINK_PROPERTIES_ARGUMENT,
    ]);
    const combineSink = { moduleIndex, sinkName };
    combineSinksByOriginalSinkName.set(originalSinkName, combineSink);
    return combineSink;
  };

  const moveSelectedStreams = async (sinks: PulseaudioSink[], sinkInputs: PulseaudioStream[]) => {
    const sinkNamesByIndex = new Map(sinks.map((sink) => [sink.index, sink.name]));
    const ownModuleIndexes = readOwnModuleIndexes();
    const shareSinkNames = new Set([
      shareSinkName,
      ...[...combineSinksByOriginalSinkName.values()].map((combineSink) => combineSink.sinkName),
    ]);
    const checkIsSelectedProcess = await createSelectedProcessChecker(selection);
    const streamsToMove = sinkInputs.filter((sinkInput) => {
      const currentSinkName = sinkNamesByIndex.get(sinkInput.sink ?? -1);
      return (
        currentSinkName !== undefined &&
        !shareSinkNames.has(currentSinkName) &&
        !ownModuleIndexes.has(Number(sinkInput.owner_module)) &&
        checkIsSelectedProcess(readStreamProcessId(sinkInput))
      );
    });
    await streamsToMove.reduce(async (previousMove, sinkInput) => {
      await previousMove;
      const originalSinkName = sinkNamesByIndex.get(sinkInput.sink ?? -1) ?? '';
      const combineSink = await ensureCombineSink(originalSinkName);
      originalSinkNamesByStreamIndex.set(sinkInput.index, originalSinkName);
      await runCommand('pactl', [
        'move-sink-input',
        String(sinkInput.index),
        combineSink.sinkName,
      ]).catch(() => undefined);
    }, Promise.resolve());
  };

  const checkHasOwnCaptureStream = async (sources: PulseaudioSink[]) => {
    const monitorSourceIndex = sources.find((source) => source.name === monitorSourceName)?.index;
    const ownProcessIds = readOwnProcessIds();
    return (await readSourceOutputs()).some(
      (sourceOutput) =>
        sourceOutput.source === monitorSourceIndex &&
        ownProcessIds.has(readStreamProcessId(sourceOutput) ?? -1)
    );
  };

  const reconcile = async (): Promise<void> => {
    if (isReconciling) {
      isReconcileQueued = true;
      return;
    }
    isReconciling = true;
    try {
      const [sinks, sources, sinkInputs] = await Promise.all([
        readSinks(),
        readSources(),
        readSinkInputs(),
      ]);
      if (isStopped) return;
      if (await checkHasOwnCaptureStream(sources)) {
        hasHadCaptureStream = true;
      } else if (hasHadCaptureStream) {
        await stop();
        return;
      }
      await moveSelectedStreams(sinks, sinkInputs);
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

  const scheduleReconcileOnStreamEvents = (eventOutput: Buffer) => {
    if (STREAM_EVENT_PATTERN.test(eventOutput.toString())) scheduleReconcile();
  };

  stopActiveShareAudio = stop;
  subscribeProcess.once('error', () => {
    stop().catch(() => undefined);
  });
  subscribeProcess.stdin?.once('error', () => {
    stop().catch(() => undefined);
  });
  subscribeProcess.stdout?.on('data', scheduleReconcileOnStreamEvents);
  await reconcile();
};

export const startPulseaudioShareAudio = async (sourceId: string): Promise<string | undefined> => {
  await stopPulseaudioShareAudio();
  if (process.platform !== 'linux' || !(await checkIsPulseaudioAvailable())) return undefined;

  try {
    await unloadLeftoverShareModules();
    const selection = await findShareAudioSelection(sourceId);
    shareAudioSessionCount += 1;
    const shareSinkName = `${SHARE_SINK_NAME_PREFIX}${process.pid}_${shareAudioSessionCount}`;
    await startShareAudioSession(selection, shareSinkName);
    return `${shareSinkName}.monitor`;
  } catch {
    await stopPulseaudioShareAudio().catch(() => undefined);
    return undefined;
  }
};

export const unloadLeftoverPulseaudioShareModules = async (): Promise<void> => {
  if (process.platform !== 'linux' || !(await checkIsPulseaudioAvailable())) return;
  await unloadLeftoverShareModules().catch(() => undefined);
};
