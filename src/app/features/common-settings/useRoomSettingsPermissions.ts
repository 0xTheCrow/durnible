import { useRoom } from '../../hooks/useRoom';
import { usePowerLevels } from '../../hooks/usePowerLevels';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import type { RoomPermissionsAPI } from '../../hooks/useRoomPermissions';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';

export const useRoomSettingsPermissions = (): RoomPermissionsAPI => {
  const room = useRoom();
  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);

  return useRoomPermissions(creators, powerLevels);
};
