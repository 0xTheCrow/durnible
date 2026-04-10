import type { KeyboardEventHandler, RefObject } from 'react';
import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { isKeyHotkey } from 'is-hotkey';
import type { IContent, Room } from 'matrix-js-sdk';
import { EventType, MsgType, RelationType } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/types';
import { ReactEditor } from 'slate-react';
import type { Editor, BaseRange } from 'slate';
import { Transforms } from 'slate';
import {
  Box,
  Dialog,
  Icon,
  IconButton,
  Icons,
  Line,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  PopOut,
  Scroll,
  Text,
  config,
  toRem,
} from 'folds';

import { useMatrixClient } from '../../hooks/useMatrixClient';
import type { AutocompleteQuery } from '../../components/editor';
import {
  CustomEditor,
  Toolbar,
  toMatrixCustomHTML,
  toPlainText,
  AUTOCOMPLETE_PREFIXES,
  AutocompletePrefix,
  getAutocompleteQuery,
  getPrevWorldRange,
  resetEditor,
  resetEditorDirect,
  RoomMentionAutocomplete,
  UserMentionAutocomplete,
  EmoticonAutocomplete,
  createEmoticonElement,
  moveCursor,
  resetEditorHistory,
  customHtmlEqualsPlainText,
  trimCustomHtml,
  isEmptyEditor,
  getBeginCommand,
  trimCommand,
  getMentions,
  replaceShortcodes,
  BlockType,
} from '../../components/editor';
import { EmojiBoard, EmojiBoardTab } from '../../components/emoji-board';
import { UseStateProvider } from '../../components/UseStateProvider';
import type { TUploadContent } from '../../utils/matrix';
import { getImageInfo, getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { encryptFileInWorker } from '../../utils/encryptWorker';
import { useTypingStatusUpdater } from '../../hooks/useTypingStatusUpdater';
import { useFilePicker } from '../../hooks/useFilePicker';
import { useFilePasteHandler } from '../../hooks/useFilePasteHandler';
import { useFileDropZone } from '../../hooks/useFileDrop';
import type { TUploadItem, TUploadMetadata } from '../../state/room/roomInputDrafts';
import {
  roomIdToMsgDraftAtomFamily,
  roomIdToReplyDraftAtomFamily,
  roomIdToUploadItemsAtomFamily,
  roomUploadAtomFamily,
} from '../../state/room/roomInputDrafts';
import { UploadCardRenderer } from '../../components/upload-card';
import type { UploadBoardImperativeHandlers } from '../../components/upload-board';
import { UploadBoard, UploadBoardContent, UploadBoardHeader } from '../../components/upload-board';
import type { Upload, UploadSuccess } from '../../state/upload';
import { UploadStatus, createUploadFamilyObserverAtom } from '../../state/upload';
import { getImageUrlBlob, loadImageElement } from '../../utils/dom';
import { handleUploadFiles } from './handleUploadFiles';
import { fulfilledPromiseSettledResult } from '../../utils/common';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import {
  getAudioMsgContent,
  getFileMsgContent,
  getImageMsgContent,
  getVideoMsgContent,
} from './msgContent';
import { getMemberDisplayName, getMentionContent, trimReplyFromBody } from '../../utils/room';
import { sanitizeText } from '../../utils/sanitize';
import { CommandAutocomplete } from './CommandAutocomplete';
import { VoiceMessageRecorder } from './VoiceMessageRecorder';
import { Command, SHRUG, TABLEFLIP, UNFLIP, useCommands } from '../../hooks/useCommands';
import { mobileOrTablet } from '../../utils/user-agent';
import { useElementSizeObserver } from '../../hooks/useElementSizeObserver';
import { ReplyLayout, ThreadIndicator } from '../../components/message';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useImagePackRooms } from '../../hooks/useImagePackRooms';
import { useRelevantImagePacks } from '../../hooks/useImagePacks';
import { ImageUsage } from '../../plugins/custom-emoji/types';
import { buildShortcodeMap, emojis as unicodeEmojis } from '../../plugins/emoji';
import { usePowerLevelsContext } from '../../hooks/usePowerLevels';
import colorMXID from '../../../util/colorMXID';
import { useIsDirectRoom } from '../../hooks/useRoom';
import { useAccessiblePowerTagColors, useGetMemberPowerTag } from '../../hooks/useMemberPowerTag';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useTheme } from '../../hooks/useTheme';
import { useRoomCreatorsTag } from '../../hooks/useRoomCreatorsTag';
import { usePowerLevelTags } from '../../hooks/usePowerLevelTags';
import { useComposingCheck } from '../../hooks/useComposingCheck';

