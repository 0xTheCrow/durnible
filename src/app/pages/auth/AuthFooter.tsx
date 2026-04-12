import React from 'react';
import { Box, Text } from 'folds';
import * as css from './styles.css';

export function AuthFooter() {
  return (
    <Box
      data-testid="auth-footer"
      className={css.AuthFooter}
      justifyContent="Center"
      gap="400"
      wrap="Wrap"
    >
      <Text
        as="a"
        size="T300"
        href="https://cinny.in"
        target="_blank"
        rel="noreferrer"
        data-testid="auth-footer-about-link"
      >
        About
      </Text>
      <Text
        as="a"
        size="T300"
        href="https://github.com/ajbura/cinny/releases"
        target="_blank"
        rel="noreferrer"
        data-testid="auth-footer-version-link"
      >
        v4.10.2
      </Text>
      <Text
        as="a"
        size="T300"
        href="https://twitter.com/cinnyapp"
        target="_blank"
        rel="noreferrer"
        data-testid="auth-footer-twitter-link"
      >
        Twitter
      </Text>
      <Text
        as="a"
        size="T300"
        href="https://matrix.org"
        target="_blank"
        rel="noreferrer"
        data-testid="auth-footer-matrix-link"
      >
        Powered by Matrix
      </Text>
    </Box>
  );
}
