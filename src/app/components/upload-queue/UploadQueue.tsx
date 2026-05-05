import React from 'react';
import { Box, Icon, Icons, Text } from 'folds';

import * as css from './UploadQueue.css';
import { UploadQueueCard } from './UploadQueueCard';
import type { UploadItem, UploadMetadata } from '../../state/room/roomInputDrafts';
import type { UploadContent } from '../../utils/matrix';

type UploadQueueProps = {
  items: UploadItem[];
  setMetadata: (fileItem: UploadItem, metadata: UploadMetadata) => void;
  onRemove: (file: UploadContent) => void;
  onClearAll: () => void;
  onReplaceFile: (fileItem: UploadItem, newFile: File) => void;
};

export function UploadQueue({
  items,
  setMetadata,
  onRemove,
  onClearAll,
  onReplaceFile,
}: UploadQueueProps) {
  return (
    <Box className={css.UploadQueue}>
      {items
        .slice()
        .reverse()
        .map((fileItem) => (
          <UploadQueueCard
            key={`upload-queue-card-${fileItem.id}`}
            fileItem={fileItem}
            setMetadata={setMetadata}
            onRemove={onRemove}
            onReplaceFile={onReplaceFile}
          />
        ))}
      {items.length >= 2 && (
        <button
          type="button"
          className={css.UploadQueueClearAll}
          onClick={onClearAll}
          aria-label="Cancel all uploads"
        >
          <Icon src={Icons.Delete} size="400" />
          <Text size="T200">Clear all</Text>
        </button>
      )}
    </Box>
  );
}
