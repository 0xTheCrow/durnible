import type { ReactNode } from 'react';
import { useCallback } from 'react';
import type { ThumbnailContent as ThumbnailContentInfo } from '../../../../types/matrix/common';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAutoLoadAsyncCallback } from '../../../hooks/useAsyncCallback';
import { decryptFile, downloadEncryptedMedia, mxcUrlToHttp } from '../../../utils/matrix';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { FALLBACK_MIMETYPE } from '../../../utils/mimeTypes';

export type ThumbnailContentProps = {
  info: ThumbnailContentInfo;
  renderImage: (src: string) => ReactNode;
};
export function ThumbnailContent({ info, renderImage }: ThumbnailContentProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const [thumbSrcState] = useAutoLoadAsyncCallback(
    useCallback(async () => {
      const thumbInfo = info.thumbnail_info;
      const thumbMxcUrl = info.thumbnail_file?.url ?? info.thumbnail_url;
      const encInfo = info.thumbnail_file;
      if (typeof thumbMxcUrl !== 'string' || typeof thumbInfo?.mimetype !== 'string') {
        throw new Error('Failed to load thumbnail');
      }

      const mediaUrl = mxcUrlToHttp(mx, thumbMxcUrl, useAuthentication) ?? thumbMxcUrl;
      if (encInfo) {
        const fileContent = await downloadEncryptedMedia(mediaUrl, (encBuf) =>
          decryptFile(encBuf, thumbInfo.mimetype ?? FALLBACK_MIMETYPE, encInfo)
        );
        return URL.createObjectURL(fileContent);
      }

      return mediaUrl;
    }, [mx, info, useAuthentication]),
    true
  );

  return thumbSrcState.status === AsyncStatus.Success ? renderImage(thumbSrcState.data) : null;
}
