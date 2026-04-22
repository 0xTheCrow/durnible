import type { KeyboardEventHandler, RefObject } from 'react';
import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { isKeyHotkey } from 'is-hotkey';
import type { IContent, Room } from 'matrix-js-sdk';
import { EventType, MsgType, RelationType } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/types';
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
  Scroll,
  Text,
  config,
  toRem,
} from 'folds';

import { useMatrixClient } from '../../../hooks/useMatrixClient';
import type { AutocompleteQuery, EditorController } from '../../../components/editor';
import {
  CustomEditor,
  EditorToolbar,
  AutocompletePrefix,
  RoomMentionAutocomplete,
  UserMentionAutocomplete,
  EmoticonAutocomplete,
  createEmoticonNode,
  useEditorAutocomplete,
  customHtmlEqualsPlainText,
  trimCustomHtml,
  trimCommand,
  domToMatrixCustomHTML,
  domToPlainText,
  getMentionsFromDom,
  replaceShortcodesInDom,
  getCommandFromDom,
  isEditorEmpty,
  isInsideList,
  handleListEnter,
} from '../../../components/editor';
import { EmojiBoardWrapper, EmojiBoardTab } from '../../../components/emoji-board';
import type { UploadContent } from '../../../utils/matrix';
import { getImageInfo, getMxIdLocalPart, mxcUrlToHttp } from '../../../utils/matrix';
import { encryptFileInWorker } from '../../../utils/encryptWorker';
import { useTypingStatusUpdater } from '../../../hooks/useTypingStatusUpdater';
import { useFilePicker } from '../../../hooks/useFilePicker';
import { useFileDropZone } from '../../../hooks/useFileDrop';
import type { UploadItem, UploadMetadata } from '../../../state/room/roomInputDrafts';
import {
  roomIdToEditorDraftAtomFamily,
  roomIdToReplyDraftAtomFamily,
  roomIdToUploadItemsAtomFamily,
  roomUploadAtomFamily,
} from '../../../state/room/roomInputDrafts';
import { UploadCardRenderer } from '../../../components/upload-card';
import type { UploadBoardImperativeHandlers } from '../../../components/upload-board';
import {
  UploadBoard,
  UploadBoardContent,
  UploadBoardHeader,
} from '../../../components/upload-board';
import type { Upload, UploadSuccess } from '../../../state/upload';
import { UploadStatus, createUploadFamilyObserverAtom } from '../../../state/upload';
import { getImageUrlBlob, loadImageElement } from '../../../utils/dom';
import { handleUploadFiles } from './handleUploadFiles';
import { fulfilledPromiseSettledResult } from '../../../utils/common';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import {
  getAudioMsgContent,
  getFileMsgContent,
  getImageMsgContent,
  getVideoMsgContent,
} from './msgContent';
import { getMemberDisplayName, getMentionContent, trimReplyFromBody } from '../../../utils/room';
import { CommandAutocomplete } from './CommandAutocomplete';
import { VoiceMessageRecorder } from './VoiceMessageRecorder';
import { Command, SHRUG, TABLEFLIP, UNFLIP, useCommands } from '../../../hooks/useCommands';
import { mobileOrTablet } from '../../../utils/user-agent';
import { useElementSizeObserver } from '../../../hooks/useElementSizeObserver';
import { ReplyLayout, ThreadIndicator } from '../../../components/message';
import { roomToParentsAtom } from '../../../state/room/roomToParents';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { useImagePackRooms } from '../../../hooks/useImagePackRooms';
import { useRelevantImagePacks } from '../../../hooks/useImagePacks';
import { ImageUsage } from '../../../plugins/custom-emoji/types';
import { buildShortcodeMap, emojis as unicodeEmojis } from '../../../plugins/emoji';
import { usePowerLevelsContext } from '../../../hooks/usePowerLevels';
import colorMXID from '../../../../util/colorMXID';
import { useIsDirectRoom } from '../../../hooks/useRoom';
import {
  useAccessiblePowerTagColors,
  useGetMemberPowerTag,
} from '../../../hooks/useMemberPowerTag';
import { useRoomCreators } from '../../../hooks/useRoomCreators';
import { useTheme } from '../../../hooks/useTheme';
import { useRoomCreatorsTag } from '../../../hooks/useRoomCreatorsTag';
import { usePowerLevelTags } from '../../../hooks/usePowerLevelTags';
import { useComposingCheck } from '../../../hooks/useComposingCheck';

