import type { MouseEventHandler, ReactNode } from 'react';
import React, { useState } from 'react';
import type { RectCords } from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { CallUserVolumeMenu } from './CallUserVolumeMenu';

type CallUserVolumeMenuState = {
  handleContextMenu: MouseEventHandler<HTMLElement> | undefined;
  volumeMenu: ReactNode;
};

export const useCallUserVolumeMenu = (
  userId: string | undefined,
  displayName: string
): CallUserVolumeMenuState => {
  const mx = useMatrixClient();
  const [volumeMenuAnchor, setVolumeMenuAnchor] = useState<RectCords>();

  if (userId === undefined || userId === mx.getUserId()) {
    return { handleContextMenu: undefined, volumeMenu: null };
  }

  return {
    handleContextMenu: (evt) => {
      evt.preventDefault();
      setVolumeMenuAnchor({ x: evt.clientX, y: evt.clientY, width: 0, height: 0 });
    },
    volumeMenu: volumeMenuAnchor ? (
      <CallUserVolumeMenu
        userId={userId}
        displayName={displayName}
        anchor={volumeMenuAnchor}
        onClose={() => setVolumeMenuAnchor(undefined)}
      />
    ) : null,
  };
};
