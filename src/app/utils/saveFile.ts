import FileSaver from 'file-saver';
import { checkIsNativeMobileApp } from '../platform/mobile';
import { checkIsMobileFileSaveSupported, saveFileOnMobile } from '../platform/mobile/fileSave';

export const MINIMUM_FILE_SAVE_WEBVIEW_VERSION = 116;

export class UnsupportedFileSaveError extends Error {
  constructor() {
    super(
      `Saving files needs Android System WebView ${MINIMUM_FILE_SAVE_WEBVIEW_VERSION} or newer. Update it from the Play Store.`
    );
    this.name = 'UnsupportedFileSaveError';
  }
}

export const saveFile = async (data: Blob | string, filename: string): Promise<void> => {
  if (checkIsNativeMobileApp()) {
    if (!checkIsMobileFileSaveSupported()) throw new UnsupportedFileSaveError();
    await saveFileOnMobile(data, filename);
    return;
  }
  FileSaver.saveAs(data, filename);
};
