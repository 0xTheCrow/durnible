import type { MatrixEvent } from 'matrix-js-sdk';
import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Header,
  Icon,
  IconButton,
  Icons,
  Modal,
  Scroll,
  Text,
  color,
  config,
} from 'folds';
import { OverlayModal } from '../../../components/OverlayModal';
import { copyToClipboard } from '../../../utils/dom';

const warningStyle = { color: color.Warning.Main, opacity: config.opacity.P300 };

const reportStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  userSelect: 'text',
};

function buildDecryptionFailureReport(mEvent: MatrixEvent): string {
  const wireContent = mEvent.getWireContent();
  const sentTs = mEvent.getTs();
  return [
    'Decryption failure',
    `Reason: ${mEvent.decryptionFailureReason ?? 'unknown'}`,
    `Detail: ${mEvent.getContent().body ?? ''}`,
    `Event ID: ${mEvent.getId() ?? ''}`,
    `Room ID: ${mEvent.getRoomId() ?? ''}`,
    `Sender: ${mEvent.getSender() ?? ''}`,
    `Sent: ${new Date(sentTs).toISOString()} (${sentTs})`,
    `Algorithm: ${wireContent.algorithm ?? ''}`,
    `Sender key: ${wireContent.sender_key ?? ''}`,
    `Session ID: ${wireContent.session_id ?? ''}`,
    `Sender device: ${wireContent.device_id ?? ''}`,
  ].join('\n');
}

type DecryptionFailedContentProps = {
  mEvent: MatrixEvent;
  retrying: boolean;
  onRetry: () => void;
};

export function DecryptionFailedContent({
  mEvent,
  retrying,
  onRetry,
}: DecryptionFailedContentProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timeoutId = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeoutId);
  }, [copied]);

  const handleCopy = () => {
    copyToClipboard(buildDecryptionFailureReport(mEvent));
    setCopied(true);
  };

  return (
    <Text>
      <Box as="span" alignItems="Center" gap="200" style={warningStyle}>
        <Icon size="50" src={Icons.Lock} />
        <i>Decryption failed</i>
        <Chip
          as="button"
          radii="300"
          variant="SurfaceVariant"
          size="400"
          disabled={retrying}
          onClick={onRetry}
        >
          <Text size="T200">{retrying ? 'Retrying…' : 'Retry'}</Text>
        </Chip>
        <Chip
          as="button"
          radii="300"
          variant="SurfaceVariant"
          size="400"
          onClick={() => setDetailsOpen(true)}
        >
          <Text size="T200">Details</Text>
        </Chip>
      </Box>
      <OverlayModal open={detailsOpen} onClose={() => setDetailsOpen(false)}>
        <Modal size="300" flexHeight>
          <Header
            style={{
              padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
              borderBottomWidth: config.borderWidth.B300,
            }}
            variant="Surface"
            size="500"
          >
            <Box grow="Yes">
              <Text size="H4" truncate>
                Decryption failed
              </Text>
            </Box>
            <Box shrink="No" alignItems="Center" gap="200">
              <Button
                size="300"
                variant="Secondary"
                fill="Soft"
                radii="300"
                onClick={handleCopy}
                before={<Icon size="100" src={copied ? Icons.Check : Icons.File} />}
              >
                <Text size="B300">{copied ? 'Copied' : 'Copy'}</Text>
              </Button>
              <IconButton size="300" onClick={() => setDetailsOpen(false)} radii="300">
                <Icon src={Icons.Cross} />
              </IconButton>
            </Box>
          </Header>
          <Scroll size="300" hideTrack style={{ flexGrow: 1 }}>
            <Box direction="Column" style={{ padding: config.space.S400 }}>
              <Text as="pre" size="T200" style={reportStyle}>
                {buildDecryptionFailureReport(mEvent)}
              </Text>
            </Box>
          </Scroll>
        </Modal>
      </OverlayModal>
    </Text>
  );
}
