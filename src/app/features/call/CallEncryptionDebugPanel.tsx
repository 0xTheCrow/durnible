import React from 'react';
import type { Participant, Room as LivekitRoom } from 'livekit-client';
import { Box, Text } from 'folds';
import { useLivekitParticipants } from '../../hooks/call/useLivekitParticipants';
import { useParticipantTrackPublications } from '../../hooks/call/useParticipantTrackPublications';
import * as css from './CallPane.css';

function ParticipantEncryptionRow({ participant }: { participant: Participant }) {
  useParticipantTrackPublications(participant);

  return (
    <Text size="T200">
      {participant.identity}
      {participant.isLocal ? ' (you)' : ''}: {participant.isEncrypted ? 'encrypted' : 'plain'}
    </Text>
  );
}

type CallEncryptionDebugPanelProps = {
  livekitRoom: LivekitRoom;
};
export function CallEncryptionDebugPanel({ livekitRoom }: CallEncryptionDebugPanelProps) {
  const participants = useLivekitParticipants(livekitRoom);

  return (
    <Box className={css.CallEncryptionDebugPanel} direction="Column" gap="100">
      <Text size="T200">
        <b>Room E2EE: {livekitRoom.isE2EEEnabled ? 'enabled' : 'disabled'}</b>
      </Text>
      {participants.map((participant) => (
        <ParticipantEncryptionRow key={participant.identity} participant={participant} />
      ))}
    </Box>
  );
}
