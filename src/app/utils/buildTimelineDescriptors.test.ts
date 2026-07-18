import { RelationType } from 'matrix-js-sdk';
import { describe, it, expect, vi } from 'vitest';
import type { ImageContent } from '../../types/matrix/common';
import type { TimelineEventInput } from './buildTimelineDescriptors';
import { computeImageGroups, IMAGE_GROUP_MAX_SIZE } from './buildTimelineDescriptors';
import {
  MATRIX_GALLERY_ID_PROPERTY_NAME,
  MATRIX_GALLERY_INDEX_PROPERTY_NAME,
  MATRIX_LEGACY_GALLERY_ID_PROPERTY_NAME,
  MATRIX_LEGACY_GALLERY_INDEX_PROPERTY_NAME,
} from '../../types/matrix/common';
import { createMockMatrixEvent } from '../../test/mocks';

const MY_USER = '@me:example.com';
const OTHER_USER = '@alice:example.com';

const FAKE_TIMELINE_SET = {} as any;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function makeEvent(opts: {
  id: string;
  sender?: string;
  ts?: number;
  type?: string;
  isReaction?: boolean;
  content?: Record<string, unknown>;
}): TimelineEventInput {
  const base = createMockMatrixEvent({
    id: opts.id,
    sender: opts.sender ?? OTHER_USER,
    ts: opts.ts ?? 1000,
    type: opts.type ?? 'm.room.message',
    content: opts.content,
  });

  const mEvent = opts.isReaction
    ? {
        ...base,
        getRelation: vi.fn(() => ({ rel_type: RelationType.Annotation })),
      }
    : {
        ...base,
        getRelation: vi.fn(() => null),
      };

  return { mEvent: mEvent as any, mEventId: opts.id, timelineSet: FAKE_TIMELINE_SET, item: 0 };
}

function makeImageEvent(opts: {
  id: string;
  sender?: string;
  ts?: number;
  galleryId?: string;
  galleryIndex?: number;
  useLegacyProperties?: boolean;
}): TimelineEventInput {
  const content: Record<string, unknown> = {
    msgtype: 'm.image',
    body: 'image.png',
    url: `mxc://example.com/${opts.id}`,
    info: { w: 800, h: 600, mimetype: 'image/png' },
  };
  const idProperty = opts.useLegacyProperties
    ? MATRIX_LEGACY_GALLERY_ID_PROPERTY_NAME
    : MATRIX_GALLERY_ID_PROPERTY_NAME;
  const indexProperty = opts.useLegacyProperties
    ? MATRIX_LEGACY_GALLERY_INDEX_PROPERTY_NAME
    : MATRIX_GALLERY_INDEX_PROPERTY_NAME;
  if (opts.galleryId !== undefined) content[idProperty] = opts.galleryId;
  if (opts.galleryIndex !== undefined) content[indexProperty] = opts.galleryIndex;
  return makeEvent({
    id: opts.id,
    sender: opts.sender,
    ts: opts.ts,
    content,
  });
}

const urls = (contents: ImageContent[] | undefined): (string | undefined)[] | undefined =>
  contents?.map((content) => content.url);

