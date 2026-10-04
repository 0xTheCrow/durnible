import { expect } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { MOBILE_BREAKPOINT } from '../../src/app/styles/breakpoints';
import { CALL_TEST_USERS } from '../fixtures/callHomeserver';
import { callTest as test, joinVoiceRoom } from '../fixtures/call';

const MOBILE_VIEWPORT = { width: MOBILE_BREAKPOINT - 1, height: 800 };
const LAYOUT_TOLERANCE_PX = 1;

type DockEdges = {
  isAtLeft: boolean;
  isAtTop: boolean;
  isFullWidth: boolean;
  isFullHeight: boolean;
};

const readDockEdges = async (pane: Locator, pageContent: Locator): Promise<DockEdges> => {
  const paneBox = await pane.boundingBox();
  const contentBox = await pageContent.boundingBox();
  if (!paneBox || !contentBox) throw new Error('pane or page content is not rendered');
  const isClose = (first: number, second: number) =>
    Math.abs(first - second) <= LAYOUT_TOLERANCE_PX;
  return {
    isAtLeft: isClose(paneBox.x, contentBox.x),
    isAtTop: isClose(paneBox.y, contentBox.y),
    isFullWidth: isClose(paneBox.width, contentBox.width),
    isFullHeight: isClose(paneBox.height, contentBox.height),
  };
};

test('collapsing swaps the pane for the call bar, and expanding brings it back', async ({
  callSession,
}) => {
  const [voiceRoomId] = callSession.homeserver.voiceRoomIds;
  const alice = await callSession.openClient(CALL_TEST_USERS.alice);
  await joinVoiceRoom(alice.page, voiceRoomId);
  const callPane = alice.page.getByTestId('call-pane');
  const callBar = alice.page.getByTestId('call-bar');

  await alice.page.getByTestId('call-collapse').click();

  await expect(callPane).toBeHidden();
  await expect(callBar).toBeVisible();
  await expect(callBar.getByTestId('call-microphone-toggle')).toBeVisible();
  await expect(callBar.getByTestId('call-leave')).toBeVisible();

  await callBar.getByTestId('call-expand').click();

  await expect(callPane).toBeVisible();
  await expect(callBar).toBeHidden();
});

test('docking the pane to the left moves it there and keeps it there on the next call', async ({
  callSession,
}) => {
  const [voiceRoomId] = callSession.homeserver.voiceRoomIds;
  const alice = await callSession.openClient(CALL_TEST_USERS.alice);
  await joinVoiceRoom(alice.page, voiceRoomId);
  const callPane = alice.page.getByTestId('call-pane');
  const pageContent = alice.page.getByTestId('page-root-content');
  const leftDockEdges: DockEdges = {
    isAtLeft: true,
    isAtTop: true,
    isFullWidth: false,
    isFullHeight: true,
  };
  await expect.poll(() => readDockEdges(callPane, pageContent)).not.toEqual(leftDockEdges);

  await alice.page.getByTestId('call-pane-dock-menu').click();
  await alice.page.locator('[data-testid="call-pane-dock-option"][data-dock="Left"]').click();

  await expect.poll(() => readDockEdges(callPane, pageContent)).toEqual(leftDockEdges);

  await alice.page.getByTestId('call-leave').click();
  await joinVoiceRoom(alice.page, voiceRoomId);

  await expect.poll(() => readDockEdges(callPane, pageContent)).toEqual(leftDockEdges);
});

test('on a mobile viewport the call opens full screen and minimizes to the call bar', async ({
  callSession,
}) => {
  const [voiceRoomId] = callSession.homeserver.voiceRoomIds;
  const alice = await callSession.openClient(CALL_TEST_USERS.alice, {
    viewport: MOBILE_VIEWPORT,
  });

  await joinVoiceRoom(alice.page, voiceRoomId);

  const callScreen = alice.page.getByTestId('call-screen');
  await expect(callScreen).toBeVisible();

  await callScreen.getByTestId('call-minimize').click();

  await expect(callScreen).toBeHidden();
  await expect(alice.page.getByTestId('call-bar')).toBeVisible();
});
