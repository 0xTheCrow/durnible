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
