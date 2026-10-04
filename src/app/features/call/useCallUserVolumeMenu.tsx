import type { HTMLAttributes, ReactNode } from 'react';
import React, { useState } from 'react';
import type { RectCords } from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import type { LongPressPosition } from '../../hooks/gesture/useLongPress';
import { useLongPress } from '../../hooks/gesture/useLongPress';
import { CallUserVolumeMenu } from './CallUserVolumeMenu';

type CallUserVolumeMenuState = {
  volumeMenuTriggerProps: HTMLAttributes<HTMLElement> | undefined;
  volumeMenu: ReactNode;
};

export const useCallUserVolumeMenu = (
  userId: string | undefined,
  displayName: string,
  isScreenshareAudioEnabled: boolean
): CallUserVolumeMenuState => {
  const mx = useMatrixClient();
  const [volumeMenuAnchor, setVolumeMenuAnchor] = useState<RectCords>();
  const openVolumeMenuAt = ({ x, y }: LongPressPosition) =>
    setVolumeMenuAnchor({ x, y, width: 0, height: 0 });
  const longPressProps = useLongPress(openVolumeMenuAt);

  if (userId === undefined || userId === mx.getUserId()) {
    return { volumeMenuTriggerProps: undefined, volumeMenu: null };
  }

  return {
    volumeMenuTriggerProps: {
      ...longPressProps,
      onContextMenu: (evt) => {
        evt.preventDefault();
        openVolumeMenuAt({ x: evt.clientX, y: evt.clientY });
      },
    },
    volumeMenu: volumeMenuAnchor ? (
      <CallUserVolumeMenu
        userId={userId}
        displayName={displayName}
        isScreenshareAudioEnabled={isScreenshareAudioEnabled}
        anchor={volumeMenuAnchor}
        onClose={() => setVolumeMenuAnchor(undefined)}
      />
    ) : null,
  };
};
