import { useMemo } from 'react';
import { StateEvent } from '../../../../types/matrix/room';
import { PermissionGroup } from '../../common-settings/permissions';
import { useTranslation } from '../../../internationalization';

export const usePermissionGroups = (): PermissionGroup[] => {
  const [t] = useTranslation();
  const groups: PermissionGroup[] = useMemo(() => {
    const messagesGroup: PermissionGroup = {
      name: t.Features.CommonSettings.Permissions.manage,
      items: [
        {
          location: {
            state: true,
            key: StateEvent.SpaceChild,
          },
          name: t.Features.CommonSettings.Permissions.manageSpaceRooms,
        },
        {
          location: {},
          name: t.Features.CommonSettings.Permissions.messageEvents,
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
      ],
    };

    const roomOverviewGroup: PermissionGroup = {
      name: t.Features.CommonSettings.Permissions.spaceOverview,
      items: [
        {
          location: {
            state: true,
            key: StateEvent.RoomAvatar,
          },
          name: t.Features.CommonSettings.Permissions.spaceAvatar,
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomName,
          },
          name: t.Features.CommonSettings.Permissions.spaceName,
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomTopic,
          },
          name: t.Features.CommonSettings.Permissions.spaceTopic,
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
          name: t.Features.CommonSettings.Permissions.changeSpaceAccess,
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
            key: StateEvent.RoomTombstone,
          },
          name: t.Features.CommonSettings.Permissions.upgradeSpace,
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
