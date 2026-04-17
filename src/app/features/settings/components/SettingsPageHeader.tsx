import React from 'react';
import { Box, Icon, IconButton, Icons, Text } from 'folds';
import { PageHeader } from '../../../components/page';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';

type SettingsPageHeaderProps = {
  title: string;
  onBack: () => void;
  onClose: () => void;
};

export function SettingsPageHeader({ title, onBack, onClose }: SettingsPageHeaderProps) {
  const isMobile = useScreenSizeContext() === ScreenSize.Mobile;

  return (
    <PageHeader outlined={false}>
      <Box grow="Yes" gap="200">
        {isMobile && (
          <Box shrink="No">
            <IconButton onClick={onBack} variant="Surface" aria-label="Back to settings">
              <Icon src={Icons.ArrowLeft} />
            </IconButton>
          </Box>
        )}
        <Box grow="Yes" alignItems="Center" gap="200">
          <Text size="H3" truncate>
            {title}
          </Text>
        </Box>
        <Box shrink="No">
          <IconButton onClick={onClose} variant="Surface" aria-label="Close settings">
            <Icon src={Icons.Cross} />
          </IconButton>
        </Box>
      </Box>
    </PageHeader>
  );
}
