import type { KeyboardEventHandler } from 'react';
import React, { useCallback, useEffect, useState } from 'react';
import { Box, Chip, Icon, IconButton, Icons, Line, Spinner, Text, as, config } from 'folds';
import { Editor, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import type { IContent, IMentions, MatrixEvent, Room } from 'matrix-js-sdk';
import { RelationType } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { isKeyHotkey } from 'is-hotkey';
import type { AutocompleteQuery } from '../../../components/editor';
import {
  AUTOCOMPLETE_PREFIXES,
  AutocompletePrefix,
  CustomEditor,
  EmoticonAutocomplete,
  RoomMentionAutocomplete,
  Toolbar,
  AltInputToolbar,
  UserMentionAutocomplete,
  createAltEmoticonNode,
  createEmoticonElement,
  useAlternateAutocomplete,
  customHtmlEqualsPlainText,
  getAutocompleteQuery,
  getPrevWorldRange,
  htmlToEditorInput,
  moveCursor,
  plainToEditorInput,
  toMatrixCustomHTML,
  toPlainText,
  trimCustomHtml,
  useEditor,
  getMentions,
  replaceShortcodes,
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
    const editor = useEditor();
    const [enterForNewline] = useSetting(settingsAtom, 'enterForNewline');
    const [globalToolbar] = useSetting(settingsAtom, 'editorToolbar');
    const [isMarkdown] = useSetting(settingsAtom, 'isMarkdown');
    const [alternateInput] = useSetting(settingsAtom, 'alternateInput');
    const [toolbar, setToolbar] = useState(globalToolbar);
    const isComposing = useComposingCheck();
    const editorRef = React.useRef<HTMLDivElement>(null);
    const alternateInputRef = React.useRef<HTMLDivElement>(null);
    const stableImagePackRooms = React.useMemo(() => imagePackRooms ?? [], [imagePackRooms]);
    const imagePacks = useRelevantImagePacks(ImageUsage.Emoticon, stableImagePackRooms);

    const [autocompleteQuery, setAutocompleteQuery] =
      useState<AutocompleteQuery<AutocompletePrefix>>();

    const altAutocomplete = useAlternateAutocomplete({
      alternateInputRef,
      mx,
      useAuthentication,
      room,
      roomId,
    });
    const {
      handleMentionSelect: handleAlternateMentionSelect,
      handleRoomMentionSelect: handleAlternateRoomMentionSelect,
      handleEmoticonSelect: handleAlternateEmoticonSelect,
    } = altAutocomplete;

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
      const el = alternateInputRef.current;

      let plainText: string;
      let customHtml: string;
      let mentionData;

      if (alternateInput && el) {
        replaceShortcodesInDom(el, shortcodeMap, mx, useAuthentication);
        plainText = domToPlainText(el).trim();
        customHtml = trimCustomHtml(
          domToMatrixCustomHTML(el, {
            allowTextFormatting: true,
            allowBlockMarkdown: isMarkdown,
            allowInlineMarkdown: isMarkdown,
          })
        );
        mentionData = getMentionsFromDom(el, mx);
      } else {
        const processedChildren = replaceShortcodes(editor.children, shortcodeMap);
        plainText = toPlainText(processedChildren, isMarkdown).trim();
        customHtml = trimCustomHtml(
          toMatrixCustomHTML(processedChildren, {
            allowTextFormatting: true,
            allowBlockMarkdown: isMarkdown,
            allowInlineMarkdown: isMarkdown,
          })
        );
        mentionData = getMentions(mx, roomId, editor);
      }

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
    }, [
      mx,
      editor,
      roomId,
      mEvent,
      isMarkdown,
      getPrevBodyAndFormattedBody,
      imagePacks,
      alternateInput,
      alternateInputRef,
      useAuthentication,
    ]);

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
        if (
          alternateInput &&
          isKeyHotkey('shift+enter', evt) &&
          alternateInputRef.current &&
          isInsideList(alternateInputRef.current)
        ) {
          evt.preventDefault();
          handleListEnter(alternateInputRef.current);
          alternateInputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
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
      [onCancel, handleSave, enterForNewline, isComposing, alternateInput]
    );

    const handleKeyUp: KeyboardEventHandler = useCallback(
      (evt) => {
        if (isKeyHotkey('escape', evt)) {
          evt.preventDefault();
          return;
        }

        if (alternateInput) {
          const el = evt.currentTarget as HTMLDivElement;
          setAutocompleteQuery(altAutocomplete.detectAutocompleteQuery(el));
          return;
        }
        const prevWordRange = getPrevWorldRange(editor);
        const query = prevWordRange
          ? getAutocompleteQuery<AutocompletePrefix>(editor, prevWordRange, AUTOCOMPLETE_PREFIXES)
          : undefined;
        setAutocompleteQuery(query);
      },
      [editor, alternateInput, altAutocomplete]
    );

    const handleCloseAutocomplete = useCallback(() => {
      if (!alternateInput) ReactEditor.focus(editor);
      setAutocompleteQuery(undefined);
    }, [editor, alternateInput]);

    const handleEmoticonSelect = (key: string, shortcode: string) => {
      if (alternateInput) {
        if (key.startsWith('mxc://') && editor.insertAlternateNode) {
          const node = createAltEmoticonNode({ mx, useAuthentication, key, shortcode });
          editor.insertAlternateNode(node);
          return;
        }
        editor.insertAlternateText?.(key);
        return;
      }
      editor.insertNode(createEmoticonElement(key, shortcode));
      moveCursor(editor);
    };

    useEffect(() => {
      const [body, customHtml] = getPrevBodyAndFormattedBody();

      if (alternateInput) {
        const plainBody = typeof body === 'string' ? body : '';
        const html =
          typeof customHtml === 'string'
            ? customHtml
            : sanitizeText(plainBody).replace(/\n/g, '<br>');
        editor.setAlternateInputContent?.(html);
        const el = alternateInputRef.current;
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
      } else {
        const initialValue =
          typeof customHtml === 'string'
            ? htmlToEditorInput(customHtml, isMarkdown)
            : plainToEditorInput(typeof body === 'string' ? body : '', isMarkdown);

        Transforms.select(editor, {
          anchor: Editor.start(editor, []),
          focus: Editor.end(editor, []),
        });

        editor.insertFragment(initialValue);
        ReactEditor.focus(editor);
      }
    }, [editor, getPrevBodyAndFormattedBody, isMarkdown, alternateInput]);

    useEffect(() => {
      if (saveState.status === AsyncStatus.Success) {
        onCancel();
      }
    }, [saveState, onCancel]);

    return (
      <div {...props} ref={ref}>
        {autocompleteQuery?.prefix === AutocompletePrefix.RoomMention && (
          <RoomMentionAutocomplete
            roomId={roomId}
            editor={editor}
            query={autocompleteQuery}
            onClose={handleCloseAutocomplete}
            onSelect={alternateInput ? handleAlternateRoomMentionSelect : undefined}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.UserMention && (
          <UserMentionAutocomplete
            room={room}
            editor={editor}
            query={autocompleteQuery}
            onClose={handleCloseAutocomplete}
            onSelect={alternateInput ? handleAlternateMentionSelect : undefined}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.Emoticon && (
          <EmoticonAutocomplete
            imagePackRooms={imagePackRooms || []}
            editor={editor}
            query={autocompleteQuery}
            onClose={handleCloseAutocomplete}
            onSelect={alternateInput ? handleAlternateEmoticonSelect : undefined}
          />
        )}
        <CustomEditor
          ref={editorRef}
          editor={editor}
          alternateInputRef={alternateInputRef}
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
                    returnFocusOnDeactivate={alternateInput && !mobileOrTablet()}
                    onEmojiSelect={handleEmoticonSelect}
                    onCustomEmojiSelect={handleEmoticonSelect}
                    onClose={() => {
                      if (!alternateInput && !mobileOrTablet()) {
                        ReactEditor.focus(editor);
                      }
                    }}
                  >
                    {({ triggerRef, open, isOpen }) => (
                      <IconButton
                        ref={triggerRef}
                        aria-pressed={isOpen}
                        onMouseDown={
                          alternateInput
                            ? (e: React.MouseEvent) => {
                                e.preventDefault();
                                alternateInputRef.current?.focus();
                              }
                            : undefined
                        }
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
                  {alternateInput ? <AltInputToolbar inputRef={alternateInputRef} /> : <Toolbar />}
                </div>
              )}
            </>
          }
        />
      </div>
    );
  }
);
