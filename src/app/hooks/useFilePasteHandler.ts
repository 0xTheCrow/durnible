import { useCallback, ClipboardEventHandler } from 'react';
import { getDataTransferFiles } from '../utils/dom';

export const useFilePasteHandler = (onPaste: (file: File[]) => void): ClipboardEventHandler =>
  useCallback(
    (evt) => {
      console.log('[paste]', {
        filesCount: evt.clipboardData?.files?.length,
        itemsCount: evt.clipboardData?.items?.length,
        items: evt.clipboardData?.items
          ? Array.from(evt.clipboardData.items).map((item) => ({
              kind: item.kind,
              type: item.type,
            }))
          : null,
        types: evt.clipboardData?.types,
      });
      const files = getDataTransferFiles(evt.clipboardData);
      console.log('[paste] files:', files);
      if (files) onPaste(files);
    },
    [onPaste]
  );
