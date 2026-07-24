import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';

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
