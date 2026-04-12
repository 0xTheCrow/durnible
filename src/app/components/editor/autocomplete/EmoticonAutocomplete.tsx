import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import React, { useEffect, useMemo } from 'react';
import type { Editor } from 'slate';
import { Box, MenuItem, Text, toRem } from 'folds';
import type { Room } from 'matrix-js-sdk';

import type { AutocompleteQuery } from './autocompleteQuery';
import { AutocompleteMenu } from './AutocompleteMenu';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import type { UseAsyncSearchOptions } from '../../../hooks/useAsyncSearch';
import { useAsyncSearch } from '../../../hooks/useAsyncSearch';
import { onTabPress } from '../../../utils/keyboard';
import { createEmoticonElement, moveCursor, replaceWithElement } from '../utils';
import { useRecentEmoji } from '../../../hooks/useRecentEmoji';
import { useRelevantImagePacks } from '../../../hooks/useImagePacks';
import type { IEmoji } from '../../../plugins/emoji';
import { emojis } from '../../../plugins/emoji';
import { useKeyDown } from '../../../hooks/useKeyDown';
import { mxcUrlToHttp } from '../../../utils/matrix';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import type { PackImageReader } from '../../../plugins/custom-emoji';
import { ImageUsage } from '../../../plugins/custom-emoji';
import { getEmoticonSearchStr } from '../../../plugins/utils';

type EmoticonCompleteHandler = (key: string, shortcode: string) => void;

type EmoticonSearchItem = PackImageReader | IEmoji;

type EmoticonAutocompleteProps = {
  imagePackRooms: Room[];
  editor: Editor;
  query: AutocompleteQuery<string>;
  requestClose: () => void;
  onSelect?: (key: string, shortcode: string) => void;
};

const SEARCH_OPTIONS: UseAsyncSearchOptions = {
  matchOptions: {
    contain: true,
  },
};

export function EmoticonAutocomplete({
  imagePackRooms,
  editor,
  query,
  requestClose,
  onSelect,
}: EmoticonAutocompleteProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const imagePacks = useRelevantImagePacks(ImageUsage.Emoticon, imagePackRooms);
  const recentEmoji = useRecentEmoji(mx, 20);

  const searchList = useMemo(() => {
    const list: Array<EmoticonSearchItem> = [];
    return list.concat(
      imagePacks.flatMap((pack) => pack.getImages(ImageUsage.Emoticon)),
      emojis
    );
  }, [imagePacks]);

  const [result, search, resetSearch] = useAsyncSearch(
    searchList,
    getEmoticonSearchStr,
    SEARCH_OPTIONS
  );
  const autoCompleteEmoticon = result ? result.items.slice(0, 20) : recentEmoji;

  useEffect(() => {
    if (query.text) search(query.text);
    else resetSearch();
  }, [query.text, search, resetSearch]);

  const handleAutocomplete: EmoticonCompleteHandler = (key, shortcode) => {
    if (onSelect) {
      onSelect(key, shortcode);
      requestClose();
      return;
    }
    const emoticonEl = createEmoticonElement(key, shortcode);
    replaceWithElement(editor, query.range, emoticonEl);
    moveCursor(editor, true);
    requestClose();
  };

  useKeyDown(window, (evt: KeyboardEvent) => {
    onTabPress(evt, () => {
      if (evt.target instanceof HTMLButtonElement) return;
      if (autoCompleteEmoticon.length === 0) return;
      const emoticon = autoCompleteEmoticon[0];
      const key = 'url' in emoticon ? emoticon.url : emoticon.unicode;
      handleAutocomplete(key, emoticon.shortcode);
    });
  });

  return autoCompleteEmoticon.length === 0 ? null : (
    <AutocompleteMenu headerContent={<Text size="L400">Emojis</Text>} requestClose={requestClose}>
      {autoCompleteEmoticon.map((emoticon) => {
        const isCustomEmoji = 'url' in emoticon;
        const key = isCustomEmoji ? emoticon.url : emoticon.unicode;
        return (
          <MenuItem
            key={emoticon.shortcode + key}
            as="button"
            radii="300"
            onKeyDown={(evt: ReactKeyboardEvent<HTMLButtonElement>) =>
              onTabPress(evt, () => handleAutocomplete(key, emoticon.shortcode))
            }
            onClick={() => handleAutocomplete(key, emoticon.shortcode)}
            before={
              isCustomEmoji ? (
                <Box
                  shrink="No"
                  as="img"
                  src={mxcUrlToHttp(mx, key, useAuthentication) || key}
                  alt={emoticon.shortcode}
                  style={{ width: toRem(24), height: toRem(24), objectFit: 'contain' }}
                />
              ) : (
                <Box
                  shrink="No"
                  as="span"
                  display="InlineFlex"
                  style={{ fontSize: toRem(24), lineHeight: toRem(24) }}
                >
                  {key}
                </Box>
              )
            }
          >
            <Text style={{ flexGrow: 1 }} size="B400" truncate>
              :{emoticon.shortcode}:
            </Text>
          </MenuItem>
        );
      })}
    </AutocompleteMenu>
  );
}
