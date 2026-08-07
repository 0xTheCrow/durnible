import type { ReactNode } from 'react';
import React from 'react';
import classNames from 'classnames';
import { Box, Header, Icon, Icons, Text, as } from 'folds';
import * as css from '../../styles/mediaFrame.css';

export type MediaFrameProps = {
  name: string;
  onClose: () => void;
  expanded?: boolean;
  headerAfter?: ReactNode;
  closeButtonTestId?: string;
  nameTestId?: string;
};

export const MediaFrame = as<'div', MediaFrameProps>(
  (
    {
      className,
      name,
      onClose,
      expanded,
      headerAfter,
      closeButtonTestId,
      nameTestId,
      children,
      ...props
    },
    ref
  ) => (
    <Box
      className={classNames(css.Frame, expanded && css.FrameExpanded, className)}
      direction="Column"
      {...props}
      ref={ref}
    >
      <Header className={css.Header} size="500">
        <button
          type="button"
          data-testid={closeButtonTestId}
          className={css.CloseButton}
          onClick={onClose}
          aria-label="Close"
        >
          <Icon size="200" src={Icons.ArrowLeft} />
        </button>
        <Box grow="Yes" alignItems="Center" gap="300">
          <Text size="T400" truncate data-testid={nameTestId}>
            {name}
          </Text>
        </Box>
        {headerAfter}
      </Header>
      {children}
    </Box>
  )
);

export function MediaFrameContent({ children }: { children: ReactNode }) {
  return (
    <Box grow="Yes" className={css.Content} alignItems="Center" justifyContent="Center">
      {children}
    </Box>
  );
}
