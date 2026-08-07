import React, { useCallback } from 'react';
import { Button, color, Spinner, Text } from 'folds';
import type { MatrixError } from 'matrix-js-sdk';
import { SequenceCard } from '../../../components/sequence-card';
import { SettingsCardStyle } from '../../../styles/SettingsCard.css';
import { SettingTile } from '../../../components/setting-tile';
import { useRoom } from '../../../hooks/useRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { BreakWord } from '../../../styles/Text.css';

export function RoomResetEncryptionSession() {
  const mx = useMatrixClient();
  const room = useRoom();

  const [resetState, reset] = useAsyncCallback(
    useCallback(async () => {
      const crypto = mx.getCrypto();
      if (!crypto) return;
      await crypto.forceDiscardSession(room.roomId);
      crypto.prepareToEncrypt(room);
    }, [mx, room])
  );

  const resetting = resetState.status === AsyncStatus.Loading;

  return (
    <SequenceCard
      className={SettingsCardStyle}
      variant="SurfaceVariant"
      direction="Column"
      gap="400"
    >
      <SettingTile
        title="Reset Encryption Session"
        description="Discard this room's outgoing session and create a new one. Use this if others report they can't decrypt your messages here. Messages you receive and your history are unaffected."
        after={
          <Button
            size="300"
            variant="Secondary"
            fill="Solid"
            radii="300"
            onClick={() => reset()}
            disabled={resetting}
            before={resetting && <Spinner size="200" variant="Secondary" fill="Solid" />}
          >
            <Text size="B300">{resetting ? 'Resetting…' : 'Reset'}</Text>
          </Button>
        }
      >
        {resetState.status === AsyncStatus.Error && (
          <Text className={BreakWord} style={{ color: color.Critical.Main }} size="T200">
            {(resetState.error as MatrixError).message}
          </Text>
        )}
      </SettingTile>
    </SequenceCard>
  );
}
