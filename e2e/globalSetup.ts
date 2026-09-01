import type { FullConfig } from '@playwright/test';
import { chromium, expect } from '@playwright/test';
import {
  TEST_ROOM_ID,
  audioEvent,
  imageEvent,
  seedSession,
  stubHomeserver,
  textEvent,
  videoEvent,
} from './fixtures/homeserver';

// Vite's source-transform cache is in-memory and dies with the dev server, so every run starts
// cold and the first specs to reach it race the transforms.
const globalSetup = async (config: FullConfig): Promise<void> => {
  const baseURL = config.projects[0]?.use.baseURL;
  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    await seedSession(context);
    await stubHomeserver(page, {
      timelineEvents: [textEvent(0), imageEvent(0, 320, 240), audioEvent(), videoEvent()],
    });

    await page.goto(`/home/${encodeURIComponent(TEST_ROOM_ID)}/`);
    await expect(page.getByTestId('editor')).toBeVisible();
  } finally {
    await browser.close();
  }
};

export default globalSetup;
