import React from 'react';
import { Box, config } from 'folds';
import { Page, PageHero, PageHeroSection } from '../../components/page';
import LogoSVG from '../../../../public/res/svg/durnible.svg';

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
            icon={<img width="120" height="120" src={LogoSVG} alt="Durnible Logo" />}
            title="Welcome to Durnible"
            subTitle=""
          />
        </PageHeroSection>
      </Box>
    </Page>
  );
}
