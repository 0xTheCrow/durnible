import { Box, Icon } from 'folds';
import type { RefObject } from 'react';
import React from 'react';
import * as css from './Editor.css';
import { useEditorActiveFormats } from './useEditorActiveFormats';

type ActiveFormatBadgesProps = {
  inputRef: RefObject<HTMLDivElement | null>;
};

export function ActiveFormatBadges({ inputRef }: ActiveFormatBadgesProps) {
  const formats = useEditorActiveFormats(inputRef);
  if (formats.length === 0) return null;
  return (
    <Box className={css.ActiveFormatBadges} gap="100" alignItems="Center" aria-hidden>
      {formats.map((format) => (
        <span key={format.id} className={css.ActiveFormatBadge}>
          <Icon size="50" src={format.icon} />
        </span>
      ))}
    </Box>
  );
}
