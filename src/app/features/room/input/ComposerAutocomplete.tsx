import type { RefObject } from 'react';
import React, { useEffect, useState } from 'react';
import type { Room } from 'matrix-js-sdk';

import type { AutocompleteQuery } from '../../../components/editor';
import {
  AutocompletePrefix,
  EmoticonAutocomplete,
  RoomMentionAutocomplete,
  UserMentionAutocomplete,
  useEditorAutocomplete,
} from '../../../components/editor';
import { CommandAutocomplete } from './CommandAutocomplete';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';

type ComposerAutocompleteProps = {
  editorElementRef: RefObject<HTMLDivElement | null>;
  room: Room;
  roomId: string;
  imagePackRooms: Room[];
  checkIsAutocompleteVisible: (isAutocompleteVisible: boolean) => void;
  registerAutocompleteCloser: (closeAutocomplete: () => void) => void;
};

export function ComposerAutocomplete({
  editorElementRef,
  room,
  roomId,
  imagePackRooms,
  checkIsAutocompleteVisible,
  registerAutocompleteCloser,
}: ComposerAutocompleteProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [query, setQuery] = useState<AutocompleteQuery<AutocompletePrefix>>();

  const {
    detectAutocompleteQuery,
    handleMentionSelect,
    handleRoomMentionSelect,
    handleEmoticonSelect,
    handleCommandSelect,
  } = useEditorAutocomplete({
    editorInputRef: editorElementRef,
    mx,
    useAuthentication,
    room,
    roomId,
  });

  useEffect(() => {
    const sync = () => {
      const editorElement = editorElementRef.current;
      if (!editorElement) return;
      const next = detectAutocompleteQuery(editorElement);
      setQuery((current) =>
        current?.prefix === next?.prefix && current?.text === next?.text ? current : next
      );
    };
    const syncOnInput = (event: Event) => {
      const editorElement = editorElementRef.current;
      if (editorElement && editorElement.contains(event.target as Node)) sync();
    };
    const syncOnSelection = () => {
      const editorElement = editorElementRef.current;
      const selection = document.getSelection();
      if (
        editorElement &&
        selection &&
        selection.rangeCount > 0 &&
        editorElement.contains(selection.getRangeAt(0).startContainer)
      ) {
        sync();
      }
    };

    document.addEventListener('input', syncOnInput, true);
    document.addEventListener('selectionchange', syncOnSelection);
    return () => {
      document.removeEventListener('input', syncOnInput, true);
      document.removeEventListener('selectionchange', syncOnSelection);
    };
  }, [editorElementRef, detectAutocompleteQuery]);

  const isAutocompleteVisible = query !== undefined;
  checkIsAutocompleteVisible(isAutocompleteVisible);

  const closeQuery = () => setQuery(undefined);
  registerAutocompleteCloser(closeQuery);

  return (
    <>
      {query?.prefix === AutocompletePrefix.RoomMention && (
        <RoomMentionAutocomplete
          query={query}
          onClose={closeQuery}
          onSelect={handleRoomMentionSelect}
        />
      )}
      {query?.prefix === AutocompletePrefix.UserMention && (
        <UserMentionAutocomplete
          room={room}
          query={query}
          onClose={closeQuery}
          onSelect={handleMentionSelect}
        />
      )}
      {query?.prefix === AutocompletePrefix.Emoticon && (
        <EmoticonAutocomplete
          imagePackRooms={imagePackRooms}
          query={query}
          onClose={closeQuery}
          onSelect={handleEmoticonSelect}
        />
      )}
      {query?.prefix === AutocompletePrefix.Command && (
        <CommandAutocomplete
          room={room}
          query={query}
          onClose={closeQuery}
          onSelect={handleCommandSelect}
        />
      )}
    </>
  );
}