describe('computeImageGroups', () => {
  it('groups two images sharing a gallery id and absorbs the follower into the anchor', () => {
    const { imageGroups, groupEventIds, absorbedToAnchor } = computeImageGroups([
      makeImageEvent({ id: '$A', ts: 1000, galleryId: 'b1', galleryIndex: 0 }),
      makeImageEvent({ id: '$B', ts: 2000, galleryId: 'b1', galleryIndex: 1 }),
    ]);
    expect(imageGroups.get('$A')?.length).toBe(2);
    expect(groupEventIds.get('$A')).toEqual(['$A', '$B']);
    expect(imageGroups.has('$B')).toBe(false);
    expect(absorbedToAnchor.get('$B')).toBe('$A');
  });

  it('groups legacy images carrying only the pre-rename gallery properties, in index order', () => {
    const { imageGroups } = computeImageGroups([
      makeImageEvent({
        id: '$A',
        ts: 1000,
        galleryId: 'b1',
        galleryIndex: 1,
        useLegacyProperties: true,
      }),
      makeImageEvent({
        id: '$B',
        ts: 2000,
        galleryId: 'b1',
        galleryIndex: 0,
        useLegacyProperties: true,
      }),
    ]);
    expect(urls(imageGroups.get('$A'))).toEqual(['mxc://example.com/$B', 'mxc://example.com/$A']);
  });

  it('does not group images whose gallery ids differ across the rename boundary', () => {
    const { imageGroups } = computeImageGroups([
      makeImageEvent({ id: '$A', ts: 1000, galleryId: 'b1', galleryIndex: 0 }),
      makeImageEvent({
        id: '$B',
        ts: 2000,
        galleryId: 'b2',
        galleryIndex: 1,
        useLegacyProperties: true,
      }),
    ]);
    expect(imageGroups.size).toBe(0);
  });

  it('does not group images with different gallery ids', () => {
    const { imageGroups } = computeImageGroups([
      makeImageEvent({ id: '$A', ts: 1000, galleryId: 'b1', galleryIndex: 0 }),
      makeImageEvent({ id: '$B', ts: 1001, galleryId: 'b2', galleryIndex: 0 }),
    ]);
    expect(imageGroups.size).toBe(0);
  });

  it('does not group images that lack a gallery id even with identical timestamps', () => {
    const { imageGroups } = computeImageGroups([
      makeImageEvent({ id: '$A', ts: 1000 }),
      makeImageEvent({ id: '$B', ts: 1000 }),
    ]);
    expect(imageGroups.size).toBe(0);
  });

  it('groups regardless of timestamp gap when the gallery id matches', () => {
    const { imageGroups } = computeImageGroups([
      makeImageEvent({ id: '$A', ts: 1000, galleryId: 'b1', galleryIndex: 0 }),
      makeImageEvent({ id: '$B', ts: 1000 + 60_000, galleryId: 'b1', galleryIndex: 1 }),
    ]);
    expect(imageGroups.get('$A')?.length).toBe(2);
  });

  it('caps a same-gallery run at IMAGE_GROUP_MAX_SIZE and starts a new group with the overflow', () => {
    const total = IMAGE_GROUP_MAX_SIZE + 2;
    const events: TimelineEventInput[] = [];
    for (let i = 0; i < total; i += 1) {
      events.push(
        makeImageEvent({ id: `$img${i}`, ts: 1000 + i, galleryId: 'b1', galleryIndex: i })
      );
    }
    const { imageGroups } = computeImageGroups(events);
    expect(imageGroups.get('$img0')?.length).toBe(IMAGE_GROUP_MAX_SIZE);
    expect(imageGroups.get(`$img${IMAGE_GROUP_MAX_SIZE}`)?.length).toBe(
      total - IMAGE_GROUP_MAX_SIZE
    );
  });

  it('does not group images from different senders even when the gallery id matches', () => {
    const { imageGroups } = computeImageGroups([
      makeImageEvent({ id: '$A', sender: OTHER_USER, ts: 1000, galleryId: 'b1', galleryIndex: 0 }),
      makeImageEvent({ id: '$B', sender: MY_USER, ts: 1001, galleryId: 'b1', galleryIndex: 1 }),
    ]);
    expect(imageGroups.size).toBe(0);
  });

  it('breaks a same-gallery run on an intervening non-image message', () => {
    const { imageGroups } = computeImageGroups([
      makeImageEvent({ id: '$A', ts: 1000, galleryId: 'b1', galleryIndex: 0 }),
      makeEvent({ id: '$txt', ts: 1500 }),
      makeImageEvent({ id: '$B', ts: 2000, galleryId: 'b1', galleryIndex: 1 }),
    ]);
    expect(imageGroups.size).toBe(0);
  });

  it('treats a reaction between same-gallery images as invisible and keeps the group intact', () => {
    const { imageGroups } = computeImageGroups([
      makeImageEvent({ id: '$A', ts: 1000, galleryId: 'b1', galleryIndex: 0 }),
      makeEvent({ id: '$reaction', isReaction: true, ts: 1500 }),
      makeImageEvent({ id: '$B', ts: 2000, galleryId: 'b1', galleryIndex: 1 }),
    ]);
    expect(imageGroups.get('$A')?.length).toBe(2);
  });

  it('does not group same-gallery images that span a day boundary', () => {
    const { imageGroups } = computeImageGroups([
      makeImageEvent({ id: '$A', ts: 1000, galleryId: 'b1', galleryIndex: 0 }),
      makeImageEvent({ id: '$B', ts: 1000 + ONE_DAY_MS, galleryId: 'b1', galleryIndex: 1 }),
    ]);
    expect(imageGroups.size).toBe(0);
  });

  it('orders grouped contents by gallery index, not timeline order', () => {
    const { imageGroups } = computeImageGroups([
      makeImageEvent({ id: '$A', ts: 1000, galleryId: 'b1', galleryIndex: 2 }),
      makeImageEvent({ id: '$B', ts: 1000, galleryId: 'b1', galleryIndex: 0 }),
      makeImageEvent({ id: '$C', ts: 1000, galleryId: 'b1', galleryIndex: 1 }),
    ]);
    expect(urls(imageGroups.get('$A'))).toEqual([
      'mxc://example.com/$B',
      'mxc://example.com/$C',
      'mxc://example.com/$A',
    ]);
  });
});
