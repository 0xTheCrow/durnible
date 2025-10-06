import React from 'react';
import { Box, Text, Icon, Icons, Button, MenuItem } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { CutoutCard } from '../../../components/cutout-card';

type AccountDataListProps = {
  title?: string;
  description?: string;
  expand: boolean;
  setExpand: (expand: boolean) => void;
  types: string[];
  onSelect: (type: string | null) => void;
};
export function AccountDataList({ types, onSelect, expand, setExpand, title, description }: AccountDataListProps) {
  return (
    <SequenceCard
      className={SequenceCardStyle}
      variant="SurfaceVariant"
      direction="Column"
      gap="400"
    >
      <SettingTile
        title={title}
        description={description}
        after={
          <Button
            onClick={() => setExpand(!expand)}
            variant="Secondary"
            fill="Soft"
            size="300"
            radii="300"
            outlined
            before={
              <Icon src={expand ? Icons.ChevronTop : Icons.ChevronBottom} size="100" filled />
            }
          >
            <Text size="B300">{expand ? 'Collapse' : 'Expand'}</Text>
          </Button>
        }
      />
      {expand && (
        <Box direction="Column" gap="100">
          <Box justifyContent="SpaceBetween">
            <Text size="L400">Fields</Text>
            <Text size="L400">Total: {types.length}</Text>
          </Box>
          <CutoutCard>
            <MenuItem
              variant="Surface"
              fill="None"
              size="300"
              radii="0"
              before={<Icon size="50" src={Icons.Plus} />}
              onClick={() => onSelect(null)}
            >
              <Box grow="Yes">
                <Text size="T200" truncate>
                  Add New
                </Text>
              </Box>
            </MenuItem>
            {types.sort().map((type) => (
              <MenuItem
                key={type}
                variant="Surface"
                fill="None"
                size="300"
                radii="0"
                after={<Icon size="50" src={Icons.ChevronRight} />}
                onClick={() => onSelect(type)}
              >
                <Box grow="Yes">
                  <Text size="T200" truncate>
                    {type}
                  </Text>
                </Box>
              </MenuItem>
            ))}
          </CutoutCard>
        </Box>
      )}
    </SequenceCard>
  );
}
