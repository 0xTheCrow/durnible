import React from 'react';
import { Box, Button, Icon, Icons, Spinner, Text, config } from 'folds';

type SelectionActionBarProps = {
  selectedCount: number;
  onDelete: () => void;
  onCancel: () => void;
  deleting?: boolean;
};

export function SelectionActionBar({
  selectedCount,
  onDelete,
  onCancel,
  deleting,
}: SelectionActionBarProps) {
  return (
    <Box
      alignItems="Center"
      gap="300"
      style={{ padding: `${config.space.S200} ${config.space.S400}` }}
    >
      <Text size="T300" priority="300">
        {selectedCount} selected
      </Text>
      <Button
        size="300"
        variant="Critical"
        radii="300"
        before={deleting ? <Spinner size="100" /> : <Icon size="100" src={Icons.Delete} />}
        onClick={onDelete}
        disabled={deleting}
      >
        <Text size="B300">{deleting ? 'Deleting...' : 'Delete'}</Text>
      </Button>
      <Button
        size="300"
        variant="Secondary"
        radii="300"
        onClick={onCancel}
        disabled={deleting}
      >
        <Text size="B300">Cancel</Text>
      </Button>
    </Box>
  );
}
