import type { KeyboardEventHandler } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Chip, Icon, IconButton, Icons, Line, Spinner, Text, as, config } from 'folds';
import type { IContent, IMentions, MatrixEvent, Room } from 'matrix-js-sdk';
import { RelationType } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { isKeyHotkey } from 'is-hotkey';
import type { AutocompleteQuery, EditorController } from '../../../components/editor';
import {
  AutocompletePrefix,
  CustomEditor,
  EmoticonAutocomplete,
  RoomMentionAutocomplete,
  EditorToolbar,
  UserMentionAutocomplete,
  createEmoticonNode,
  useEditorAutocomplete,
  customHtmlEqualsPlainText,
  trimCustomHtml,
  domToMatrixCustomHTML,
  domToPlainText,
  getMentionsFromDom,
  replaceShortcodesInDom,
  isInsideList,
  handleListEnter,
} from '../../../components/editor';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { useRelevantImagePacks } from '../../../hooks/useImagePacks';
import { ImageUsage } from '../../../plugins/custom-emoji/types';
import { buildShortcodeMap, emojis as unicodeEmojis } from '../../../plugins/emoji';
import { EmojiBoardWrapper } from '../../../components/emoji-board';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { getEditedEvent, getMentionContent, trimReplyFromFormattedBody } from '../../../utils/room';
import { sanitizeText } from '../../../utils/sanitize';
import { mobileOrTablet } from '../../../utils/user-agent';
import { useComposingCheck } from '../../../hooks/useComposingCheck';

