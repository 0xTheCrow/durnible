import { useRoom } from '../../hooks/room/useRoom';
import { usePowerLevels } from '../../hooks/members/usePowerLevels';
import { useRoomCreators } from '../../hooks/room/useRoomCreators';
import type { RoomPermissionsAPI } from '../../hooks/members/useRoomPermissions';
import { useRoomPermissions } from '../../hooks/members/useRoomPermissions';

export const useRoomSettingsPermissions = (): RoomPermissionsAPI => {
  const room = useRoom();
  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);

  return useRoomPermissions(creators, powerLevels);
};
