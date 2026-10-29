import { Badge, Box, Icon, IconButton, Icons, Spinner, Text, as, toRem } from 'folds';
import type { ReactNode } from 'react';
import React from 'react';
import type { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import { mimeTypeToExt } from '../../utils/mimeTypes';
import { AsyncStatus } from '../../hooks/useAsyncCallback';
import { useSaveAttachment } from '../../hooks/media/useSaveAttachment';

const badgeStyles = { maxWidth: toRem(100) };

type FileDownloadButtonProps = {
  filename: string;
  url: string;
  mimeType: string;
  encryptionInfo?: EncryptedAttachmentInfo;
};
export function FileDownloadButton({
  filename,
  url,
  mimeType,
  encryptionInfo,
}: FileDownloadButtonProps) {
  const [saveState, saveAttachment] = useSaveAttachment({
    url,
    mimeType,
    encryptionInfo,
    filename,
  });

  const handleDownload = () => {
    saveAttachment().catch(() => {});
  };

  const isDownloading = saveState.status === AsyncStatus.Loading;
  const hasError = saveState.status === AsyncStatus.Error;
  return (
    <IconButton
      disabled={isDownloading}
      onClick={handleDownload}
      variant={hasError ? 'Critical' : 'SurfaceVariant'}
      size="400"
      radii="300"
      data-testid="file-download-btn"
    >
      {isDownloading ? (
        <Spinner size="100" variant={hasError ? 'Critical' : 'Secondary'} />
      ) : (
        <Icon size="100" src={Icons.Download} />
      )}
    </IconButton>
  );
}

export type FileHeaderProps = {
  body: string;
  mimeType: string;
  after?: ReactNode;
};
export const FileHeader = as<'div', FileHeaderProps>(({ body, mimeType, after, ...props }, ref) => (
  <Box alignItems="Center" gap="200" grow="Yes" {...props} ref={ref}>
    <Box shrink="No">
      <Badge style={badgeStyles} variant="Secondary" radii="Pill">
        <Text size="O400" truncate>
          {mimeTypeToExt(mimeType)}
        </Text>
      </Badge>
    </Box>
    <Box grow="Yes">
      <Text size="T300" truncate data-testid="file-name">
        {body}
      </Text>
    </Box>
    {after}
  </Box>
));
