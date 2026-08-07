import React, { useMemo } from 'react';
import type {
  SettingsSearchEntry,
  SettingsSearchRenderProps,
} from '../../../components/settings-search';
import { useRoom } from '../../../hooks/useRoom';
import { useRoomSettingsPermissions } from '../useRoomSettingsPermissions';
import type { PermissionGroup } from '../permissions';
import {
  RoomEncryption,
  RoomHistoryVisibility,
  RoomJoinRules,
  RoomLocalAddresses,
  RoomPublish,
  RoomPublishedAddresses,
  RoomUpgrade,
} from '../general';
import { RoomResetEncryptionSession } from '../encryption';

function AccessSetting() {
  const permissions = useRoomSettingsPermissions();
  return <RoomJoinRules permissions={permissions} />;
}

function HistoryVisibilitySetting() {
  const permissions = useRoomSettingsPermissions();
  return <RoomHistoryVisibility permissions={permissions} />;
}

function EncryptionSetting() {
  const permissions = useRoomSettingsPermissions();
  return <RoomEncryption permissions={permissions} />;
}

function PublishSetting() {
  const permissions = useRoomSettingsPermissions();
  return <RoomPublish permissions={permissions} />;
}

function PublishedAddressesSetting() {
  const permissions = useRoomSettingsPermissions();
  return <RoomPublishedAddresses permissions={permissions} />;
}

function LocalAddressesSetting() {
  const permissions = useRoomSettingsPermissions();
  return <RoomLocalAddresses permissions={permissions} />;
}

function UpgradeSetting({ onClose }: SettingsSearchRenderProps) {
  const permissions = useRoomSettingsPermissions();
  return <RoomUpgrade permissions={permissions} onClose={onClose} />;
}

export type RoomSettingsSearchPages<TPage> = {
  general: TPage;
  members: TPage;
  permissions: TPage;
  emojisStickers: TPage;
  developerTools: TPage;
  encryption?: TPage;
};

