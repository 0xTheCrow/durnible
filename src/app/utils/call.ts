import type { Room } from 'matrix-js-sdk';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';
import { getMemberDisplayName } from './room';

export type CallParticipantMembership = Pick<CallMembership, 'userId'> & {
  isExpired: () => boolean;
};

export type CallIdentityMembership = Pick<
  CallMembership,
  'userId' | 'memberId' | 'rtcBackendIdentity'
>;

export const findCallParticipantUserId = (
  livekitIdentity: string,
  memberships: CallIdentityMembership[]
): string | undefined =>
  memberships.find(
    (membership) =>
      membership.rtcBackendIdentity === livekitIdentity || membership.memberId === livekitIdentity
  )?.userId;

export type ResolvedCallParticipant = {
  userId: string | undefined;
  displayName: string;
};

export const resolveCallParticipant = (
  room: Room,
  livekitIdentity: string,
  memberships: CallIdentityMembership[]
): ResolvedCallParticipant => {
  const userId = findCallParticipantUserId(livekitIdentity, memberships);
  return {
    userId,
    displayName: userId ? getMemberDisplayName(room, userId) ?? userId : livekitIdentity,
  };
};

export const CALL_TILE_ASPECT_RATIO = 16 / 9;
export const CALL_TILE_MIN_WIDTH = 120;
export const CALL_TILE_GAP = 8;
export const CALL_TILE_OVERFLOW_ROW_HEIGHT = 40;

export type CallTileGridLayout = {
  columnCount: number;
  tileWidth: number;
  tileHeight: number;
  visibleTileCount: number;
};

const getWidestTileFit = (
  tileCount: number,
  containerWidth: number,
  containerHeight: number
): { columnCount: number; tileWidth: number } => {
  let widestFit = { columnCount: 1, tileWidth: 0 };

  for (let columnCount = 1; columnCount <= tileCount; columnCount += 1) {
    const rowCount = Math.ceil(tileCount / columnCount);
    const availableWidth = containerWidth - CALL_TILE_GAP * (columnCount - 1);
    const availableHeight = containerHeight - CALL_TILE_GAP * (rowCount - 1);
    const tileWidth = Math.max(
      0,
      Math.min(availableWidth / columnCount, (availableHeight / rowCount) * CALL_TILE_ASPECT_RATIO)
    );
    if (tileWidth > widestFit.tileWidth) widestFit = { columnCount, tileWidth };
  }

  return widestFit;
};

const withTileHeight = (
  fit: { columnCount: number; tileWidth: number },
  visibleTileCount: number
): CallTileGridLayout => ({
  ...fit,
  tileHeight: Math.round(fit.tileWidth / CALL_TILE_ASPECT_RATIO),
  visibleTileCount,
});

export const getCallTileGridLayout = (
  tileCount: number,
  containerWidth: number,
  containerHeight: number
): CallTileGridLayout => {
  if (tileCount <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { columnCount: 1, tileWidth: 0, tileHeight: 0, visibleTileCount: 0 };
  }

  const fullFit = getWidestTileFit(tileCount, containerWidth, containerHeight);
  if (fullFit.tileWidth >= CALL_TILE_MIN_WIDTH || tileCount === 1) {
    return withTileHeight(fullFit, tileCount);
  }

  const truncatedHeight = containerHeight - CALL_TILE_OVERFLOW_ROW_HEIGHT - CALL_TILE_GAP;
  for (let visibleTileCount = tileCount - 1; visibleTileCount >= 1; visibleTileCount -= 1) {
    const truncatedFit = getWidestTileFit(visibleTileCount, containerWidth, truncatedHeight);
    if (truncatedFit.tileWidth >= CALL_TILE_MIN_WIDTH) {
      return withTileHeight(truncatedFit, visibleTileCount);
    }
  }

  return withTileHeight(getWidestTileFit(1, containerWidth, truncatedHeight), 1);
};

export const getActiveCallParticipantIds = (memberships: CallParticipantMembership[]): string[] => {
  const seenUserIds = new Set<string>();
  const participantIds: string[] = [];

  memberships.forEach((membership) => {
    if (membership.isExpired()) return;
    if (seenUserIds.has(membership.userId)) return;
    seenUserIds.add(membership.userId);
    participantIds.push(membership.userId);
  });

  return participantIds;
};
