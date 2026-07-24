import { useMemo } from 'react';
import type { Room } from 'matrix-js-sdk';
import { useCallMemberships } from '../useCallMemberships';
import { getActiveCallParticipantIds } from '../../utils/call';

export const useActiveCallParticipantIds = (room: Room): string[] => {
  const memberships = useCallMemberships(room);

  return useMemo(() => getActiveCallParticipantIds(memberships), [memberships]);
};