type MessageEditorProps = {
  roomId: string;
  room: Room;
  mEvent: MatrixEvent;
  imagePackRooms?: Room[];
  onCancel: () => void;
};
export const MessageEditor = as<'div', MessageEditorProps>(
  ({ room, roomId, mEvent, imagePackRooms, onCancel, ...props }, ref) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const [enterForNewline] = useSetting(settingsAtom, 'enterForNewline');
    const [globalToolbar] = useSetting(settingsAtom, 'editorToolbar');
    const [isMarkdown] = useSetting(settingsAtom, 'isMarkdown');
    const [toolbar, setToolbar] = useState(globalToolbar);
    const isComposing = useComposingCheck();
    const editorInputRef = useRef<EditorController | null>(null);
    const editableElRef = useRef<HTMLDivElement | null>(null);
    editableElRef.current = editorInputRef.current?.el ?? null;
    const stableImagePackRooms = React.useMemo(() => imagePackRooms ?? [], [imagePackRooms]);
    const imagePacks = useRelevantImagePacks(ImageUsage.Emoticon, stableImagePackRooms);

    const [autocompleteQuery, setAutocompleteQuery] =
      useState<AutocompleteQuery<AutocompletePrefix>>();

    const editorAutocomplete = useEditorAutocomplete({
      editorInputRef: {
        get current() {
          return editorInputRef.current?.el ?? null;
        },
      },
      mx,
      useAuthentication,
      room,
      roomId,
    });
    const {
      handleMentionSelect,
      handleRoomMentionSelect,
      handleEmoticonSelect: handleAutocompleteEmoticonSelect,
    } = editorAutocomplete;

    const getPrevBodyAndFormattedBody = useCallback((): [
      string | undefined,
      string | undefined,
      IMentions | undefined
    ] => {
      const evtId = mEvent.getId();
      const evtTimeline = evtId ? room.getTimelineForEvent(evtId) : undefined;
      const editedEvent =
        evtId && evtTimeline
          ? getEditedEvent(evtId, mEvent, evtTimeline.getTimelineSet())
          : undefined;

      const content: IContent = editedEvent?.getContent()['m.new_content'] ?? mEvent.getContent();
      const { body, formatted_body: customHtml }: Record<string, unknown> = content;

      const mMentions: IMentions | undefined = content['m.mentions'];

      return [
        typeof body === 'string' ? body : undefined,
        typeof customHtml === 'string' ? customHtml : undefined,
        mMentions,
      ];
    }, [room, mEvent]);

    const buildEditContent = useCallback((): IContent | undefined => {
      const shortcodeMap = buildShortcodeMap(imagePacks, unicodeEmojis);
      const el = editorInputRef.current?.el;
      if (!el) return undefined;

      replaceShortcodesInDom(el, shortcodeMap, mx, useAuthentication);
      const plainText = domToPlainText(el).trim();
      const customHtml = trimCustomHtml(
        domToMatrixCustomHTML(el, {
          allowTextFormatting: true,
          allowBlockMarkdown: isMarkdown,
          allowInlineMarkdown: isMarkdown,
        })
      );
      const mentionData = getMentionsFromDom(el, mx);

      const [prevBody, prevCustomHtml, prevMentions] = getPrevBodyAndFormattedBody();

      if (plainText === '') return undefined;
      if (prevBody) {
        if (prevCustomHtml && trimReplyFromFormattedBody(prevCustomHtml) === customHtml) {
          return undefined;
        }
        if (
          !prevCustomHtml &&
          prevBody === plainText &&
          customHtmlEqualsPlainText(customHtml, plainText)
        ) {
          return undefined;
        }
      }

      const newContent: IContent = {
        msgtype: mEvent.getContent().msgtype,
        body: plainText,
      };

      prevMentions?.user_ids?.forEach((prevMentionId) => {
        mentionData.users.add(prevMentionId);
      });

      const mMentions = getMentionContent(Array.from(mentionData.users), mentionData.room);
      newContent['m.mentions'] = mMentions;

      if (!customHtmlEqualsPlainText(customHtml, plainText)) {
        newContent.format = 'org.matrix.custom.html';
        newContent.formatted_body = customHtml;
      }

      return {
        ...newContent,
        body: `* ${plainText}`,
        'm.new_content': newContent,
        'm.relates_to': {
          event_id: mEvent.getId(),
          rel_type: RelationType.Replace,
        },
      };
    }, [mx, mEvent, isMarkdown, getPrevBodyAndFormattedBody, imagePacks, useAuthentication]);

    const [saveState, save] = useAsyncCallback(
      useCallback(async () => {
        const content = buildEditContent();
        if (!content) return undefined;
        return mx.sendMessage(roomId, content as RoomMessageEventContent);
      }, [mx, roomId, buildEditContent])
    );

    const handleSave = useCallback(() => {
      if (saveState.status !== AsyncStatus.Loading) {
        save();
      }
    }, [saveState, save]);

    const handleKeyDown: KeyboardEventHandler = useCallback(
      (evt) => {
        const el = editorInputRef.current?.el;
        if (isKeyHotkey('shift+enter', evt) && el && isInsideList(el)) {
          evt.preventDefault();
          handleListEnter(el);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
        if (
          (isKeyHotkey('mod+enter', evt) || (!enterForNewline && isKeyHotkey('enter', evt))) &&
          !isComposing(evt)
        ) {
          evt.preventDefault();
          handleSave();
        }
        if (isKeyHotkey('escape', evt)) {
          evt.preventDefault();
          onCancel();
        }
      },
      [onCancel, handleSave, enterForNewline, isComposing]
    );

    const handleKeyUp: KeyboardEventHandler = useCallback(
      (evt) => {
        if (isKeyHotkey('escape', evt)) {
          evt.preventDefault();
          return;
        }
        const el = evt.currentTarget as HTMLDivElement;
        setAutocompleteQuery(editorAutocomplete.detectAutocompleteQuery(el));
      },
      [editorAutocomplete]
    );

    const handleCloseAutocomplete = useCallback(() => {
      setAutocompleteQuery(undefined);
    }, []);

    const handleEmoticonSelect = (key: string, shortcode: string) => {
      const controller = editorInputRef.current;
      if (!controller) return;
      if (key.startsWith('mxc://')) {
        const node = createEmoticonNode({ mx, useAuthentication, key, shortcode });
        controller.insertNode(node);
        return;
      }
      controller.insertText(key);
    };

    useEffect(() => {
      const [body, customHtml] = getPrevBodyAndFormattedBody();
      const controller = editorInputRef.current;
      if (!controller) return;

      const plainBody = typeof body === 'string' ? body : '';
      const html =
        typeof customHtml === 'string'
          ? customHtml
          : sanitizeText(plainBody).replace(/\n/g, '<br>');
      controller.setContent(html);
      const el = controller.el;
      if (el) {
        el.focus();
        let target: Node = el;
        while (target.lastChild) {
          target = target.lastChild;
        }
        const range = document.createRange();
        if (target.nodeType === Node.TEXT_NODE) {
          range.setStart(target, (target as Text).data.length);
        } else {
          range.selectNodeContents(target);
        }
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, [getPrevBodyAndFormattedBody]);

    useEffect(() => {
      if (saveState.status === AsyncStatus.Success) {
        onCancel();
      }
    }, [saveState, onCancel]);

    return (
      <div {...props} ref={ref}>
        {autocompleteQuery?.prefix === AutocompletePrefix.RoomMention && (
          <RoomMentionAutocomplete
            query={autocompleteQuery}
            onClose={handleCloseAutocomplete}
            onSelect={handleRoomMentionSelect}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.UserMention && (
          <UserMentionAutocomplete
            room={room}
            query={autocompleteQuery}
            onClose={handleCloseAutocomplete}
            onSelect={handleMentionSelect}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.Emoticon && (
          <EmoticonAutocomplete
            imagePackRooms={imagePackRooms || []}
            query={autocompleteQuery}
            onClose={handleCloseAutocomplete}
            onSelect={handleAutocompleteEmoticonSelect}
          />
        )}
        <CustomEditor
          editorInputRef={editorInputRef}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          bottom={
            <>
              <Box
                style={{ padding: config.space.S200, paddingTop: 0 }}
                alignItems="End"
                justifyContent="SpaceBetween"
                gap="100"
              >
                <Box gap="Inherit">
                  <Chip
                    data-testid="message-editor-save"
                    onClick={handleSave}
                    variant="Primary"
                    radii="Pill"
                    disabled={saveState.status === AsyncStatus.Loading}
                    outlined
                    before={
                      saveState.status === AsyncStatus.Loading ? (
                        <Spinner variant="Primary" fill="Soft" size="100" />
                      ) : undefined
                    }
                  >
                    <Text size="B300">Save</Text>
                  </Chip>
                  <Chip
                    data-testid="message-editor-cancel"
                    onClick={onCancel}
                    variant="SurfaceVariant"
                    radii="Pill"
                  >
                    <Text size="B300">Cancel</Text>
                  </Chip>
                </Box>
                <Box gap="Inherit">
                  <IconButton
                    variant="SurfaceVariant"
                    size="300"
                    radii="300"
                    onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
                    onTouchStart={(e: React.TouchEvent) => e.preventDefault()}
                    onClick={() => setToolbar(!toolbar)}
                  >
                    <Icon size="400" src={toolbar ? Icons.AlphabetUnderline : Icons.Alphabet} />
                  </IconButton>
                  <EmojiBoardWrapper
                    alignOffset={-8}
                    position="Top"
                    align="End"
                    imagePackRooms={imagePackRooms ?? []}
                    returnFocusOnDeactivate={!mobileOrTablet()}
                    onEmojiSelect={handleEmoticonSelect}
                    onCustomEmojiSelect={handleEmoticonSelect}
                    onClose={() => editorInputRef.current?.focus()}
                  >
                    {({ triggerRef, open, isOpen }) => (
                      <IconButton
                        ref={triggerRef}
                        aria-pressed={isOpen}
                        onMouseDown={(e: React.MouseEvent) => {
                          e.preventDefault();
                          editorInputRef.current?.focus();
                        }}
                        onClick={open}
                        variant="SurfaceVariant"
                        size="300"
                        radii="300"
                      >
                        <Icon size="400" src={Icons.Smile} filled={isOpen} />
                      </IconButton>
                    )}
                  </EmojiBoardWrapper>
                </Box>
              </Box>
              {toolbar && (
                <div>
                  <Line variant="SurfaceVariant" size="300" />
                  <EditorToolbar
                    inputRef={{
                      get current() {
                        return editorInputRef.current?.el ?? null;
                      },
                    }}
                  />
                </div>
              )}
            </>
          }
        />
      </div>
    );
  }
);
