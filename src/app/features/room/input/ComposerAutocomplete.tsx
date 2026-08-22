import type { RefObject } from 'react';
import React, { useEffect, useState } from 'react';
import type { Room } from 'matrix-js-sdk';
import { isKeyHotkey } from 'is-hotkey';

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
  onOpenChange: (isOpen: boolean) => void;
};

export function ComposerAutocomplete({
  editorElementRef,
  room,
  roomId,
  imagePackRooms,
  onOpenChange,
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

  const isOpen = query !== undefined;
  useEffect(() => {
    onOpenChange(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (evt: KeyboardEvent) => {
      if (isKeyHotkey('escape', evt)) setQuery(undefined);
    };
    document.addEventListener('keydown', closeOnEscape, true);
    return () => document.removeEventListener('keydown', closeOnEscape, true);
  }, [isOpen]);

  const closeQuery = () => setQuery(undefined);

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
