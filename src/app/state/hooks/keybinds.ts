import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { useMemo } from 'react';
import type { KeybindAction, KeybindMap } from '../keybinds';
import { keybindsAtom } from '../keybinds';
import { formatHotkey } from '../../utils/keybindFormat';

export const useKeybinds = (): KeybindMap => useAtomValue(keybindsAtom);

export const useKeybind = (action: KeybindAction | undefined): string => {
  const selector = useMemo(() => (m: KeybindMap) => action ? m[action] : '', [action]);
  return useAtomValue(selectAtom(keybindsAtom, selector));
};

export const useFormattedKeybind = (action: KeybindAction | undefined): string => {
  const hotkey = useKeybind(action);
  return useMemo(() => formatHotkey(hotkey), [hotkey]);
};
