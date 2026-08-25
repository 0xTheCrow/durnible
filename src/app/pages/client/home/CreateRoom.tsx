import React, { lazy, Suspense } from 'react';
import { Box, Icon, Icons, Scroll, IconButton } from 'folds';
import {
  Page,
  PageContent,
  PageContentCenter,
  PageHeader,
  PageHero,
  PageHeroSection,
} from '../../../components/page';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { BackRouteHandler } from '../../../components/BackRouteHandler';
import { useRoomNavigate } from '../../../hooks/useRoomNavigate';

const CreateRoomForm = lazy(() =>
  import('../../../features/create-room/CreateRoom').then((module) => ({
    default: module.CreateRoomForm,
  }))
);

export function HomeCreateRoom() {
  const screenSize = useScreenSizeContext();

  const { navigateRoom } = useRoomNavigate();

  return (
    <Page>
      {screenSize === ScreenSize.Mobile && (
        <PageHeader balance outlined={false}>
          <Box grow="Yes" alignItems="Center" gap="200">
            <BackRouteHandler>
              {(onBack) => (
                <IconButton onClick={onBack}>
                  <Icon src={Icons.ArrowLeft} />
                </IconButton>
              )}
            </BackRouteHandler>
          </Box>
        </PageHeader>
      )}
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <PageContentCenter>
              <PageHeroSection>
                <Box direction="Column" gap="700">
                  <PageHero
                    icon={<Icon size="600" src={Icons.Hash} />}
                    title="Create Room"
                    subTitle="Build a Room for Real-Time Conversations."
                  />
                  <Suspense fallback={null}>
                    <CreateRoomForm onCreate={navigateRoom} />
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
