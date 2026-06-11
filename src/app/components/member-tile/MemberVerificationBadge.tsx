import React from 'react';
import { Box, color, Icon, Icons } from 'folds';
import type { MatrixClient } from 'matrix-js-sdk';
import { useUserVerificationStatus } from '../../hooks/useUserVerificationStatus';
import { VerificationStatus } from '../../hooks/useDeviceVerificationStatus';

type MemberVerificationBadgeProps = {
  mx: MatrixClient;
  userId: string;
};
export function MemberVerificationBadge({ mx, userId }: MemberVerificationBadgeProps) {
  const status = useUserVerificationStatus(mx.getCrypto(), userId);

  if (status === VerificationStatus.Verified) {
    return (
      <Box as="span" shrink="No" alignItems="Center" aria-label="Verified" title="Verified">
        <Icon size="50" src={Icons.ShieldUser} style={{ color: color.Success.Main }} />
      </Box>
    );
  }

  if (status === VerificationStatus.Unverified) {
    return (
      <Box as="span" shrink="No" alignItems="Center" aria-label="Not verified" title="Not verified">
        <Icon size="50" src={Icons.Shield} style={{ color: color.Critical.Main }} />
      </Box>
    );
  }

  return null;
}
