import React, { useCallback, useEffect } from 'react';
import { Box, Text, Chip } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';

import { useTranslation } from '../../../internationalization';

export function ContactInformation() {
  const [t] = useTranslation();
  const mx = useMatrixClient();
  const [threePIdsState, loadThreePIds] = useAsyncCallback(
    useCallback(() => mx.getThreePids(), [mx])
  );
  const threePIds =
    threePIdsState.status === AsyncStatus.Success ? threePIdsState.data.threepids : undefined;

  const emailIds = threePIds?.filter((id) => id.medium === 'email');

  useEffect(() => {
    loadThreePIds();
  }, [loadThreePIds]);

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">{t.Settings.Account.ContactInfo.title}</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title={t.Settings.Account.ContactInfo.emailAddress}
          description={t.Settings.Account.ContactInfo.emailAddressDescription}
        >
          <Box>
            {emailIds?.map((email) => (
              <Chip key={email.address} as="span" variant="Secondary" radii="Pill">
                <Text size="T200">{email.address}</Text>
              </Chip>
            ))}
          </Box>
          {/* <Input defaultValue="" variant="Secondary" radii="300" /> */}
        </SettingTile>
      </SequenceCard>
    </Box>
  );
}
