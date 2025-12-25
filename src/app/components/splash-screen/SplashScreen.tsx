import { Box, Text } from 'folds';
import React, { ReactNode } from 'react';
import classNames from 'classnames';
import * as patternsCSS from '../../styles/Patterns.css';
import * as css from './SplashScreen.css';
import { useTranslation } from '../../internationalization';

type SplashScreenProps = {
  children: ReactNode;
};
export function SplashScreen({ children }: SplashScreenProps) {
  const [t] = useTranslation();

  return (
    <Box
      className={classNames(css.SplashScreen, patternsCSS.BackgroundDotPattern)}
      direction="Column"
    >
      {children}
      <Box
        className={css.SplashScreenFooter}
        shrink="No"
        alignItems="Center"
        justifyContent="Center"
      >
        <Text size="H2" align="Center">
          {t.SplashScreen.title}
        </Text>
      </Box>
    </Box>
  );
}
