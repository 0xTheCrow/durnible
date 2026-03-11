import { useCallback, ClipboardEventHandler } from 'react';
import { getDataTransferFiles } from '../utils/dom';

export const useFilePasteHandler = (onPaste: (file: File[]) => void): ClipboardEventHandler =>
  useCallback(
    (evt) => {
      console.log('[paste]', {
        html: evt.clipboardData?.getData('text/html'),
        text: evt.clipboardData?.getData('text/plain'),
      });
      const files = getDataTransferFiles(evt.clipboardData);
      console.log('[paste] files:', files);
      if (files) onPaste(files);
    },
    [onPaste]
  );