export const ROOM_INPUT_EDITABLE_NAME = 'RoomInput';

interface RoomInputProps {
  editor: Editor;
  fileDropContainerRef: RefObject<HTMLElement>;
  roomId: string;
  room: Room;
  alternateInputRef: RefObject<HTMLDivElement>;
}
export const RoomInput = forwardRef<HTMLDivElement, RoomInputProps>(
  ({ editor, fileDropContainerRef, roomId, room, alternateInputRef }, ref) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const [enterForNewline] = useSetting(settingsAtom, 'enterForNewline');
    const [isMarkdown] = useSetting(settingsAtom, 'isMarkdown');
    const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
    const [legacyUsernameColor] = useSetting(settingsAtom, 'legacyUsernameColor');
    const [alternateInput] = useSetting(settingsAtom, 'alternateInput');
    const direct = useIsDirectRoom();
    const commands = useCommands(mx, room);
    const emojiBtnRef = useRef<HTMLButtonElement>(null);
    const sendBtnRef = useRef<HTMLButtonElement>(null);
    const alternateMentionsRef = useRef<Array<{ userId: string; displayName: string }>>([]);
    const alternateRoomMentionsRef = useRef<Array<{ roomAliasOrId: string; name: string }>>([]);
    const alternateAutocompleteRangeRef = useRef<{ start: number; end: number }>({
      start: 0,
      end: 0,
    });
    const [hasEditorContent, setHasEditorContent] = useState(false);
    const roomToParents = useAtomValue(roomToParentsAtom);
    const powerLevels = usePowerLevelsContext();
    const creators = useRoomCreators(room);

    const [msgDraft, setMsgDraft] = useAtom(roomIdToMsgDraftAtomFamily(roomId));
    const [replyDraft, setReplyDraft] = useAtom(roomIdToReplyDraftAtomFamily(roomId));
    const replyUserID = replyDraft?.userId;

    const powerLevelTags = usePowerLevelTags(room, powerLevels);
    const creatorsTag = useRoomCreatorsTag();
    const getMemberPowerTag = useGetMemberPowerTag(room, creators, powerLevels);
    const theme = useTheme();
    const accessibleTagColors = useAccessiblePowerTagColors(
      theme.kind,
      creatorsTag,
      powerLevelTags,
      true
    );

    const replyPowerTag = replyUserID ? getMemberPowerTag(replyUserID) : undefined;
    const replyPowerColor = replyPowerTag?.color
      ? accessibleTagColors.get(replyPowerTag.color)
      : undefined;
    const replyUsernameColor =
      legacyUsernameColor || direct ? colorMXID(replyUserID ?? '') : replyPowerColor;

    const [isVoiceRecording, setIsVoiceRecording] = useState(false);

    const [uploadBoard, setUploadBoard] = useState(true);
    const [selectedFiles, setSelectedFiles] = useAtom(roomIdToUploadItemsAtomFamily(roomId));
    const uploadFamilyObserverAtom = createUploadFamilyObserverAtom(
      roomUploadAtomFamily,
      selectedFiles.map((f) => f.file)
    );
    const uploadBoardHandlers = useRef<UploadBoardImperativeHandlers>();
    const uploadsReplyDraftRef = useRef<typeof replyDraft>(undefined);

    const imagePackRooms: Room[] = useImagePackRooms(roomId, roomToParents);
    const imagePacks = useRelevantImagePacks(ImageUsage.Emoticon, imagePackRooms);

    const [toolbar, setToolbar] = useSetting(settingsAtom, 'editorToolbar');
    const [autocompleteQuery, setAutocompleteQuery] =
      useState<AutocompleteQuery<AutocompletePrefix>>();

    const sendTypingStatus = useTypingStatusUpdater(mx, roomId);

    const handleFiles = useCallback(
      (files: File[]) => {
        handleUploadFiles(files, {
          currentItemCount: selectedFiles.length,
          setItems: setSelectedFiles,
          isEncrypted: room.hasEncryptionStateEvent(),
          encrypt: encryptFileInWorker,
          onUploadBoardOpen: () => setUploadBoard(true),
          onAccepted: () => sendBtnRef.current?.focus(),
        });
      },
      [setSelectedFiles, room, selectedFiles.length]
    );
    const handleVoiceSend = useCallback(
      (blob: Blob, mimeType: string, _duration: number) => {
        setIsVoiceRecording(false);
        const ext = mimeType.startsWith('audio/ogg')
          ? 'ogg'
          : mimeType.startsWith('audio/mp4')
          ? 'm4a'
          : 'webm';
        const file = new File([blob], `voice-message.${ext}`, { type: mimeType });
        handleFiles([file]);
      },
      [handleFiles]
    );

    const pickFile = useFilePicker(handleFiles, true);
    const handlePaste = useFilePasteHandler(handleFiles);
    const dropZoneVisible = useFileDropZone(fileDropContainerRef, handleFiles, true);
    const [hideStickerBtn, setHideStickerBtn] = useState(document.body.clientWidth < 500);

    const isComposing = useComposingCheck();

    useElementSizeObserver(
      useCallback(() => document.body, []),
      useCallback((width) => setHideStickerBtn(width < 500), [])
    );

    useEffect(() => {
      if (alternateInput) {
        if (msgDraft.length > 0) {
          editor.children = JSON.parse(JSON.stringify(msgDraft));
        }
      } else {
        Transforms.insertFragment(editor, msgDraft);
      }
      setHasEditorContent(!isEmptyEditor(editor));
    }, [editor, msgDraft, alternateInput]);

    useEffect(
      () => () => {
        if (alternateInput) {
          if (!isEmptyEditor(editor)) {
            setMsgDraft(JSON.parse(JSON.stringify(editor.children)));
          } else {
            setMsgDraft([]);
          }
          resetEditorDirect(editor);
          alternateMentionsRef.current = [];
          alternateRoomMentionsRef.current = [];
        } else {
          if (!isEmptyEditor(editor)) {
            const parsedDraft = JSON.parse(JSON.stringify(editor.children));
            setMsgDraft(parsedDraft);
          } else {
            setMsgDraft([]);
          }
          resetEditor(editor);
          resetEditorHistory(editor);
        }
      },
      [roomId, editor, setMsgDraft, alternateInput]
    );

    const handleFileMetadata = useCallback(
      (fileItem: TUploadItem, metadata: TUploadMetadata) => {
        setSelectedFiles({
          type: 'REPLACE',
          item: fileItem,
          replacement: { ...fileItem, metadata },
        });
      },
      [setSelectedFiles]
    );

    const handleRemoveUpload = useCallback(
      (upload: TUploadContent | TUploadContent[]) => {
        const uploads = Array.isArray(upload) ? upload : [upload];
        setSelectedFiles({
          type: 'DELETE',
          item: selectedFiles.filter((f) => uploads.find((u) => u === f.file)),
        });
        uploads.forEach((u) => roomUploadAtomFamily.remove(u));
      },
      [setSelectedFiles, selectedFiles]
    );

    const handleCancelUpload = (uploads: Upload[]) => {
      uploads.forEach((upload) => {
        if (upload.status === UploadStatus.Loading) {
          mx.cancelUpload(upload.promise);
        }
      });
      handleRemoveUpload(uploads.map((upload) => upload.file));
    };

    const handleSendUpload = async (uploads: UploadSuccess[]) => {
      const contentsPromises = uploads.map(async (upload) => {
        const fileItem = selectedFiles.find((f) => f.file === upload.file);
        if (!fileItem) throw new Error('Broken upload');

        if (fileItem.file.type.startsWith('image')) {
          return getImageMsgContent(mx, fileItem, upload.mxc);
        }
        if (fileItem.file.type.startsWith('video')) {
          return getVideoMsgContent(mx, fileItem, upload.mxc);
        }
        if (fileItem.file.type.startsWith('audio')) {
          return getAudioMsgContent(fileItem, upload.mxc);
        }
        return getFileMsgContent(fileItem, upload.mxc);
      });
      handleCancelUpload(uploads);
      const uploadReplyDraft = uploadsReplyDraftRef.current;
      uploadsReplyDraftRef.current = undefined;
      const contents = fulfilledPromiseSettledResult(await Promise.allSettled(contentsPromises));
      contents.forEach((rawContent) => {
        let content = rawContent;
        if (uploadReplyDraft) {
          const relatesTo: Record<string, unknown> = {
            'm.in_reply_to': {
              event_id: uploadReplyDraft.eventId,
            },
          };
          if (uploadReplyDraft.relation?.rel_type === RelationType.Thread) {
            relatesTo.event_id = uploadReplyDraft.relation.event_id;
            relatesTo.rel_type = RelationType.Thread;
            relatesTo.is_falling_back = false;
          }
          content = { ...rawContent, 'm.relates_to': relatesTo };
        }
        mx.sendMessage(roomId, content as RoomMessageEventContent);
      });
    };

    const submit = useCallback(() => {
      const shortcodeMap = buildShortcodeMap(imagePacks, unicodeEmojis);
      const processedChildren = replaceShortcodes(editor.children, shortcodeMap);

      let plainText = toPlainText(processedChildren, isMarkdown).trim();
      let customHtml = trimCustomHtml(
        toMatrixCustomHTML(processedChildren, {
          allowTextFormatting: true,
          allowBlockMarkdown: isMarkdown,
          allowInlineMarkdown: isMarkdown,
        })
      );
      let commandName: string | undefined = getBeginCommand(editor);
      if (!commandName && alternateInput) {
        const match = plainText.match(/^\/(\S+)/);
        if (match) commandName = match[1];
      }
      let msgType = MsgType.Text;

      if (commandName) {
        plainText = trimCommand(commandName, plainText);
        customHtml = trimCommand(commandName, customHtml);
      }
      if (commandName === Command.Me) {
        msgType = MsgType.Emote;
      } else if (commandName === Command.Notice) {
        msgType = MsgType.Notice;
      } else if (commandName === Command.Shrug) {
        plainText = `${SHRUG} ${plainText}`;
        customHtml = `${SHRUG} ${customHtml}`;
      } else if (commandName === Command.TableFlip) {
        plainText = `${TABLEFLIP} ${plainText}`;
        customHtml = `${TABLEFLIP} ${customHtml}`;
      } else if (commandName === Command.UnFlip) {
        plainText = `${UNFLIP} ${plainText}`;
        customHtml = `${UNFLIP} ${customHtml}`;
      } else if (commandName) {
        const commandContent = commands[commandName as Command];
        if (commandContent) {
          commandContent.exe(plainText);
        }
        if (alternateInput) {
          resetEditorDirect(editor);
        } else {
          resetEditor(editor);
          resetEditorHistory(editor);
        }
        sendTypingStatus(false);
        return;
      }

      const hasFiles = selectedFiles.length > 0;

      if (plainText === '' && !hasFiles) return;

      if (plainText !== '') {
        const body = plainText;
        const mentionData = getMentions(mx, roomId, editor);
        if (
          alternateInput &&
          (alternateMentionsRef.current.length > 0 || alternateRoomMentionsRef.current.length > 0)
        ) {
          let html = customHtml;
          alternateMentionsRef.current.forEach(({ userId, displayName }) => {
            mentionData.users.add(userId);
            const escapedName = sanitizeText(`@${displayName}`);
            const mentionLink = `<a href="${encodeURI(
              `https://matrix.to/#/${userId}`
            )}">${escapedName}</a>`;
            html = html.split(escapedName).join(mentionLink);
          });
          alternateRoomMentionsRef.current.forEach(({ roomAliasOrId, name }) => {
            const escapedName = sanitizeText(`#${name}`);
            const mentionLink = `<a href="${encodeURI(
              `https://matrix.to/#/${roomAliasOrId}`
            )}">${escapedName}</a>`;
            html = html.split(escapedName).join(mentionLink);
          });
          customHtml = html;
        }
        const formattedBody = customHtml;

        const content: IContent = {
          msgtype: msgType,
          body,
        };

        if (replyDraft && replyDraft.userId !== mx.getUserId()) {
          mentionData.users.add(replyDraft.userId);
        }

        const mMentions = getMentionContent(Array.from(mentionData.users), mentionData.room);
        content['m.mentions'] = mMentions;

        if (replyDraft || !customHtmlEqualsPlainText(formattedBody, body)) {
          content.format = 'org.matrix.custom.html';
          content.formatted_body = formattedBody;
        }
        if (replyDraft) {
          content['m.relates_to'] = {
            'm.in_reply_to': {
              event_id: replyDraft.eventId,
            },
          };
          if (replyDraft.relation?.rel_type === RelationType.Thread) {
            content['m.relates_to'].event_id = replyDraft.relation.event_id;
            content['m.relates_to'].rel_type = RelationType.Thread;
            content['m.relates_to'].is_falling_back = false;
          }
        }
        mx.sendMessage(roomId, content as RoomMessageEventContent);
      }

      // Send files: if no text was sent, uploads carry the reply context
      uploadsReplyDraftRef.current = plainText === '' ? replyDraft : undefined;
      uploadBoardHandlers.current?.handleSend();

      if (alternateInput) {
        resetEditorDirect(editor);
        alternateMentionsRef.current = [];
        alternateRoomMentionsRef.current = [];
      } else {
        resetEditor(editor);
        resetEditorHistory(editor);
      }
      setHasEditorContent(false);
      setReplyDraft(undefined);
      sendTypingStatus(false);
    }, [
      mx,
      roomId,
      editor,
      replyDraft,
      sendTypingStatus,
      setReplyDraft,
      isMarkdown,
      commands,
      imagePacks,
      selectedFiles,
      alternateInput,
    ]);

    const handleKeyDown: KeyboardEventHandler = useCallback(
      (evt) => {
        if (
          (isKeyHotkey('mod+enter', evt) ||
            (!enterForNewline && !mobileOrTablet() && isKeyHotkey('enter', evt))) &&
          !isComposing(evt)
        ) {
          evt.preventDefault();
          submit();
        }
        if (isKeyHotkey('escape', evt)) {
          evt.preventDefault();
          if (autocompleteQuery) {
            setAutocompleteQuery(undefined);
            return;
          }
          setReplyDraft(undefined);
        }
      },
      [submit, setReplyDraft, enterForNewline, autocompleteQuery, isComposing]
    );

    const handleEditorChange = useCallback(() => {
      setHasEditorContent(!isEmptyEditor(editor));
    }, [editor]);

    const handleKeyUp: KeyboardEventHandler = useCallback(
      (evt) => {
        if (isKeyHotkey('escape', evt)) {
          evt.preventDefault();
          return;
        }

        if (!hideActivity) {
          sendTypingStatus(!isEmptyEditor(editor));
        }

        if (alternateInput) {
          const el = evt.currentTarget as HTMLDivElement;
          const domSel = window.getSelection();
          let query: AutocompleteQuery<AutocompletePrefix> | undefined;

          if (domSel && domSel.rangeCount > 0) {
            const domRange = domSel.getRangeAt(0);
            if (domRange.collapsed && el.contains(domRange.startContainer)) {
              // cloneRange gives the absolute character offset from the start
              // of el regardless of how many text nodes the browser created
              // internally (e.g. after emoji insertion splits the content).
              // Using domRange.startOffset directly is only correct when the
              // cursor is in the very first text node.
              const cloneRange = domRange.cloneRange();
              cloneRange.selectNodeContents(el);
              cloneRange.setEnd(domRange.startContainer, domRange.startOffset);
              const textBefore = cloneRange.toString().replace(/\n$/, '');
              const offset = textBefore.length;

              let start = offset;
              while (start > 0 && textBefore[start - 1] !== ' ') {
                start--;
              }

              const word = textBefore.slice(start, offset);
              const altPrefix = AUTOCOMPLETE_PREFIXES.find((p) => word.startsWith(p));
              if (altPrefix) {
                alternateAutocompleteRangeRef.current = { start, end: offset };
                const dummyRange: BaseRange = {
                  anchor: { path: [0, 0], offset: start },
                  focus: { path: [0, 0], offset },
                };
                query = {
                  range: dummyRange,
                  prefix: altPrefix,
                  text: word.slice(1),
                };
              }
            }
          }

          setAutocompleteQuery(query);
          return;
        }

        const prevWordRange = getPrevWorldRange(editor);
        const query = prevWordRange
          ? getAutocompleteQuery<AutocompletePrefix>(editor, prevWordRange, AUTOCOMPLETE_PREFIXES)
          : undefined;
        setAutocompleteQuery(query);
      },
      [editor, sendTypingStatus, hideActivity, alternateInput]
    );

    const handleCloseAutocomplete = useCallback(() => {
      setAutocompleteQuery(undefined);
      if (!alternateInput) ReactEditor.focus(editor);
    }, [editor, alternateInput]);

    const handleAlternateMentionSelect = useCallback(
      (userId: string, name: string) => {
        const el = alternateInputRef.current;
        if (!el) return;

        const { start, end } = alternateAutocompleteRangeRef.current;
        const currentText = el.innerText.replace(/\n$/, '');
        const displayName = name.startsWith('@') ? name.slice(1) : name;
        const insertText = `@${displayName} `;
        const newText = currentText.slice(0, start) + insertText + currentText.slice(end);

        el.textContent = newText;
        editor.children = [{ type: BlockType.Paragraph, children: [{ text: newText }] }];
        setHasEditorContent(newText.length > 0);

        alternateMentionsRef.current.push({ userId, displayName });

        // Place cursor after inserted text
        const newPos = start + insertText.length;
        const textNode = el.firstChild;
        if (textNode) {
          try {
            const range = document.createRange();
            range.setStart(textNode, Math.min(newPos, newText.length));
            range.collapse(true);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          } catch {
            // ignore if cursor placement fails
          }
        }
      },
      [editor, alternateInputRef]
    );

    const handleAlternateRoomMentionSelect = useCallback(
      (roomAliasOrId: string, name: string) => {
        const el = alternateInputRef.current;
        if (!el) return;

        const { start, end } = alternateAutocompleteRangeRef.current;
        const currentText = el.innerText.replace(/\n$/, '');
        const displayName = name.startsWith('#') ? name.slice(1) : name;
        const insertText = `#${displayName} `;
        const newText = currentText.slice(0, start) + insertText + currentText.slice(end);

        el.textContent = newText;
        editor.children = [{ type: BlockType.Paragraph, children: [{ text: newText }] }];
        setHasEditorContent(newText.length > 0);

        alternateRoomMentionsRef.current.push({ roomAliasOrId, name: displayName });

        const newPos = start + insertText.length;
        const textNode = el.firstChild;
        if (textNode) {
          try {
            const range = document.createRange();
            range.setStart(textNode, Math.min(newPos, newText.length));
            range.collapse(true);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          } catch {
            // ignore if cursor placement fails
          }
        }
      },
      [editor, alternateInputRef]
    );

    const handleAlternateEmoticonSelect = useCallback(
      (key: string, shortcode: string) => {
        const el = alternateInputRef.current;
        if (!el) return;

        const { start, end } = alternateAutocompleteRangeRef.current;
        const currentText = el.innerText.replace(/\n$/, '');
        const insertText = key.startsWith('mxc://') ? `:${shortcode}: ` : `${key} `;
        const newText = currentText.slice(0, start) + insertText + currentText.slice(end);

        el.textContent = newText;
        editor.children = [{ type: BlockType.Paragraph, children: [{ text: newText }] }];
        setHasEditorContent(newText.length > 0);

        const newPos = start + insertText.length;
        const textNode = el.firstChild;
        if (textNode) {
          try {
            const range = document.createRange();
            range.setStart(textNode, Math.min(newPos, newText.length));
            range.collapse(true);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          } catch {
            // ignore if cursor placement fails
          }
        }
      },
      [editor, alternateInputRef]
    );

    const handleAlternateCommandSelect = useCallback(
      (commandName: string) => {
        const el = alternateInputRef.current;
        if (!el) return;

        const { start, end } = alternateAutocompleteRangeRef.current;
        const currentText = el.innerText.replace(/\n$/, '');
        const insertText = `/${commandName} `;
        const newText = currentText.slice(0, start) + insertText + currentText.slice(end);

        el.textContent = newText;
        editor.children = [{ type: BlockType.Paragraph, children: [{ text: newText }] }];
        setHasEditorContent(newText.length > 0);

        const newPos = start + insertText.length;
        const textNode = el.firstChild;
        if (textNode) {
          try {
            const range = document.createRange();
            range.setStart(textNode, Math.min(newPos, newText.length));
            range.collapse(true);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          } catch {
            // ignore if cursor placement fails
          }
        }
      },
      [editor, alternateInputRef]
    );

    const handleEmoticonSelect = (key: string, shortcode: string) => {
      if (alternateInput && editor.insertAlternateText) {
        const emojiText = key.startsWith('mxc://') ? `:${shortcode}:` : key;
        editor.insertAlternateText(emojiText);
        return;
      }
      editor.insertNode(createEmoticonElement(key, shortcode));
      moveCursor(editor);
    };

    const handleStickerSelect = async (mxc: string, shortcode: string, label: string) => {
      const stickerUrl = mxcUrlToHttp(mx, mxc, useAuthentication);
      if (!stickerUrl) return;

      const info = getImageInfo(
        await loadImageElement(stickerUrl),
        await getImageUrlBlob(stickerUrl)
      );

      type StickerContent = {
        body: string;
        url: string;
        info: Awaited<ReturnType<typeof getImageInfo>>;
        'm.relates_to'?: Record<string, unknown>;
      };

      const content: StickerContent = {
        body: label,
        url: mxc,
        info,
      };

      if (replyDraft) {
        content['m.relates_to'] = {
          'm.in_reply_to': {
            event_id: replyDraft.eventId,
          },
        };
        if (replyDraft.relation?.rel_type === RelationType.Thread) {
          content['m.relates_to'].event_id = replyDraft.relation.event_id;
          content['m.relates_to'].rel_type = RelationType.Thread;
          content['m.relates_to'].is_falling_back = false;
        }
        setReplyDraft(undefined);
      }

      mx.sendEvent(roomId, EventType.Sticker, content);
    };

    return (
      <div ref={ref}>
        {selectedFiles.length > 0 && (
          <UploadBoard
            header={
              <UploadBoardHeader
                open={uploadBoard}
                onToggle={() => setUploadBoard(!uploadBoard)}
                uploadFamilyObserverAtom={uploadFamilyObserverAtom}
                onSend={handleSendUpload}
                onSubmit={submit}
                imperativeHandlerRef={uploadBoardHandlers}
                onCancel={handleCancelUpload}
              />
            }
          >
            {uploadBoard && (
              <Scroll size="300" hideTrack visibility="Hover">
                <UploadBoardContent>
                  {Array.from(selectedFiles)
                    .reverse()
                    .map((fileItem, index) => (
                      <UploadCardRenderer
                        // eslint-disable-next-line react/no-array-index-key
                        key={index}
                        isEncrypted={!!fileItem.encInfo}
                        fileItem={fileItem}
                        setMetadata={handleFileMetadata}
                        onRemove={handleRemoveUpload}
                      />
                    ))}
                </UploadBoardContent>
              </Scroll>
            )}
          </UploadBoard>
        )}
        <Overlay
          open={dropZoneVisible}
          backdrop={<OverlayBackdrop />}
          style={{ pointerEvents: 'none' }}
        >
          <OverlayCenter>
            <Dialog variant="Primary">
              <Box
                direction="Column"
                justifyContent="Center"
                alignItems="Center"
                gap="500"
                style={{ padding: toRem(60) }}
              >
                <Icon size="600" src={Icons.File} />
                <Text size="H4" align="Center">
                  {`Drop Files in "${room?.name || 'Room'}"`}
                </Text>
                <Text align="Center">Drag and drop files here or click for selection dialog</Text>
              </Box>
            </Dialog>
          </OverlayCenter>
        </Overlay>
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
            imagePackRooms={imagePackRooms}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
            onSelect={alternateInput ? handleAlternateEmoticonSelect : undefined}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.Command && (
          <CommandAutocomplete
            room={room}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
            onSelect={alternateInput ? handleAlternateCommandSelect : undefined}
          />
        )}
        {isVoiceRecording ? (
          <VoiceMessageRecorder
            onSend={handleVoiceSend}
            onCancel={() => setIsVoiceRecording(false)}
          />
        ) : (
          <CustomEditor
            editableName={ROOM_INPUT_EDITABLE_NAME}
            editor={editor}
            alternateInputRef={alternateInputRef}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onChange={handleEditorChange}
            onPaste={handlePaste}
            onFiles={handleFiles}
            top={
              replyDraft && (
                <div>
                  <Box
                    alignItems="Center"
                    gap="300"
                    style={{ padding: `${config.space.S200} ${config.space.S300} 0` }}
                  >
                    <IconButton
                      onClick={() => setReplyDraft(undefined)}
                      variant="SurfaceVariant"
                      size="300"
                      radii="300"
                    >
                      <Icon src={Icons.Cross} size="50" />
                    </IconButton>
                    <Box direction="Row" gap="200" alignItems="Center">
                      {replyDraft.relation?.rel_type === RelationType.Thread && <ThreadIndicator />}
                      <ReplyLayout
                        userColor={replyUsernameColor}
                        username={
                          <Text size="T300" truncate>
                            <b>
                              {getMemberDisplayName(room, replyDraft.userId) ??
                                getMxIdLocalPart(replyDraft.userId) ??
                                replyDraft.userId}
                            </b>
                          </Text>
                        }
                      >
                        <Text size="T300" truncate>
                          {trimReplyFromBody(replyDraft.body)}
                        </Text>
                      </ReplyLayout>
                    </Box>
                  </Box>
                </div>
              )
            }
            before={
              <IconButton
                onClick={() => pickFile('*')}
                variant="SurfaceVariant"
                size="300"
                radii="300"
              >
                <Icon src={Icons.PlusCircle} />
              </IconButton>
            }
            after={
              <>
                {!alternateInput && (
                  <IconButton
                    variant="SurfaceVariant"
                    size="300"
                    radii="300"
                    onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
                    onTouchStart={(e: React.TouchEvent) => e.preventDefault()}
                    onClick={() => setToolbar(!toolbar)}
                  >
                    <Icon src={toolbar ? Icons.AlphabetUnderline : Icons.Alphabet} />
                  </IconButton>
                )}
                <UseStateProvider initial={undefined}>
                  {(emojiBoardTab: EmojiBoardTab | undefined, setEmojiBoardTab) => (
                    <PopOut
                      offset={16}
                      alignOffset={-44}
                      position="Top"
                      align="End"
                      anchor={
                        emojiBoardTab === undefined
                          ? undefined
                          : emojiBtnRef.current?.getBoundingClientRect() ?? undefined
                      }
                      content={
                        <EmojiBoard
                          tab={emojiBoardTab}
                          onTabChange={setEmojiBoardTab}
                          imagePackRooms={imagePackRooms}
                          returnFocusOnDeactivate={false}
                          onEmojiSelect={handleEmoticonSelect}
                          onCustomEmojiSelect={handleEmoticonSelect}
                          onStickerSelect={handleStickerSelect}
                          requestClose={() => {
                            setEmojiBoardTab((t) => {
                              if (t) {
                                if (!mobileOrTablet() && !alternateInput) ReactEditor.focus(editor);
                                return undefined;
                              }
                              return t;
                            });
                          }}
                        />
                      }
                    >
                      <IconButton
                        ref={emojiBtnRef}
                        aria-pressed={
                          hideStickerBtn ? !!emojiBoardTab : emojiBoardTab === EmojiBoardTab.Emoji
                        }
                        onClick={() => setEmojiBoardTab(EmojiBoardTab.Emoji)}
                        variant="SurfaceVariant"
                        size="300"
                        radii="300"
                      >
                        <Icon
                          src={Icons.Smile}
                          filled={
                            hideStickerBtn ? !!emojiBoardTab : emojiBoardTab === EmojiBoardTab.Emoji
                          }
                        />
                      </IconButton>
                    </PopOut>
                  )}
                </UseStateProvider>
                {hasEditorContent || !!replyDraft || selectedFiles.length > 0 ? (
                  <IconButton
                    ref={sendBtnRef}
                    onClick={submit}
                    variant="SurfaceVariant"
                    size="300"
                    radii="300"
                  >
                    <Icon src={Icons.Send} />
                  </IconButton>
                ) : (
                  <IconButton
                    onClick={() => setIsVoiceRecording(true)}
                    variant="SurfaceVariant"
                    size="300"
                    radii="300"
                  >
                    <Icon src={Icons.Mic} />
                  </IconButton>
                )}
              </>
            }
            bottom={
              !alternateInput &&
              toolbar && (
                <div>
                  <Line variant="SurfaceVariant" size="300" />
                  <Toolbar />
                </div>
              )
            }
          />
        )}
      </div>
    );
  }
);
