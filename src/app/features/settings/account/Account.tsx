import React from 'react';
import { Box, Scroll } from 'folds';
import { Page, PageContent } from '../../../components/page';
import { MatrixId } from './MatrixId';
import { Profile } from './Profile';
import { ContactInformation } from './ContactInfo';
import { IgnoredUserList } from './IgnoredUserList';
import { SettingsPageHeader } from '../components';

type AccountProps = {
  onBack: () => void;
  onClose: () => void;
};
export function Account({ onBack, onClose }: AccountProps) {
  return (
    <Page>
      <SettingsPageHeader title="Account" onBack={onBack} onClose={onClose} />
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <Profile />
              <MatrixId />
              <ContactInformation />
              <IgnoredUserList />
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
