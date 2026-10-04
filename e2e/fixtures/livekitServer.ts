import { execFile } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { promisify } from 'node:util';

const runCommand = promisify(execFile);

const LIVEKIT_IMAGE = 'livekit/livekit-server:v1.13.7';
const LIVEKIT_CONTAINER_NAME = 'durnible-e2e-livekit';
const LIVEKIT_HOST = '127.0.0.1';
const LIVEKIT_PORT = 7880;
const LIVEKIT_DEV_API_KEY = 'devkey';
const LIVEKIT_DEV_API_SECRET = 'secret';
const LIVEKIT_READY_TIMEOUT_MS = 30_000;
const LIVEKIT_READY_POLL_MS = 250;
const LIVEKIT_TOKEN_LIFETIME_SECONDS = 60 * 60;

export const LIVEKIT_URL = `ws://${LIVEKIT_HOST}:${LIVEKIT_PORT}`;
const LIVEKIT_HTTP_URL = `http://${LIVEKIT_HOST}:${LIVEKIT_PORT}`;

const checkIsLivekitContainerRunning = async (): Promise<boolean> => {
  const { stdout } = await runCommand('docker', [
    'ps',
    '--filter',
    `name=^${LIVEKIT_CONTAINER_NAME}$`,
    '--format',
    '{{.Names}}',
  ]);
  return stdout.trim() === LIVEKIT_CONTAINER_NAME;
};

const checkIsLivekitReady = async (): Promise<boolean> => {
  try {
    const response = await fetch(LIVEKIT_HTTP_URL);
    return response.ok;
  } catch {
    return false;
  }
};

const waitForLivekitReady = async (
  deadline = Date.now() + LIVEKIT_READY_TIMEOUT_MS
): Promise<void> => {
  if (await checkIsLivekitReady()) return;
  if (Date.now() >= deadline) {
    throw new Error(`LiveKit did not become ready at ${LIVEKIT_HTTP_URL}`);
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, LIVEKIT_READY_POLL_MS);
  });
  await waitForLivekitReady(deadline);
};

/**
 * Starts the LiveKit SFU the call specs connect to, unless one from an earlier run is still up.
 * Requires Docker. Resolves to a function that stops the container, or does nothing when the
 * container was already running before this call.
 */
export const startLivekitServer = async (): Promise<() => Promise<void>> => {
  if (await checkIsLivekitContainerRunning()) {
    await waitForLivekitReady();
    return async () => undefined;
  }

  try {
    await runCommand('docker', [
      'run',
      '--detach',
      '--rm',
      '--name',
      LIVEKIT_CONTAINER_NAME,
      '--network',
      'host',
      LIVEKIT_IMAGE,
      '--dev',
      '--bind',
      LIVEKIT_HOST,
      '--node-ip',
      LIVEKIT_HOST,
    ]);
  } catch (error) {
    throw new Error(`Could not start the LiveKit container (is Docker running?): ${error}`);
  }
  await waitForLivekitReady();

  return async () => {
    await runCommand('docker', ['stop', LIVEKIT_CONTAINER_NAME]);
  };
};

const encodeBase64Url = (value: string | Buffer): string =>
  Buffer.from(value).toString('base64url');

export const createLivekitToken = (identity: string, roomName: string): string => {
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64Url(
    JSON.stringify({
      iss: LIVEKIT_DEV_API_KEY,
      sub: identity,
      iat: issuedAtSeconds,
      nbf: issuedAtSeconds,
      exp: issuedAtSeconds + LIVEKIT_TOKEN_LIFETIME_SECONDS,
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    })
  );
  const signature = encodeBase64Url(
    createHmac('sha256', LIVEKIT_DEV_API_SECRET).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${signature}`;
};
