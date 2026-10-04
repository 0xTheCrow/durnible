import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type {} from '../../src/app/plugins/call/popOutWindow';
import type { CallClient } from '../fixtures/call';
import {
  MEDIA_FLOW_TIMEOUT_MS,
  callTest as test,
  connectBobThenAlice,
  getCallTile,
  readDecodedFrameCount,
} from '../fixtures/call';

const POP_OUT_VIDEO_TEST_ID = 'call-pop-out-video';

const checkIsPopOutWindowOpen = (page: Page): Promise<boolean> =>
  page.evaluate(() => Boolean(window.documentPictureInPicture?.window));

const readPopOutDecodedFrameCount = (page: Page): Promise<number> =>
  page.evaluate((videoTestId) => {
    const popOutVideo =
      window.documentPictureInPicture?.window?.document.querySelector<HTMLVideoElement>(
        `[data-testid="${videoTestId}"]`
      );
    return popOutVideo?.getVideoPlaybackQuality().totalVideoFrames ?? 0;
  }, POP_OUT_VIDEO_TEST_ID);

const expectPopOutToKeepPlaying = async (page: Page): Promise<void> => {
  await expect
    .poll(() => readPopOutDecodedFrameCount(page), { timeout: MEDIA_FLOW_TIMEOUT_MS })
    .toBeGreaterThan(0);
  const framesSoFar = await readPopOutDecodedFrameCount(page);
  await expect
    .poll(() => readPopOutDecodedFrameCount(page), { timeout: MEDIA_FLOW_TIMEOUT_MS })
    .toBeGreaterThan(framesSoFar);
};

const startCameraAndWaitForVideo = async (
  sender: CallClient,
  senderTileOnReceiver: Locator
): Promise<void> => {
  await sender.page.getByTestId('call-camera-toggle').click();
  const senderVideoOnReceiver = senderTileOnReceiver.getByTestId('call-tile-video');
  await expect(senderVideoOnReceiver).toBeVisible({ timeout: MEDIA_FLOW_TIMEOUT_MS });
  await expect
    .poll(() => readDecodedFrameCount(senderVideoOnReceiver), { timeout: MEDIA_FLOW_TIMEOUT_MS })
    .toBeGreaterThan(0);
};

const popOutAliceOnBob = async ({ alice, bob }: { alice: CallClient; bob: CallClient }) => {
  const aliceTileOnBob = getCallTile(bob.page, alice.user.userId);
  await startCameraAndWaitForVideo(alice, aliceTileOnBob);
  await aliceTileOnBob.getByTestId('call-tile-pop-out-toggle').click();
  await expectPopOutToKeepPlaying(bob.page);
  return aliceTileOnBob;
};

test('popping out a stream plays it in the pop-out window, and the toggle closes it', async ({
  callSession,
}) => {
  const { alice, bob } = await connectBobThenAlice(callSession);
  const aliceTileOnBob = await popOutAliceOnBob({ alice, bob });
  const popOutToggle = aliceTileOnBob.getByTestId('call-tile-pop-out-toggle');
  const popOutPlaceholder = aliceTileOnBob.getByTestId('call-tile-pop-out-placeholder');

  await expect(popOutPlaceholder).toBeVisible();
  await expect(popOutToggle).toHaveAttribute('aria-pressed', 'true');

  await popOutToggle.click();

  await expect.poll(() => checkIsPopOutWindowOpen(bob.page)).toBe(false);
  await expect(popOutPlaceholder).toBeHidden();
  await expect(popOutToggle).toHaveAttribute('aria-pressed', 'false');
});

test('closing the pop-out window itself clears the pop-out from the tile', async ({
  callSession,
}) => {
  const { alice, bob } = await connectBobThenAlice(callSession);
  const aliceTileOnBob = await popOutAliceOnBob({ alice, bob });

  await bob.page.evaluate(() => window.documentPictureInPicture?.window?.close());

  await expect(aliceTileOnBob.getByTestId('call-tile-pop-out-placeholder')).toBeHidden();
  await expect(aliceTileOnBob.getByTestId('call-tile-pop-out-toggle')).toHaveAttribute(
    'aria-pressed',
    'false'
  );
});

test('a popped-out stream turning off closes its pop-out window', async ({ callSession }) => {
  const { alice, bob } = await connectBobThenAlice(callSession);
  await popOutAliceOnBob({ alice, bob });

  await alice.page.getByTestId('call-camera-toggle').click();

  await expect
    .poll(() => checkIsPopOutWindowOpen(bob.page), { timeout: MEDIA_FLOW_TIMEOUT_MS })
    .toBe(false);
});

test('a popped-out stream keeps playing after switching to a room outside the space', async ({
  callSession,
}) => {
  const { alice, bob } = await connectBobThenAlice(callSession);
  await popOutAliceOnBob({ alice, bob });
  const homeRoomEntry = bob.page.locator(
    `[data-testid="room-nav-entry"][data-room-id="${callSession.homeserver.homeRoomId}"]`
  );

  await bob.page.getByTestId('sidebar-home-tab').click();
  await homeRoomEntry.click();
  await expect(homeRoomEntry).toHaveAttribute('aria-selected', 'true');

  await expectPopOutToKeepPlaying(bob.page);
});

test('tiles in the spotlight strip offer no pop-out', async ({ callSession }) => {
  const { alice, bob } = await connectBobThenAlice(callSession);
  const aliceTileOnBob = getCallTile(bob.page, alice.user.userId);
  await startCameraAndWaitForVideo(alice, aliceTileOnBob);
  await startCameraAndWaitForVideo(bob, getCallTile(bob.page, bob.user.userId));

  await aliceTileOnBob.click();

  const ownStripTileOnBob = bob.page
    .getByTestId('call-tile-strip')
    .locator(getCallTile(bob.page, bob.user.userId));
  await expect(ownStripTileOnBob.getByTestId('call-tile-video')).toBeVisible();
  await expect(ownStripTileOnBob.getByTestId('call-tile-pop-out-toggle')).toBeHidden();
});
