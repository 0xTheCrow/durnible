import React, { useMemo, useState } from 'react';
import { Box, Button, Dialog, Header, Icon, IconButton, Icons, Switch, Text, config } from 'folds';
import { OverlayModal } from '../../components/OverlayModal';
import type {
  DesktopScreenshareSource,
  DesktopScreenshareSourceChoice,
  DesktopScreenshareSourceRequest,
} from '../../platform/desktop';
import * as css from './ScreenshareSourcePicker.css';

type ScreenshareSourcePickerProps = {
  request: DesktopScreenshareSourceRequest;
  onComplete: (choice: DesktopScreenshareSourceChoice | null) => void;
};

const getDefaultSelectedSourceId = (sources: DesktopScreenshareSource[]): string | undefined =>
  (sources.find((source) => source.isScreen) ?? sources[0])?.id;

export function ScreenshareSourcePicker({ request, onComplete }: ScreenshareSourcePickerProps) {
  const { sources } = request;
  const [selectedSourceId, setSelectedSourceId] = useState(() =>
    getDefaultSelectedSourceId(sources)
  );
  const [shareSystemAudio, setShareSystemAudio] = useState(true);

  const screenSources = useMemo(() => sources.filter((source) => source.isScreen), [sources]);
  const windowSources = useMemo(() => sources.filter((source) => !source.isScreen), [sources]);

  const cancel = () => onComplete(null);
  const confirm = () => {
    if (!selectedSourceId) return;
    onComplete({ sourceId: selectedSourceId, shareSystemAudio });
  };

  const renderSourceGroup = (label: string, groupSources: DesktopScreenshareSource[]) => {
    if (groupSources.length === 0) return null;
    return (
      <Box direction="Column" gap="200">
        <Text size="L400">{label}</Text>
        <div className={css.SourceGrid}>
          {groupSources.map((source) => (
            <button
              key={source.id}
              type="button"
              className={css.SourceButton}
              aria-pressed={source.id === selectedSourceId}
              onClick={() => setSelectedSourceId(source.id)}
            >
              <img className={css.SourceThumbnail} src={source.thumbnailDataUrl} alt="" />
              <Text className={css.SourceName} size="T200">
                {source.name}
              </Text>
            </button>
          ))}
        </div>
      </Box>
    );
  };

  return (
    <OverlayModal open onClose={cancel}>
      <Dialog variant="Surface">
        <Header
          style={{
            padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
            borderBottomWidth: config.borderWidth.B300,
          }}
          variant="Surface"
          size="500"
        >
          <Box grow="Yes">
            <Text size="H4">Share your screen</Text>
          </Box>
          <IconButton size="300" onClick={cancel} radii="300">
            <Icon src={Icons.Cross} />
          </IconButton>
        </Header>
        <div className={css.PickerBody}>
          <div className={css.SourceScroll}>
            <Box direction="Column" gap="400">
              {renderSourceGroup('Screens', screenSources)}
              {renderSourceGroup('Windows', windowSources)}
            </Box>
          </div>
          <Box alignItems="Center" gap="200">
            <Box grow="Yes" direction="Column">
              <Text size="T300">Share system audio</Text>
              <Text size="T200" priority="300">
                Shares everything playing on this computer.
              </Text>
            </Box>
            <Switch variant="Primary" value={shareSystemAudio} onChange={setShareSystemAudio} />
          </Box>
          <Box gap="200" justifyContent="End">
            <Button variant="Secondary" fill="Soft" onClick={cancel}>
              <Text size="B400">Cancel</Text>
            </Button>
            <Button variant="Primary" onClick={confirm} aria-disabled={!selectedSourceId}>
              <Text size="B400">Share</Text>
            </Button>
          </Box>
        </div>
      </Dialog>
    </OverlayModal>
  );
}
