import type { KeyboardEventHandler, MouseEventHandler } from 'react';
import React, { useCallback, useEffect, useState } from 'react';
import type { RectCords } from 'folds';
import { Box, Chip, Icon, IconButton, Icons, Line, PopOut, Spinner, Text, as, config } from 'folds';
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
  BlockType,
  CustomEditor,
  EmoticonAutocomplete,
  RoomMentionAutocomplete,
  Toolbar,
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
} from '../../../components/editor';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { useRelevantImagePacks } from '../../../hooks/useImagePacks';
import { ImageUsage } from '../../../plugins/custom-emoji/types';
import { buildShortcodeMap, emojis as unicodeEmojis } from '../../../plugins/emoji';
import { UseStateProvider } from '../../../components/UseStateProvider';
import { EmojiBoard } from '../../../components/emoji-board';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { getEditedEvent, getMentionContent, trimReplyFromFormattedBody } from '../../../utils/room';
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

    const [saveState, save] = useAsyncCallback(
      useCallback(async () => {
        const shortcodeMap = buildShortcodeMap(imagePacks, unicodeEmojis);
        const processedChildren = replaceShortcodes(editor.children, shortcodeMap);

        const plainText = toPlainText(processedChildren, isMarkdown).trim();
        const customHtml = trimCustomHtml(
          toMatrixCustomHTML(processedChildren, {
            allowTextFormatting: true,
            allowBlockMarkdown: isMarkdown,
            allowInlineMarkdown: isMarkdown,
          })
        );

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

        const mentionData = getMentions(mx, roomId, editor);

        prevMentions?.user_ids?.forEach((prevMentionId) => {
          mentionData.users.add(prevMentionId);
        });

        const mMentions = getMentionContent(Array.from(mentionData.users), mentionData.room);
        newContent['m.mentions'] = mMentions;

        if (!customHtmlEqualsPlainText(customHtml, plainText)) {
          newContent.format = 'org.matrix.custom.html';
          newContent.formatted_body = customHtml;
        }

        const content: IContent = {
          ...newContent,
          body: `* ${plainText}`,
          'm.new_content': newContent,
          'm.relates_to': {
            event_id: mEvent.getId(),
            rel_type: RelationType.Replace,
          },
        };

        return mx.sendMessage(roomId, content as RoomMessageEventContent);
      }, [mx, editor, roomId, mEvent, isMarkdown, getPrevBodyAndFormattedBody, imagePacks])
    );

    const handleSave = useCallback(() => {
      if (saveState.status !== AsyncStatus.Loading) {
        save();
      }
    }, [saveState, save]);

    const handleKeyDown: KeyboardEventHandler = useCallback(
      (evt) => {
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
        const text = typeof body === 'string' ? body : '';
        editor.children = [{ type: BlockType.Paragraph, children: [{ text }] }];
        editor.onChange();
        if (!mobileOrTablet()) {
          const el = alternateInputRef.current;
          if (el) {
            el.focus();
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          }
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
        if (!mobileOrTablet()) ReactEditor.focus(editor);
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
            requestClose={handleCloseAutocomplete}
            onSelect={alternateInput ? handleAlternateRoomMentionSelect : undefined}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.UserMention && (
          <UserMentionAutocomplete
            room={room}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
            onSelect={alternateInput ? handleAlternateMentionSelect : undefined}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.Emoticon && (
          <EmoticonAutocomplete
            imagePackRooms={imagePackRooms || []}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
            onSelect={alternateInput ? handleAlternateEmoticonSelect : undefined}
          />
        )}
        <CustomEditor
          ref={editorRef}
          editor={editor}
          alternateInputRef={alternateInputRef}
          placeholder="Edit message..."
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
                  {!alternateInput && (
                    <IconButton
                      variant="SurfaceVariant"
                      size="300"
                      radii="300"
                      onClick={() => setToolbar(!toolbar)}
                    >
                      <Icon size="400" src={toolbar ? Icons.AlphabetUnderline : Icons.Alphabet} />
                    </IconButton>
                  )}
                  <UseStateProvider initial={undefined}>
                    {(anchor: RectCords | undefined, setAnchor) => (
                      <PopOut
                        anchor={anchor}
                        alignOffset={-8}
                        position="Top"
                        align="End"
                        content={
                          <EmojiBoard
                            imagePackRooms={imagePackRooms ?? []}
                            returnFocusOnDeactivate={alternateInput && !mobileOrTablet()}
                            onEmojiSelect={handleEmoticonSelect}
                            onCustomEmojiSelect={handleEmoticonSelect}
                            requestClose={() => {
                              setAnchor((v) => {
                                if (v) {
                                  if (!alternateInput && !mobileOrTablet()) {
                                    ReactEditor.focus(editor);
                                  }
                                  return undefined;
                                }
                                return v;
                              });
                            }}
                          />
                        }
                      >
                        <IconButton
                          aria-pressed={anchor !== undefined}
                          onMouseDown={
                            alternateInput
                              ? (e: React.MouseEvent) => {
                                  e.preventDefault();
                                  alternateInputRef.current?.focus();
                                }
                              : undefined
                          }
                          onClick={
                            ((evt) =>
                              setAnchor(
                                evt.currentTarget.getBoundingClientRect()
                              )) as MouseEventHandler<HTMLButtonElement>
                          }
                          variant="SurfaceVariant"
                          size="300"
                          radii="300"
                        >
                          <Icon size="400" src={Icons.Smile} filled={anchor !== undefined} />
                        </IconButton>
                      </PopOut>
                    )}
                  </UseStateProvider>
                </Box>
              </Box>
              {!alternateInput && toolbar && (
                <div>
                  <Line variant="SurfaceVariant" size="300" />
                  <Toolbar />
                </div>
              )}
            </>
          }
        />
      </div>
    );
  }
);
