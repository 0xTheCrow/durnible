import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { KeySymbol } from './key-symbol';
import { isMacOS } from './user-agent';

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);

export const isModifierKeyOnly = (key: string): boolean => MODIFIER_KEYS.has(key);

const KEY_NORMALIZE_MAP: Record<string, string> = {
  ' ': 'space',
  Spacebar: 'space',
};

export const normalizeKey = (key: string): string => {
  if (key in KEY_NORMALIZE_MAP) return KEY_NORMALIZE_MAP[key];
  return key.toLowerCase();
};

export const captureHotkey = (evt: KeyboardEvent | ReactKeyboardEvent): string | null => {
  if (isModifierKeyOnly(evt.key)) return null;

  const parts: string[] = [];
  if (evt.ctrlKey || evt.metaKey) parts.push('mod');
  if (evt.altKey) parts.push('alt');
  if (evt.shiftKey) parts.push('shift');

  if (parts.length === 0) return null;

  parts.push(normalizeKey(evt.key));
  return parts.join('+');
};

const KEY_DISPLAY_MAP: Record<string, string> = {
  enter: 'Enter',
  escape: 'Esc',
  space: 'Space',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Del',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  pageup: 'PgUp',
  pagedown: 'PgDn',
  home: 'Home',
  end: 'End',
  insert: 'Ins',
};

const formatKeyForDisplay = (key: string): string => {
  if (key in KEY_DISPLAY_MAP) return KEY_DISPLAY_MAP[key];
  if (key.length === 1) return key.toUpperCase();
  if (/^f\d+$/.test(key)) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
};

const MOD_DISPLAY_MAP_MAC: Record<string, string> = {
  mod: KeySymbol.Command,
  ctrl: KeySymbol.Control,
  shift: KeySymbol.Shift,
  alt: KeySymbol.Option,
  meta: KeySymbol.Command,
  cmd: KeySymbol.Command,
  option: KeySymbol.Option,
};

const MOD_DISPLAY_MAP: Record<string, string> = {
  mod: 'Ctrl',
  ctrl: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  meta: 'Meta',
  cmd: 'Cmd',
  option: 'Alt',
};

export const formatHotkey = (hotkey: string): string => {
  if (!hotkey) return '';
  const parts = hotkey.split('+');
  const modMap = isMacOS() ? MOD_DISPLAY_MAP_MAC : MOD_DISPLAY_MAP;
  return parts.map((part) => modMap[part] ?? formatKeyForDisplay(part)).join(' + ');
};
