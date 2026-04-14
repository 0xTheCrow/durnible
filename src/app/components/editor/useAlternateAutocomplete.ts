import { useCallback, useRef, type RefObject } from 'react';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import type { BaseRange } from 'slate';
import type { AutocompletePrefix, AutocompleteQuery } from './autocomplete';
import { AUTOCOMPLETE_PREFIXES } from './autocomplete';
import {
  createAltCommandNode,
  createAltEmoticonNode,
  createAltMentionNode,
  replaceRangeWithNode,
  replaceTextInNode,
} from './altInput';
import { getViaServers } from '../../plugins/via-servers';

type AltAutocompleteRange = {
  textNode: Text | null;
  start: number;
  end: number;
};

export type AlternateAutocompleteHandlers = {
  detectAutocompleteQuery: (el: HTMLElement) => AutocompleteQuery<AutocompletePrefix> | undefined;
  handleMentionSelect: (userId: string, name: string) => void;
  handleRoomMentionSelect: (roomAliasOrId: string, name: string) => void;
  handleEmoticonSelect: (key: string, shortcode: string) => void;
  handleCommandSelect: (commandName: string) => void;
};

type Args = {
  alternateInputRef: RefObject<HTMLDivElement | null>;
  mx: MatrixClient;
  useAuthentication: boolean;
  room: Room;
  roomId: string;
};

export const useAlternateAutocomplete = ({
  alternateInputRef,
  mx,
  useAuthentication,
  room,
  roomId,
}: Args): AlternateAutocompleteHandlers => {
  const rangeRef = useRef<AltAutocompleteRange>({ textNode: null, start: 0, end: 0 });

  const sync = useCallback(() => {
    alternateInputRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [alternateInputRef]);

  const replaceText = useCallback(
    (insertText: string) => {
      const { textNode, start, end } = rangeRef.current;
      if (!textNode || !textNode.isConnected) return;
      replaceTextInNode(textNode, start, end, insertText);
      sync();
    },
    [sync]
  );

  const replaceWithNode = useCallback(
    (node: Node) => {
      const { textNode, start, end } = rangeRef.current;
      if (!textNode || !textNode.isConnected) return;
      replaceRangeWithNode(textNode, start, end, node);
      sync();
    },
    [sync]
  );

  const detectAutocompleteQuery = useCallback(
    (el: HTMLElement): AutocompleteQuery<AutocompletePrefix> | undefined => {
      const domSel = window.getSelection();
      if (!domSel || domSel.rangeCount === 0) return undefined;
      const domRange = domSel.getRangeAt(0);
      if (
        !domRange.collapsed ||
        !el.contains(domRange.startContainer) ||
        domRange.startContainer.nodeType !== Node.TEXT_NODE
      ) {
        return undefined;
      }
      const textNode = domRange.startContainer as Text;
      const caret = domRange.startOffset;
      const textBefore = textNode.data.slice(0, caret);

      let start = caret;
      while (start > 0 && textBefore[start - 1] !== ' ') start -= 1;
      const word = textBefore.slice(start, caret);
      const altPrefix = AUTOCOMPLETE_PREFIXES.find((p) => word.startsWith(p));
      if (!altPrefix) return undefined;

      rangeRef.current = { textNode, start, end: caret };
      const dummyRange: BaseRange = {
        anchor: { path: [0, 0], offset: start },
        focus: { path: [0, 0], offset: caret },
      };
      return { range: dummyRange, prefix: altPrefix, text: word.slice(1) };
    },
    []
  );

  const handleMentionSelect = useCallback(
    (userId: string, name: string) => {
      const displayName = name.startsWith('@') ? name : `@${name}`;
      const roomAliasOrId = room.getCanonicalAlias() || roomId;
      const highlight = mx.getUserId() === userId || roomAliasOrId === userId;
      const node = createAltMentionNode({ id: userId, name: displayName, highlight });
      replaceWithNode(node);
    },
    [mx, room, roomId, replaceWithNode]
  );

  const handleRoomMentionSelect = useCallback(
    (roomAliasOrId: string, name: string) => {
      const displayName = name.startsWith('#') ? name : `#${name}`;
      const mentionRoom = mx.getRoom(roomAliasOrId);
      const viaServers = mentionRoom ? getViaServers(mentionRoom) : undefined;
      const highlight = roomId === roomAliasOrId || room.getCanonicalAlias() === roomAliasOrId;
      const node = createAltMentionNode({
        id: roomAliasOrId,
        name: displayName,
        highlight,
        viaServers,
      });
      replaceWithNode(node);
    },
    [mx, room, roomId, replaceWithNode]
  );

  const handleEmoticonSelect = useCallback(
    (key: string, shortcode: string) => {
      if (key.startsWith('mxc://')) {
        const node = createAltEmoticonNode({ mx, useAuthentication, key, shortcode });
        replaceWithNode(node);
        return;
      }
      replaceText(`${key} `);
    },
    [mx, useAuthentication, replaceText, replaceWithNode]
  );

  const handleCommandSelect = useCallback(
    (commandName: string) => {
      const node = createAltCommandNode({ command: commandName });
      replaceWithNode(node);
    },
    [replaceWithNode]
  );

  return {
    detectAutocompleteQuery,
    handleMentionSelect,
    handleRoomMentionSelect,
    handleEmoticonSelect,
    handleCommandSelect,
  };
};
