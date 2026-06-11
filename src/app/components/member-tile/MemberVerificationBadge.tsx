import React from 'react';
import { Box, color, Icon, Icons } from 'folds';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  CrossSigningStatus,
  useUserCrossSigningStatus,
} from '../../hooks/useUserCrossSigningStatus';

type MemberVerificationBadgeProps = {
  mx: MatrixClient;
  userId: string;
};
export function MemberVerificationBadge({ mx, userId }: MemberVerificationBadgeProps) {
  const status = useUserCrossSigningStatus(mx.getCrypto(), userId);

  if (status === CrossSigningStatus.Complete) {
    return (
      <Box as="span" shrink="No" alignItems="Center" aria-label="Verified" title="Verified">
        <Icon size="50" src={Icons.ShieldUser} style={{ color: color.Success.Main }} />
      </Box>
    );
  }

  if (status === CrossSigningStatus.Incomplete) {
    return (
      <Box as="span" shrink="No" alignItems="Center" aria-label="Not verified" title="Not verified">
        <Icon size="50" src={Icons.Shield} style={{ color: color.Critical.Main }} />
      </Box>
    );
  }

  return null;
}
