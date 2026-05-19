import { Icon, Icons, MenuItem, Text, as } from 'folds';
import React from 'react';
import { useAtomValue } from 'jotai';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../../../hooks/useMatrixClient';
import { mDirectAtom } from '../../../../state/mDirectList';
import { roomToParentsAtom } from '../../../../state/room/roomToParents';
import { getOrphanParents, guessPerfectParent } from '../../../../utils/room';
import { getCanonicalAliasOrRoomId } from '../../../../utils/matrix';
import { getDirectRoomPath, getHomeRoomPath, getSpaceRoomPath } from '../../../../pages/pathUtils';
import { copyToClipboard } from '../../../../utils/dom';
import * as css from '../styles.css';

export const MessageCopyLinkItem = as<
  'button',
  {
    room: Room;
    mEvent: MatrixEvent;
    onClose?: () => void;
  }
>(({ room, mEvent, onClose, ...props }, ref) => {
  const mx = useMatrixClient();
  const mDirects = useAtomValue(mDirectAtom);
  const roomToParents = useAtomValue(roomToParentsAtom);

  const handleCopy = () => {
    const eventId = mEvent.getId();
    if (!eventId) return;
    const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, room.roomId);

    let path: string;
    const orphanParents = getOrphanParents(roomToParents, room.roomId);
    if (orphanParents.length > 0) {
      const parent = guessPerfectParent(mx, room.roomId, orphanParents) ?? orphanParents[0];
      const pIdOrAlias = getCanonicalAliasOrRoomId(mx, parent);
      path = getSpaceRoomPath(pIdOrAlias, roomIdOrAlias, eventId);
    } else if (mDirects.has(room.roomId)) {
      path = getDirectRoomPath(roomIdOrAlias, eventId);
    } else {
      path = getHomeRoomPath(roomIdOrAlias, eventId);
    }

    copyToClipboard(`${window.location.origin}${path}`);
    onClose?.();
  };

  return (
    <MenuItem
      size="300"
      after={<Icon size="100" src={Icons.Link} />}
      radii="300"
      onClick={handleCopy}
      data-testid="message-copy-link-btn"
      {...props}
      ref={ref}
    >
      <Text className={css.MessageMenuItemText} as="span" size="T300" truncate>
        Copy Link
      </Text>
    </MenuItem>
  );
});
