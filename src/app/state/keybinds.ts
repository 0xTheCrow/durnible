import { atom } from 'jotai';

const STORAGE_KEY = 'keybinds';

export enum KeybindAction {
  FormatBold = 'format.bold',
  FormatItalic = 'format.italic',
  FormatUnderline = 'format.underline',
  FormatStrikethrough = 'format.strikethrough',
  FormatInlineCode = 'format.inlineCode',
  FormatSpoiler = 'format.spoiler',
  FormatCodeBlock = 'format.codeBlock',
  FormatBlockquote = 'format.blockquote',
  FormatHeading1 = 'format.heading1',
  FormatHeading2 = 'format.heading2',
  FormatHeading3 = 'format.heading3',
  FormatOrderedList = 'format.orderedList',
  FormatUnorderedList = 'format.unorderedList',
  FormatExitBlock = 'format.exitBlock',

  ComposeSend = 'compose.send',

  GlobalOpenSearch = 'global.openSearch',
  GlobalFocusComposer = 'global.focusComposer',
}

export type KeybindMap = Record<KeybindAction, string>;

export const defaultKeybinds: KeybindMap = {
  [KeybindAction.FormatBold]: 'mod+b',
  [KeybindAction.FormatItalic]: 'mod+i',
  [KeybindAction.FormatUnderline]: 'mod+u',
  [KeybindAction.FormatStrikethrough]: 'mod+s',
  [KeybindAction.FormatInlineCode]: 'mod+[',
  [KeybindAction.FormatSpoiler]: 'mod+h',
  [KeybindAction.FormatCodeBlock]: 'mod+;',
  [KeybindAction.FormatBlockquote]: "mod+'",
  [KeybindAction.FormatHeading1]: 'mod+1',
  [KeybindAction.FormatHeading2]: 'mod+2',
  [KeybindAction.FormatHeading3]: 'mod+3',
  [KeybindAction.FormatOrderedList]: 'mod+7',
  [KeybindAction.FormatUnorderedList]: 'mod+8',
  [KeybindAction.FormatExitBlock]: 'mod+e',
  [KeybindAction.ComposeSend]: 'mod+enter',
  [KeybindAction.GlobalOpenSearch]: 'mod+k',
  [KeybindAction.GlobalFocusComposer]: 'mod+v',
};

export type KeybindCategory = 'composer' | 'global' | 'formatting';

export type KeybindMeta = {
  id: KeybindAction;
  label: string;
  category: KeybindCategory;
};

export const KEYBIND_CATEGORY_LABEL: Record<KeybindCategory, string> = {
  composer: 'Message Composer',
  global: 'Global',
  formatting: 'Text Formatting',
};

export const keybindMeta: KeybindMeta[] = [
  { id: KeybindAction.ComposeSend, label: 'Send Message', category: 'composer' },

  { id: KeybindAction.GlobalOpenSearch, label: 'Open Room Search', category: 'global' },
  { id: KeybindAction.GlobalFocusComposer, label: 'Focus Message Input', category: 'global' },

  { id: KeybindAction.FormatBold, label: 'Bold', category: 'formatting' },
  { id: KeybindAction.FormatItalic, label: 'Italic', category: 'formatting' },
  { id: KeybindAction.FormatUnderline, label: 'Underline', category: 'formatting' },
  { id: KeybindAction.FormatStrikethrough, label: 'Strikethrough', category: 'formatting' },
  { id: KeybindAction.FormatInlineCode, label: 'Inline Code', category: 'formatting' },
  { id: KeybindAction.FormatSpoiler, label: 'Spoiler', category: 'formatting' },
  { id: KeybindAction.FormatCodeBlock, label: 'Code Block', category: 'formatting' },
  { id: KeybindAction.FormatBlockquote, label: 'Block Quote', category: 'formatting' },
  { id: KeybindAction.FormatHeading1, label: 'Heading 1', category: 'formatting' },
  { id: KeybindAction.FormatHeading2, label: 'Heading 2', category: 'formatting' },
  { id: KeybindAction.FormatHeading3, label: 'Heading 3', category: 'formatting' },
  { id: KeybindAction.FormatOrderedList, label: 'Ordered List', category: 'formatting' },
  { id: KeybindAction.FormatUnorderedList, label: 'Unordered List', category: 'formatting' },
  { id: KeybindAction.FormatExitBlock, label: 'Exit Block Format', category: 'formatting' },
];

const isValidActionId = (id: string): id is KeybindAction =>
  Object.values(KeybindAction).includes(id as KeybindAction);

const getStored = (): KeybindMap => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultKeybinds;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: KeybindMap = { ...defaultKeybinds };
    Object.entries(parsed).forEach(([key, value]) => {
      if (isValidActionId(key) && typeof value === 'string') {
        result[key] = value;
      }
    });
    return result;
  } catch {
    return defaultKeybinds;
  }
};

const setStored = (map: KeybindMap) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

const baseKeybindsAtom = atom<KeybindMap>(getStored());
export const keybindsAtom = atom<KeybindMap, [KeybindMap], undefined>(
  (get) => get(baseKeybindsAtom),
  (_, set, update) => {
    set(baseKeybindsAtom, update);
    setStored(update);
  }
);
