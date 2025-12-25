import React from 'react';
import { Box, Text, Icon, Icons, config, IconSrc } from 'folds';
import { SequenceCard } from '../sequence-card';
import { SettingTile } from '../setting-tile';
import { useTranslation } from '../../internationalization';

export enum CreateRoomKind {
  Private = 'private',
  Restricted = 'restricted',
  Public = 'public',
}
type CreateRoomKindSelectorProps = {
  value?: CreateRoomKind;
  onSelect: (value: CreateRoomKind) => void;
  canRestrict?: boolean;
  disabled?: boolean;
  getIcon: (kind: CreateRoomKind) => IconSrc;
};
export function CreateRoomKindSelector({
  value,
  onSelect,
  canRestrict,
  disabled,
  getIcon,
}: CreateRoomKindSelectorProps) {
  const [t] = useTranslation();
  return (
    <Box shrink="No" direction="Column" gap="100">
      {canRestrict && (
        <SequenceCard
          style={{ padding: config.space.S300 }}
          variant={value === CreateRoomKind.Restricted ? 'Primary' : 'SurfaceVariant'}
          direction="Column"
          gap="100"
          as="button"
          type="button"
          aria-pressed={value === CreateRoomKind.Restricted}
          onClick={() => onSelect(CreateRoomKind.Restricted)}
          disabled={disabled}
        >
          <SettingTile
            before={<Icon size="400" src={getIcon(CreateRoomKind.Restricted)} />}
            after={value === CreateRoomKind.Restricted && <Icon src={Icons.Check} />}
          >
            <Text size="H6">{t.CreateRoomKindSelector.restrictedTitle}</Text>
            <Text size="T300" priority="300">
              {t.CreateRoomKindSelector.restrictedDescription}
            </Text>
          </SettingTile>
        </SequenceCard>
      )}
      <SequenceCard
        style={{ padding: config.space.S300 }}
        variant={value === CreateRoomKind.Private ? 'Primary' : 'SurfaceVariant'}
        direction="Column"
        gap="100"
        as="button"
        type="button"
        aria-pressed={value === CreateRoomKind.Private}
        onClick={() => onSelect(CreateRoomKind.Private)}
        disabled={disabled}
      >
        <SettingTile
          before={<Icon size="400" src={getIcon(CreateRoomKind.Private)} />}
          after={value === CreateRoomKind.Private && <Icon src={Icons.Check} />}
        >
          <Text size="H6">{t.CreateRoomKindSelector.privateTitle}</Text>
          <Text size="T300" priority="300">
            {t.CreateRoomKindSelector.privateDescription}
          </Text>
        </SettingTile>
      </SequenceCard>
      <SequenceCard
        style={{ padding: config.space.S300 }}
        variant={value === CreateRoomKind.Public ? 'Primary' : 'SurfaceVariant'}
        direction="Column"
        gap="100"
        as="button"
        type="button"
        aria-pressed={value === CreateRoomKind.Public}
        onClick={() => onSelect(CreateRoomKind.Public)}
        disabled={disabled}
      >
        <SettingTile
          before={<Icon size="400" src={getIcon(CreateRoomKind.Public)} />}
          after={value === CreateRoomKind.Public && <Icon src={Icons.Check} />}
        >
          <Text size="H6">{t.CreateRoomKindSelector.publicTitle}</Text>
          <Text size="T300" priority="300">
            {t.CreateRoomKindSelector.publicDescription}
          </Text>
        </SettingTile>
      </SequenceCard>
    </Box>
  );
}
