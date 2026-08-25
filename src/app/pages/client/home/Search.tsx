import React, { lazy, Suspense, useRef } from 'react';
import { Box, Icon, Icons, Text, Scroll, IconButton } from 'folds';
import { Page, PageContent, PageContentCenter, PageHeader } from '../../../components/page';
import { useHomeRooms } from './useHomeRooms';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { BackRouteHandler } from '../../../components/BackRouteHandler';

const MessageSearch = lazy(() =>
  import('../../../features/message-search').then((module) => ({ default: module.MessageSearch }))
);

export function HomeSearch() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rooms = useHomeRooms();
  const screenSize = useScreenSizeContext();

  return (
    <Page>
      <PageHeader balance>
        <Box grow="Yes" alignItems="Center" gap="200">
          <Box grow="Yes" basis="No">
            {screenSize === ScreenSize.Mobile && (
              <BackRouteHandler>
                {(onBack) => (
                  <IconButton onClick={onBack}>
                    <Icon src={Icons.ArrowLeft} />
                  </IconButton>
                )}
              </BackRouteHandler>
            )}
          </Box>
          <Box justifyContent="Center" alignItems="Center" gap="200">
            {screenSize !== ScreenSize.Mobile && <Icon size="400" src={Icons.Search} />}
            <Text size="H3" truncate>
              Message Search
            </Text>
          </Box>
          <Box grow="Yes" basis="No" />
        </Box>
      </PageHeader>
      <Box style={{ position: 'relative' }} grow="Yes">
        <Scroll ref={scrollRef} hideTrack visibility="Hover">
          <PageContent>
            <PageContentCenter>
              <Suspense fallback={null}>
                <MessageSearch
                  defaultRoomsFilterName="Home"
                  allowGlobal
                  rooms={rooms}
                  scrollRef={scrollRef}
                />
              </Suspense>
            </PageContentCenter>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