export const useRoomSettingsSearchEntries = <TPage,>(
  pages: RoomSettingsSearchPages<TPage>,
  permissionGroups: PermissionGroup[]
): SettingsSearchEntry<TPage>[] => {
  const room = useRoom();
  const isSpace = room.isSpaceRoom();
  const isEncrypted = room.hasEncryptionStateEvent();
  const { general, members, permissions, emojisStickers, developerTools, encryption } = pages;

  return useMemo(() => {
    const subject = isSpace ? 'Space' : 'Room';
    const subjectLower = subject.toLowerCase();

    const generalEntries: SettingsSearchEntry<TPage>[] = [
      {
        id: 'profile',
        title: 'Profile',
        description: `Change the ${subjectLower} name, avatar and topic.`,
        keywords: [
          'profile',
          'name',
          'rename',
          'avatar',
          'icon',
          'picture',
          'topic',
          'description',
        ],
        page: general,
        pageName: 'General',
        sectionName: 'Profile',
      },
      {
        id: 'access',
        title: `${subject} Access`,
        keywords: [
          'access',
          'join',
          'join rule',
          'invite',
          'knock',
          'public',
          'private',
          'restricted',
          'visibility',
        ],
        page: general,
        pageName: 'General',
        sectionName: 'Options',
        Render: AccessSetting,
        hasOwnCard: true,
      },
      ...(isSpace
        ? []
        : [
            {
              id: 'history-visibility',
              title: 'Message History Visibility',
              keywords: ['history', 'visibility', 'past', 'shared', 'world readable', 'joined'],
              page: general,
              pageName: 'General',
              sectionName: 'Options',
              Render: HistoryVisibilitySetting,
              hasOwnCard: true,
            },
            {
              id: 'encryption',
              title: 'Room Encryption',
              keywords: ['encryption', 'encrypted', 'e2e', 'e2ee', 'secure', 'private'],
              page: general,
              pageName: 'General',
              sectionName: 'Options',
              Render: EncryptionSetting,
              hasOwnCard: true,
            },
          ]),
      {
        id: 'publish-to-directory',
        title: 'Publish to Directory',
        keywords: ['publish', 'directory', 'public', 'discover', 'listing', 'explore'],
        page: general,
        pageName: 'General',
        sectionName: 'Options',
        Render: PublishSetting,
        hasOwnCard: true,
      },
      {
        id: 'published-addresses',
        title: 'Published Addresses',
        keywords: ['address', 'alias', 'published', 'canonical', 'main', 'url', 'link'],
        page: general,
        pageName: 'General',
        sectionName: 'Addresses',
        Render: PublishedAddressesSetting,
        hasOwnCard: true,
      },
      {
        id: 'local-addresses',
        title: 'Local Addresses',
        description: 'Set local address so users can join through your homeserver.',
        keywords: ['address', 'alias', 'local', 'homeserver', 'url', 'link'],
        page: general,
        pageName: 'General',
        sectionName: 'Addresses',
        Render: LocalAddressesSetting,
        hasOwnCard: true,
      },
      {
        id: 'upgrade',
        title: `Upgrade ${subject}`,
        keywords: ['upgrade', 'version', 'tombstone', 'replace', 'migrate'],
        page: general,
        pageName: 'General',
        sectionName: 'Advanced Options',
        Render: UpgradeSetting,
        hasOwnCard: true,
      },
    ];

    const permissionEntries: SettingsSearchEntry<TPage>[] = [
      {
        id: 'power-levels',
        title: 'Power Levels',
        description: 'View and edit the roles members can be assigned.',
        keywords: ['power level', 'role', 'admin', 'moderator', 'default', 'tag', 'rank'],
        page: permissions,
        pageName: 'Permissions',
        sectionName: 'Powers',
      },
      ...permissionGroups.flatMap((group) =>
        group.items.map((item) => ({
          id: `permission-${group.name}-${item.name}`,
          title: item.name,
          description: item.description ?? 'Power level required to use this permission.',
          keywords: ['permission', 'power level', 'role', group.name],
          page: permissions,
          pageName: 'Permissions',
          sectionName: group.name,
        }))
      ),
    ];

    const encryptionEntries: SettingsSearchEntry<TPage>[] =
      encryption !== undefined && isEncrypted
        ? [
            {
              id: 'reset-encryption-session',
              title: 'Reset Encryption Session',
              keywords: [
                'encryption',
                'session',
                'reset',
                'megolm',
                'decrypt',
                'undecryptable',
                'unable to decrypt',
              ],
              page: encryption,
              pageName: 'Encryption',
              sectionName: 'Advanced',
              Render: RoomResetEncryptionSession,
              hasOwnCard: true,
            },
          ]
        : [];

    return [
      ...generalEntries,
      {
        id: 'members',
        title: 'Members',
        description: `View and moderate ${subjectLower} members.`,
        keywords: ['member', 'user', 'people', 'invite', 'kick', 'ban', 'moderation', 'roles'],
        page: members,
        pageName: 'Members',
        sectionName: 'Members',
      },
      ...permissionEntries,
      {
        id: 'pack-edit-permission',
        title: 'Custom Pack Edit Permission',
        description:
          'Override the default permission required to create or edit packs in this room.',
        keywords: ['emoji', 'sticker', 'pack', 'permission', 'power level', 'edit', 'override'],
        page: emojisStickers,
        pageName: 'Emojis & Stickers',
        sectionName: 'Permissions',
      },
      {
        id: 'new-pack',
        title: 'New Pack',
        description: 'Add your own emoji and sticker pack to use in room.',
        keywords: ['emoji', 'sticker', 'pack', 'new', 'create', 'add', 'custom', 'emote'],
        page: emojisStickers,
        pageName: 'Emojis & Stickers',
        sectionName: 'Packs',
      },
      {
        id: 'emoji-sticker-packs',
        title: 'Emoji & Sticker Packs',
        description: `Manage emoji and sticker packs of this ${subjectLower}.`,
        keywords: ['emoji', 'sticker', 'pack', 'custom', 'emote', 'reaction', 'image'],
        page: emojisStickers,
        pageName: 'Emojis & Stickers',
        sectionName: 'Packs',
      },
      ...encryptionEntries,
      {
        id: 'enable-developer-tools',
        title: 'Enable Developer Tools',
        description: `Show developer options such as ${subjectLower} state and account data.`,
        keywords: ['developer', 'debug', 'advanced', 'tools', 'json', 'raw'],
        page: developerTools,
        pageName: 'Developer Tools',
        sectionName: 'Options',
      },
      {
        id: 'room-id',
        title: `${subject} ID`,
        description: `Copy the internal ${subjectLower} ID.`,
        keywords: ['id', 'identifier', 'internal', 'developer', 'copy', 'debug'],
        page: developerTools,
        pageName: 'Developer Tools',
        sectionName: 'Options',
      },
      {
        id: 'room-state',
        title: `${subject} State`,
        description: `State events of the ${subjectLower}.`,
        keywords: ['state', 'event', 'json', 'developer', 'debug', 'raw'],
        page: developerTools,
        pageName: 'Developer Tools',
        sectionName: 'Data',
      },
      {
        id: 'account-data',
        title: 'Account Data',
        description: `Private personalization data stored within ${subjectLower}.`,
        keywords: ['account data', 'json', 'developer', 'debug', 'raw', 'private'],
        page: developerTools,
        pageName: 'Developer Tools',
        sectionName: 'Data',
      },
      {
        id: 'send-event',
        title: 'New Message Event',
        description: `Create and send a new message event within the ${subjectLower}.`,
        keywords: ['send', 'event', 'custom', 'json', 'developer', 'debug'],
        page: developerTools,
        pageName: 'Developer Tools',
        sectionName: 'Data',
      },
    ];
  }, [
    isSpace,
    isEncrypted,
    permissionGroups,
    general,
    members,
    permissions,
    emojisStickers,
    developerTools,
    encryption,
  ]);
};
