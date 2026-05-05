import { useCallback, useRef, type RefObject } from 'react';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import type { AutocompletePrefix, AutocompleteQuery } from './autocomplete';
import { AUTOCOMPLETE_PREFIXES } from './autocomplete';
import {
  createCommandNode,
  createEmoticonNode,
  createMentionNode,
  replaceRangeWithNode,
  replaceTextInNode,
} from './editorInput';
import { getViaServers } from '../../plugins/via-servers';

type EditorAutocompleteRange = {
  textNode: Text | null;
  start: number;
  end: number;
};

const findAutocompleteTrigger = (
  text: string
): { triggerPos: number; prefix: AutocompletePrefix; query: string } | undefined => {
  for (let i = text.length - 1; i >= 0; i -= 1) {
    const ch = text[i];
    if (ch === ' ') return undefined;
    const matched = AUTOCOMPLETE_PREFIXES.find((p) => p === ch);
    if (matched) {
      if (i > 0 && text[i - 1] !== ' ') return undefined;
      return { triggerPos: i, prefix: matched, query: text.slice(i + 1) };
    }
  }
  return undefined;
};

export type EditorAutocompleteHandlers = {
  detectAutocompleteQuery: (el: HTMLElement) => AutocompleteQuery<AutocompletePrefix> | undefined;
  handleMentionSelect: (userId: string, name: string) => void;
  handleRoomMentionSelect: (roomAliasOrId: string, name: string) => void;
  handleEmoticonSelect: (key: string, shortcode: string) => void;
  handleCommandSelect: (commandName: string) => void;
};

type Args = {
  editorInputRef: RefObject<HTMLDivElement | null>;
  mx: MatrixClient;
  useAuthentication: boolean;
  room: Room;
  roomId: string;
};

export const useEditorAutocomplete = ({
  editorInputRef,
  mx,
  useAuthentication,
  room,
  roomId,
}: Args): EditorAutocompleteHandlers => {
  const rangeRef = useRef<EditorAutocompleteRange>({ textNode: null, start: 0, end: 0 });

  const sync = useCallback(() => {
    editorInputRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [editorInputRef]);

  const replaceText = useCallback(
    (insertText: string) => {
      const { textNode, start, end } = rangeRef.current;
      if (!textNode || !textNode.isConnected) return;
      editorInputRef.current?.focus();
      replaceTextInNode(textNode, start, end, insertText);
      sync();
    },
    [editorInputRef, sync]
  );

  const replaceWithNode = useCallback(
    (node: Node, trailingText = '') => {
      const { textNode, start, end } = rangeRef.current;
      if (!textNode || !textNode.isConnected) return;
      editorInputRef.current?.focus();
      const result = replaceRangeWithNode(textNode, start, end, node);
      if (trailingText) {
        result.node.insertData(0, trailingText);
        const range = document.createRange();
        range.setStart(result.node, trailingText.length);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      sync();
    },
    [editorInputRef, sync]
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
      const trigger = findAutocompleteTrigger(textNode.data.slice(0, caret));
      if (!trigger) return undefined;

      rangeRef.current = { textNode, start: trigger.triggerPos, end: caret };
      return {
        prefix: trigger.prefix,
        text: trigger.query,
      };
    },
    []
  );

  const handleMentionSelect = useCallback(
    (userId: string, name: string) => {
      const displayName = name.startsWith('@') ? name : `@${name}`;
      const roomAliasOrId = room.getCanonicalAlias() || roomId;
      const highlight = mx.getUserId() === userId || roomAliasOrId === userId;
      const node = createMentionNode({ id: userId, name: displayName, highlight });
      replaceWithNode(node, ' ');
    },
    [mx, room, roomId, replaceWithNode]
  );

  const handleRoomMentionSelect = useCallback(
    (roomAliasOrId: string, name: string) => {
      const displayName = name.startsWith('#') ? name : `#${name}`;
      const mentionRoom = mx.getRoom(roomAliasOrId);
      const viaServers = mentionRoom ? getViaServers(mentionRoom) : undefined;
      const highlight = roomId === roomAliasOrId || room.getCanonicalAlias() === roomAliasOrId;
      const node = createMentionNode({
        id: roomAliasOrId,
        name: displayName,
        highlight,
        viaServers,
      });
      replaceWithNode(node, ' ');
    },
    [mx, room, roomId, replaceWithNode]
  );

  const handleEmoticonSelect = useCallback(
    (key: string, shortcode: string) => {
      if (key.startsWith('mxc://')) {
        const node = createEmoticonNode({ mx, useAuthentication, key, shortcode });
        replaceWithNode(node);
        return;
      }
      replaceText(`${key} `);
    },
    [mx, useAuthentication, replaceText, replaceWithNode]
  );

  const handleCommandSelect = useCallback(
    (commandName: string) => {
      const node = createCommandNode({ command: commandName });
      replaceWithNode(node, ' ');
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
