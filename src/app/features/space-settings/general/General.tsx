import React from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Text } from 'folds';
import { Page, PageContent, PageHeader } from '../../../components/page';
import {
  RoomProfile,
  RoomJoinRules,
  RoomLocalAddresses,
  RoomPublishedAddresses,
  RoomPublish,
  RoomUpgrade,
} from '../../common-settings/general';
import { useRoomSettingsPermissions } from '../../common-settings/useRoomSettingsPermissions';

type GeneralProps = {
  onClose: () => void;
};
export function General({ onClose }: GeneralProps) {
  const permissions = useRoomSettingsPermissions();

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              General
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={onClose} variant="Surface">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <RoomProfile permissions={permissions} />
              <Box direction="Column" gap="100">
                <Text size="L400">Options</Text>
                <RoomJoinRules permissions={permissions} />
                <RoomPublish permissions={permissions} />
              </Box>
              <Box direction="Column" gap="100">
                <Text size="L400">Addresses</Text>
                <RoomPublishedAddresses permissions={permissions} />
                <RoomLocalAddresses permissions={permissions} />
              </Box>
              <Box direction="Column" gap="100">
                <Text size="L400">Advanced Options</Text>
                <RoomUpgrade permissions={permissions} onClose={onClose} />
              </Box>
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