export const ROOM_INPUT_EDITABLE_NAME = 'RoomInput';

interface RoomInputProps {
  fileDropContainerRef: RefObject<HTMLElement>;
  roomId: string;
  room: Room;
  editorInputRef: RefObject<EditorController | null>;
}
export const RoomInput = forwardRef<HTMLDivElement, RoomInputProps>(
  ({ fileDropContainerRef, roomId, room, editorInputRef }, ref) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const [enterForNewline] = useSetting(settingsAtom, 'enterForNewline');
    const [isMarkdown] = useSetting(settingsAtom, 'isMarkdown');
    const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
    const [legacyUsernameColor] = useSetting(settingsAtom, 'legacyUsernameColor');
    const direct = useIsDirectRoom();
    const commands = useCommands(mx, room);
    const [hasEditorContent, setHasEditorContent] = useState(false);
    const roomToParents = useAtomValue(roomToParentsAtom);
    const powerLevels = usePowerLevelsContext();
    const creators = useRoomCreators(room);

    const [editorDraft, setEditorDraft] = useAtom(roomIdToEditorDraftAtomFamily(roomId));
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
          onAccepted: () => {
            if (!mobileOrTablet()) editorInputRef.current?.focus();
          },
        });
      },
      [setSelectedFiles, room, selectedFiles.length, editorInputRef]
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
    const dropZoneVisible = useFileDropZone(fileDropContainerRef, handleFiles, true);
    const [hideStickerBtn, setHideStickerBtn] = useState(document.body.clientWidth < 500);

    const isComposing = useComposingCheck();

    useElementSizeObserver(
      useCallback(() => document.body, []),
      useCallback((width) => setHideStickerBtn(width < 500), [])
    );

    useEffect(() => {
      const el = editorInputRef.current?.el;
      if (el && editorDraft) {
        el.innerHTML = editorDraft;
        setHasEditorContent(!isEditorEmpty(el));
      }
    }, [editorDraft, editorInputRef]);

    useEffect(
      () => () => {
        const el = editorInputRef.current?.el;
        if (el && !isEditorEmpty(el)) {
          setEditorDraft(el.innerHTML);
        } else {
          setEditorDraft('');
        }
      },
      [roomId, editorInputRef, setEditorDraft]
    );

    const handleFileMetadata = useCallback(
      (fileItem: UploadItem, metadata: UploadMetadata) => {
        setSelectedFiles({
          type: 'REPLACE',
          item: fileItem,
          replacement: { ...fileItem, metadata },
        });
      },
      [setSelectedFiles]
    );

    const handleRemoveUpload = useCallback(
      (upload: UploadContent | UploadContent[]) => {
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
      const el = editorInputRef.current?.el;
      if (!el) return;

      const shortcodeMap = buildShortcodeMap(imagePacks, unicodeEmojis);
      replaceShortcodesInDom(el, shortcodeMap, mx, useAuthentication);

      let plainText = domToPlainText(el).trim();
      let customHtml = trimCustomHtml(
        domToMatrixCustomHTML(el, {
          allowTextFormatting: true,
          allowBlockMarkdown: isMarkdown,
          allowInlineMarkdown: isMarkdown,
        })
      );
      const commandName = getCommandFromDom(el);
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
        el.textContent = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        setHasEditorContent(false);
        sendTypingStatus(false);
        return;
      }

      const hasFiles = selectedFiles.length > 0;

      if (plainText === '' && !hasFiles) return;

      if (plainText !== '') {
        const body = plainText;
        const mentionData = getMentionsFromDom(el, mx);
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

      uploadsReplyDraftRef.current = plainText === '' ? replyDraft : undefined;
      uploadBoardHandlers.current?.handleSend();

      el.textContent = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      setHasEditorContent(false);
      setReplyDraft(undefined);
      sendTypingStatus(false);
    }, [
      mx,
      roomId,
      replyDraft,
      sendTypingStatus,
      setReplyDraft,
      isMarkdown,
      commands,
      imagePacks,
      selectedFiles,
      editorInputRef,
      useAuthentication,
    ]);

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
      [submit, setReplyDraft, enterForNewline, autocompleteQuery, isComposing, editorInputRef]
    );

    const handleEditorChange = useCallback(() => {
      const el = editorInputRef.current?.el;
      setHasEditorContent(el ? !isEditorEmpty(el) : false);
    }, [editorInputRef]);

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
      handleCommandSelect,
    } = editorAutocomplete;

    const handleKeyUp: KeyboardEventHandler = useCallback(
      (evt) => {
        if (isKeyHotkey('escape', evt)) {
          evt.preventDefault();
          return;
        }

        const el = evt.currentTarget as HTMLDivElement;
        if (!hideActivity) {
          sendTypingStatus(!isEditorEmpty(el));
        }
        setAutocompleteQuery(editorAutocomplete.detectAutocompleteQuery(el));
      },
      [sendTypingStatus, hideActivity, editorAutocomplete]
    );

    const handleCloseAutocomplete = useCallback(() => {
      setAutocompleteQuery(undefined);
    }, []);

    const handleEmoticonSelect = (key: string, shortcode: string) => {
      if (key.startsWith('mxc://')) {
        const node = createEmoticonNode({ mx, useAuthentication, key, shortcode });
        editorInputRef.current?.insertNode(node);
        return;
      }
      editorInputRef.current?.insertText(key);
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
            imagePackRooms={imagePackRooms}
            query={autocompleteQuery}
            onClose={handleCloseAutocomplete}
            onSelect={handleAutocompleteEmoticonSelect}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.Command && (
          <CommandAutocomplete
            room={room}
            query={autocompleteQuery}
            onClose={handleCloseAutocomplete}
            onSelect={handleCommandSelect}
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
            editorInputRef={editorInputRef}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onChange={handleEditorChange}
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
                <EmojiBoardWrapper
                  offset={16}
                  alignOffset={mobileOrTablet() ? 0 : -44}
                  position="Top"
                  align="End"
                  imagePackRooms={imagePackRooms}
                  returnFocusOnDeactivate={!mobileOrTablet()}
                  onEmojiSelect={handleEmoticonSelect}
                  onCustomEmojiSelect={handleEmoticonSelect}
                  onStickerSelect={handleStickerSelect}
                  onClose={() => editorInputRef.current?.focus()}
                >
                  {({ triggerRef, open, isOpen, tab: emojiBoardTab }) => (
                    <IconButton
                      ref={triggerRef}
                      aria-pressed={hideStickerBtn ? isOpen : emojiBoardTab === EmojiBoardTab.Emoji}
                      onMouseDown={(e: React.MouseEvent) => {
                        e.preventDefault();
                        editorInputRef.current?.focus();
                      }}
                      onClick={open}
                      variant="SurfaceVariant"
                      size="300"
                      radii="300"
                    >
                      <Icon
                        src={Icons.Smile}
                        filled={hideStickerBtn ? isOpen : emojiBoardTab === EmojiBoardTab.Emoji}
                      />
                    </IconButton>
                  )}
                </EmojiBoardWrapper>
                {hasEditorContent || !!replyDraft || selectedFiles.length > 0 ? (
                  <IconButton onClick={submit} variant="SurfaceVariant" size="300" radii="300">
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
              toolbar && (
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
              )
            }
          />
        )}
      </div>
    );
  }
);
