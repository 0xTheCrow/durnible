import { BrowserWindow, Menu } from 'electron';
import type { ContextMenuParams, MenuItemConstructorOptions, WebContents } from 'electron';

const buildSpellingSectionTemplate = (
  params: ContextMenuParams,
  targetWebContents: WebContents
): MenuItemConstructorOptions[] => {
  const { misspelledWord, dictionarySuggestions } = params;
  if (misspelledWord.length === 0) return [];

  const suggestionItems: MenuItemConstructorOptions[] =
    dictionarySuggestions.length > 0
      ? dictionarySuggestions.map((suggestion) => ({
          label: suggestion,
          click: () => targetWebContents.replaceMisspelling(suggestion),
        }))
      : [{ label: 'No Spelling Suggestions', enabled: false }];

  return [
    ...suggestionItems,
    { type: 'separator' },
    {
      label: 'Add to Dictionary',
      click: () => targetWebContents.session.addWordToSpellCheckerDictionary(misspelledWord),
    },
    { type: 'separator' },
  ];
};

const buildTextContextMenuTemplate = (
  params: ContextMenuParams,
  targetWebContents: WebContents
): MenuItemConstructorOptions[] => {
  const { editFlags } = params;

  if (params.isEditable) {
    return [
      ...buildSpellingSectionTemplate(params, targetWebContents),
      { role: 'cut', enabled: editFlags.canCut },
      { role: 'copy', enabled: editFlags.canCopy },
      { role: 'paste', enabled: editFlags.canPaste },
      { role: 'selectAll', enabled: editFlags.canSelectAll },
    ];
  }

  if (params.selectionText.trim().length > 0) {
    return [{ role: 'copy', enabled: editFlags.canCopy }];
  }

  return [];
};

export const installTextContextMenu = (targetWebContents: WebContents): void => {
  targetWebContents.on('context-menu', (_event, params) => {
    const template = buildTextContextMenuTemplate(params, targetWebContents);
    if (template.length === 0) return;

    const targetWindow = BrowserWindow.fromWebContents(targetWebContents);
    if (!targetWindow) return;

    Menu.buildFromTemplate(template).popup({ window: targetWindow });
  });
};
