import { useMemo } from 'react';
import { MessageEvent, StateEvent } from '../../../../types/matrix/room';
import { PermissionGroup } from '../../common-settings/permissions';
import { useTranslation } from '../../../internationalization';

export const usePermissionGroups = (): PermissionGroup[] => {
  const [t] = useTranslation();
  const groups: PermissionGroup[] = useMemo(() => {
    const messagesGroup: PermissionGroup = {
      name: t.Features.CommonSettings.Permissions.messages,
      items: [
        {
          location: {
            key: MessageEvent.RoomMessage,
          },
          name: t.Features.CommonSettings.Permissions.sendMessages,
        },
        {
          location: {
            key: MessageEvent.Sticker,
          },
          name: t.Features.CommonSettings.Permissions.sendStickers,
        },
        {
          location: {
            key: MessageEvent.Reaction,
          },
          name: t.Features.CommonSettings.Permissions.sendReactions,
        },
        {
          location: {
            notification: true,
            key: 'room',
          },
          name: t.Features.CommonSettings.Permissions.pingRoom,
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomPinnedEvents,
          },
          name: t.Features.CommonSettings.Permissions.pinMessages,
        },
        {
          location: {},
          name: t.Features.CommonSettings.Permissions.otherMessageEvents,
        },
      ],
    };

    const moderationGroup: PermissionGroup = {
      name: t.Features.CommonSettings.Permissions.moderation,
      items: [
        {
          location: {
            action: true,
            key: 'invite',
          },
          name: t.Features.CommonSettings.Permissions.invite,
        },
        {
          location: {
            action: true,
            key: 'kick',
          },
          name: t.Features.CommonSettings.Permissions.kick,
        },
        {
          location: {
            action: true,
            key: 'ban',
          },
          name: t.Features.CommonSettings.Permissions.ban,
        },
        {
          location: {
            action: true,
            key: 'redact',
          },
          name: t.Features.CommonSettings.Permissions.deleteOthersMessages,
        },
        {
          location: {
            key: MessageEvent.RoomRedaction,
          },
          name: t.Features.CommonSettings.Permissions.deleteSelfMessages,
        },
      ],
    };

    const roomOverviewGroup: PermissionGroup = {
      name: t.Features.CommonSettings.Permissions.roomOverview,
      items: [
        {
          location: {
            state: true,
            key: StateEvent.RoomAvatar,
          },
          name: t.Features.CommonSettings.Permissions.roomAvatar,
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomName,
          },
          name: t.Features.CommonSettings.Permissions.roomName,
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomTopic,
          },
          name: t.Features.CommonSettings.Permissions.roomTopic,
        },
      ],
    };

    const roomSettingsGroup: PermissionGroup = {
      name: t.Features.CommonSettings.Permissions.settings,
      items: [
        {
          location: {
            state: true,
            key: StateEvent.RoomJoinRules,
          },
          name: t.Features.CommonSettings.Permissions.changeRoomAccess,
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomCanonicalAlias,
          },
          name: t.Features.CommonSettings.Permissions.publishAddress,
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomPowerLevels,
          },
          name: t.Features.CommonSettings.Permissions.changeAllPermission,
        },
        {
          location: {
            state: true,
            key: StateEvent.PowerLevelTags,
          },
          name: t.Features.CommonSettings.Permissions.editPowerLevels,
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomEncryption,
          },
          name: t.Features.CommonSettings.Permissions.enableEncryption,
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomHistoryVisibility,
          },
          name: t.Features.CommonSettings.Permissions.historyVisibility,
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomTombstone,
          },
          name: t.Features.CommonSettings.Permissions.upgradeRoom,
        },
        {
          location: {
            state: true,
          },
          name: t.Features.CommonSettings.Permissions.otherSettings,
        },
      ],
    };

    const otherSettingsGroup: PermissionGroup = {
      name: t.Features.CommonSettings.Permissions.other,
      items: [
        {
          location: {
            state: true,
            key: StateEvent.RoomServerAcl,
          },
          name: t.Features.CommonSettings.Permissions.changeServerAcls,
        },
        {
          location: {
            state: true,
            key: 'im.vector.modular.widgets',
          },
          name: t.Features.CommonSettings.Permissions.modifyWidgets,
        },
      ],
    };

    return [
      messagesGroup,
      moderationGroup,
      roomOverviewGroup,
      roomSettingsGroup,
      otherSettingsGroup,
    ];
  }, [t]);

  return groups;
};
