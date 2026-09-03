import { BrowserWindow, Menu } from 'electron';
import type { ContextMenuParams, MenuItemConstructorOptions, WebContents } from 'electron';

const buildTextContextMenuTemplate = (params: ContextMenuParams): MenuItemConstructorOptions[] => {
  const { editFlags } = params;

  if (params.isEditable) {
    return [
      { role: 'cut', enabled: editFlags.canCut },
      { role: 'copy', enabled: editFlags.canCopy },
      { role: 'paste', enabled: editFlags.canPaste },
    ];
  }

  if (params.selectionText.trim().length > 0) {
    return [{ role: 'copy', enabled: editFlags.canCopy }];
  }

  return [];
};

export const installTextContextMenu = (targetWebContents: WebContents): void => {
  targetWebContents.on('context-menu', (_event, params) => {
    const template = buildTextContextMenuTemplate(params);
    if (template.length === 0) return;

    const targetWindow = BrowserWindow.fromWebContents(targetWebContents);
    if (!targetWindow) return;

    Menu.buildFromTemplate(template).popup({ window: targetWindow });
  });
};
