import React, { lazy, Suspense } from 'react';
import { Box, Icon, Icons, Scroll } from 'folds';
import {
  Page,
  PageContent,
  PageContentCenter,
  PageHero,
  PageHeroSection,
} from '../../../components/page';
import { useRoomNavigate } from '../../../hooks/useRoomNavigate';

const CreateSpaceForm = lazy(() =>
  import('../../../features/create-space/CreateSpace').then((module) => ({
    default: module.CreateSpaceForm,
  }))
);

export function Create() {
  const { navigateSpace } = useRoomNavigate();

  return (
    <Page>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <PageContentCenter>
              <PageHeroSection>
                <Box direction="Column" gap="700">
                  <PageHero
                    icon={<Icon size="600" src={Icons.Space} />}
                    title="Create Space"
                    subTitle="Build a space for your community."
                  />
                  <Suspense fallback={null}>
                    <CreateSpaceForm onCreate={navigateSpace} />
                  </Suspense>
                </Box>
              </PageHeroSection>
            </PageContentCenter>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
