import React from 'react';
import { Box, config } from 'folds';
import { Page, PageHero, PageHeroSection } from '../../components/page';
import CinnySVG from '../../../../public/res/svg/cinny.svg';

export function WelcomePage() {
  return (
    <Page>
      <Box
        data-testid="welcome-page"
        grow="Yes"
        style={{ padding: config.space.S400, paddingBottom: config.space.S700 }}
        alignItems="Center"
        justifyContent="Center"
      >
        <PageHeroSection>
          <PageHero
            icon={<img width="70" height="70" src={CinnySVG} alt="Durnible Logo" />}
            title="Welcome to Durnible"
            subTitle="Yet another matrix client."
          />
        </PageHeroSection>
      </Box>
    </Page>
  );
}
