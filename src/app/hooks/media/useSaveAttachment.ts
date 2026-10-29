import { useCallback } from 'react';
import { useMatrixClient } from '../useMatrixClient';
import { useMediaAuthentication } from '../server/useMediaAuthentication';
import { useAsyncCallback } from '../useAsyncCallback';
import type { MatrixAttachment } from '../../utils/matrix';
import { downloadAttachment } from '../../utils/matrix';
import { saveFile } from '../../utils/saveFile';

type AttachmentToSave = MatrixAttachment & {
  filename: string;
  byteCount?: number;
};

export const useSaveAttachment = ({
  url,
  mimeType,
  encryptionInfo,
  filename,
  byteCount,
}: AttachmentToSave) => {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  return useAsyncCallback(
    useCallback(
      () =>
        saveFile(
          (reportPercent) =>
            downloadAttachment(mx, { url, mimeType, encryptionInfo }, useAuthentication, {
              onProgress: reportPercent,
              expectedByteCount: byteCount,
            }),
          filename
        ),
      [mx, url, mimeType, encryptionInfo, useAuthentication, byteCount, filename]
    )
  );
};
