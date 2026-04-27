import React, { useMemo } from 'react';
import { Box, Button, Icon, IconButton, Icons, Scroll, Text } from 'folds';
import { useAtom } from 'jotai';
import { Page, PageContent } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SettingTile } from '../../../components/setting-tile';
import { SettingsPageHeader } from '../components';
import { SequenceCardStyle } from '../styles.css';
import type {
  KeybindAction,
  KeybindCategory,
  KeybindMap,
  KeybindMeta,
} from '../../../state/keybinds';
import {
  defaultKeybinds,
  keybindMeta,
  KEYBIND_CATEGORY_LABEL,
  keybindsAtom,
} from '../../../state/keybinds';
import { KeybindRecorder } from './KeybindRecorder';

const groupByCategory = (
  meta: KeybindMeta[]
): Array<{ category: KeybindCategory; items: KeybindMeta[] }> => {
  const order: KeybindCategory[] = ['composer', 'global', 'formatting'];
  return order.map((category) => ({
    category,
    items: meta.filter((m) => m.category === category),
  }));
};

const findConflicts = (map: KeybindMap): Map<KeybindAction, KeybindAction[]> => {
  const byHotkey = new Map<string, KeybindAction[]>();
  Object.entries(map).forEach(([id, hotkey]) => {
    if (!hotkey) return;
    const list = byHotkey.get(hotkey) ?? [];
    list.push(id as KeybindAction);
    byHotkey.set(hotkey, list);
  });
  const conflicts = new Map<KeybindAction, KeybindAction[]>();
  byHotkey.forEach((ids) => {
    if (ids.length < 2) return;
    ids.forEach((id) => {
      conflicts.set(
        id,
        ids.filter((other) => other !== id)
      );
    });
  });
  return conflicts;
};

type KeybindsProps = {
  onBack: () => void;
  onClose: () => void;
};

export function Keybinds({ onBack, onClose }: KeybindsProps) {
  const [keybinds, setKeybinds] = useAtom(keybindsAtom);

  const grouped = useMemo(() => groupByCategory(keybindMeta), []);
  const conflicts = useMemo(() => findConflicts(keybinds), [keybinds]);
  const labels = useMemo(() => {
    const map = new Map<KeybindAction, string>();
    keybindMeta.forEach((m) => map.set(m.id, m.label));
    return map;
  }, []);

  const handleChange = (id: KeybindAction, next: string) => {
    setKeybinds({ ...keybinds, [id]: next });
  };

  const handleReset = (id: KeybindAction) => {
    setKeybinds({ ...keybinds, [id]: defaultKeybinds[id] });
  };

  const handleResetAll = () => {
    setKeybinds({ ...defaultKeybinds });
  };

  return (
    <Page>
      <SettingsPageHeader title="Keybinds" onBack={onBack} onClose={onClose} />
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <Box direction="Column" gap="100">
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Customize Keyboard Shortcuts"
                    description="Click a keybind to record a new combination. At least one modifier (Ctrl, Alt, or Shift) is required. Press Esc to cancel recording."
                    after={
                      <Button
                        size="300"
                        variant="Secondary"
                        fill="Soft"
                        radii="Pill"
                        outlined
                        before={<Icon src={Icons.Reload} size="100" />}
                        onClick={handleResetAll}
                      >
                        <Text size="B300">Reset All</Text>
                      </Button>
                    }
                  />
                </SequenceCard>
              </Box>

              {grouped.map(({ category, items }) => (
                <Box key={category} direction="Column" gap="100">
                  <Text size="L400">{KEYBIND_CATEGORY_LABEL[category]}</Text>
                  {items.map((item) => {
                    const isDefault = keybinds[item.id] === defaultKeybinds[item.id];
                    const conflictsList = conflicts.get(item.id) ?? [];
                    const conflictLabel = conflictsList
                      .map((id) => labels.get(id) ?? id)
                      .join(', ');
                    return (
                      <SequenceCard
                        key={item.id}
                        className={SequenceCardStyle}
                        variant="SurfaceVariant"
                        direction="Column"
                      >
                        <SettingTile
                          title={item.label}
                          description={
                            conflictsList.length > 0 ? `Also bound to: ${conflictLabel}` : undefined
                          }
                          after={
                            <Box gap="200" alignItems="Center">
                              {!isDefault && (
                                <IconButton
                                  size="300"
                                  variant="Secondary"
                                  fill="None"
                                  radii="Pill"
                                  onClick={() => handleReset(item.id)}
                                  aria-label={`Reset ${item.label}`}
                                >
                                  <Icon src={Icons.Reload} size="100" />
                                </IconButton>
                              )}
                              <KeybindRecorder
                                value={keybinds[item.id]}
                                onChange={(next) => handleChange(item.id, next)}
                                conflict={conflictsList.length > 0}
                              />
                            </Box>
                          }
                        />
                      </SequenceCard>
                    );
                  })}
                </Box>
              ))}
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
