import type { RectCords } from 'folds';
import {
  Avatar,
  Box,
  Checkbox,
  Icon,
  IconButton,
  Icons,
  Line,
  Menu,
  MenuItem,
  PopOut,
  Text,
  as,
  color,
} from 'folds';
import type { MouseEventHandler, ReactNode } from 'react';
import React, { useCallback, useRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { useAtom, useAtomValue } from 'jotai';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { MsgType, EventStatus } from 'matrix-js-sdk';
import type { Relations } from 'matrix-js-sdk/lib/models/relations';
import classNames from 'classnames';
import { selectionModeAtom, selectedIdsAtom } from './selectionAtom';
import { useMessagePopupTrigger } from './useMessagePopupTrigger';
import { hiddenImagesAtom, MessageEventIdContext } from '../../../state/hiddenImages';
import {
  AvatarBase,
  BubbleLayout,
  CompactLayout,
  MessageBase,
  ModernLayout,
  Time,
  Username,
  UsernameBold,
} from '../../../components/message';
import { canEditEvent, getMemberAvatarMxc, getMemberDisplayName } from '../../../utils/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../../utils/matrix';
import type { MessageSpacing } from '../../../state/settings';
import { MessageLayout } from '../../../state/settings';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import * as css from './styles.css';
import type { EmojiBoardPopOutHandle } from '../../../components/emoji-board';
import { EmojiBoardPopOut } from '../../../components/emoji-board';
import { MessageEditor } from './MessageEditor';
import { useOpenReactionViewer } from '../../../state/hooks/reactionViewer';
import { UserAvatar } from '../../../components/user-avatar';
import { stopPropagation } from '../../../utils/keyboard';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import type { MemberPowerTag } from '../../../../types/matrix/room';
import { PowerIcon } from '../../../components/power';
import colorMXID from '../../../../util/colorMXID';
import { getPowerTagIconSrc } from '../../../hooks/useMemberPowerTag';
import {
  MessageAllReactionButton,
  MessageAllReactionItem,
  MessageQuickReactions,
} from './reactions';
import {
  MessageCopyLinkItem,
  MessageDeleteItem,
  MessagePinItem,
  MessageReadReceiptItem,
  MessageReportItem,
  MessageSourceCodeItem,
} from './menu';

export type { ReactionHandler } from './reactions';
export {
  MessageQuickReactions,
  MessageAllReactionButton,
  MessageAllReactionItem,
} from './reactions';
export {
  MessageReadReceiptItem,
  MessageSourceCodeItem,
  MessageCopyLinkItem,
  MessagePinItem,
  MessageDeleteItem,
  MessageReportItem,
} from './menu';
export { TimelineSystemEvent } from './TimelineSystemEvent';
export type { TimelineSystemEventProps } from './TimelineSystemEvent';

export type MessageProps = {
  room: Room;
  mEvent: MatrixEvent;
  collapse: boolean;
  highlight: boolean;
  mentionHighlight?: boolean;
  edit?: boolean;
  canDelete?: boolean;
  canSendReaction?: boolean;
  canPinEvent?: boolean;
  imagePackRooms?: Room[];
  relations?: Relations;
  messageLayout: MessageLayout;
  messageSpacing: MessageSpacing;
  onUserClick: MouseEventHandler<HTMLButtonElement>;
  onUsernameClick: MouseEventHandler<HTMLButtonElement>;
  onReplyClick: (
    ev: Parameters<MouseEventHandler<HTMLButtonElement>>[0],
    startThread?: boolean
  ) => void;
  onEditId?: (eventId?: string) => void;
  onReactionToggle: (targetEventId: string, key: string, shortcode?: string) => void;
  reply?: ReactNode;
  reactions?: ReactNode;
  hideReadReceipts?: boolean;
  showDeveloperTools?: boolean;
  memberPowerTag?: MemberPowerTag;
  accessibleTagColors?: Map<string, string>;
  legacyUsernameColor?: boolean;
  hour24Clock: boolean;
  dateFormatString: string;
};
export const Message = as<'div', MessageProps>(
  (
    {
      className,
      room,
      mEvent,
      collapse,
      highlight,
      mentionHighlight,
      edit,
      canDelete,
      canSendReaction,
      canPinEvent,
      imagePackRooms,
      relations,
      messageLayout,
      messageSpacing,
      onUserClick,
      onUsernameClick,
      onReplyClick,
      onReactionToggle,
      onEditId,
      reply,
      reactions,
      hideReadReceipts,
      showDeveloperTools,
      memberPowerTag,
      accessibleTagColors,
      legacyUsernameColor,
      hour24Clock,
      dateFormatString,
      children,
      ...props
    },
    ref
  ) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const senderId = mEvent.getSender() ?? '';

    const eventId = mEvent.getId() ?? '';
    const selectionMode = useAtomValue(selectionModeAtom);
    const [selectedIds, setSelectedIds] = useAtom(selectedIdsAtom);
    const isSelected = selectionMode && selectedIds.has(eventId);
    const toggleSelection = useCallback(() => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(eventId)) {
          next.delete(eventId);
        } else {
          next.add(eventId);
        }
        return next;
      });
    }, [eventId, setSelectedIds]);
    const { hoverProps, focusWithinProps, handleTap, showOptions } = useMessagePopupTrigger(
      eventId,
      { disabled: selectionMode || !!edit }
    );
    const [menuAnchor, setMenuAnchor] = useState<RectCords>();
    const [emojiBoardOpen, setEmojiBoardOpen] = useState(false);
    const emojiBoardRef = useRef<EmojiBoardPopOutHandle>(null);
    const skipMenuReturnFocusRef = useRef(false);
    const openReactionViewer = useOpenReactionViewer();
    const [hiddenImages, setHiddenImages] = useAtom(hiddenImagesAtom);

    const msgType = mEvent.getContent().msgtype;
    const isImageMessage = msgType === MsgType.Image || msgType === MsgType.Video;
    const isImageHidden = isImageMessage && hiddenImages.has(eventId);

    const toggleImageHidden = useCallback(() => {
      setHiddenImages((prev: Set<string>) => {
        const next = new Set(prev);
        if (next.has(eventId)) {
          next.delete(eventId);
        } else {
          next.add(eventId);
        }
        return next;
      });
    }, [eventId, setHiddenImages]);

    const senderDisplayName =
      getMemberDisplayName(room, senderId) ?? getMxIdLocalPart(senderId) ?? senderId;
    const senderAvatarMxc = getMemberAvatarMxc(room, senderId);

    const tagColor = memberPowerTag?.color
      ? accessibleTagColors?.get(memberPowerTag.color)
      : undefined;
    const tagIconSrc = memberPowerTag?.icon
      ? getPowerTagIconSrc(mx, useAuthentication, memberPowerTag.icon)
      : undefined;

    const usernameColor = legacyUsernameColor ? colorMXID(senderId) : tagColor;

    const eventStatus = mEvent.status;
    const isPending = eventStatus !== null && eventStatus !== EventStatus.NOT_SENT;
    const isFailed = eventStatus === EventStatus.NOT_SENT;

    const headerJSX = !collapse && (
      <Box
        gap="300"
        direction={messageLayout === MessageLayout.Compact ? 'RowReverse' : 'Row'}
        justifyContent="SpaceBetween"
        alignItems="Baseline"
        grow="Yes"
      >
        <Box alignItems="Center" gap="200">
          <Username
            as="button"
            style={{ color: usernameColor }}
            data-user-id={senderId}
            data-testid="message-sender-name"
            onContextMenu={onUserClick}
            onClick={onUsernameClick}
          >
            <Text
              as="span"
              size={messageLayout === MessageLayout.Bubble ? 'T300' : 'T400'}
              truncate
            >
              <UsernameBold>{senderDisplayName}</UsernameBold>
            </Text>
          </Username>
          {tagIconSrc && <PowerIcon size="100" iconSrc={tagIconSrc} />}
        </Box>
        <Box shrink="No" gap="100" alignItems="Center">
          {isFailed && (
            <>
              <Icon size="100" src={Icons.Warning} style={{ color: color.Critical.Main }} />
              <Text as="span" size="T200" style={{ color: color.Critical.Main }}>
                Failed to send
              </Text>
              <Text
                as="button"
                size="T200"
                style={{
                  color: color.Success.Main,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  font: 'inherit',
                }}
                onClick={() => mx.resendEvent(mEvent, room)}
              >
                Retry
              </Text>
              <IconButton
                size="300"
                variant="Critical"
                radii="300"
                onClick={() => mx.cancelPendingEvent(mEvent)}
                aria-label="Delete"
              >
                <Icon size="100" src={Icons.Delete} />
              </IconButton>
            </>
          )}
          {!isFailed && (
            <Time
              ts={mEvent.getTs()}
              compact={messageLayout === MessageLayout.Compact}
              hour24Clock={hour24Clock}
              dateFormatString={dateFormatString}
            />
          )}
        </Box>
      </Box>
    );

    const avatarJSX = !collapse && messageLayout !== MessageLayout.Compact && (
      <AvatarBase
        className={messageLayout === MessageLayout.Bubble ? css.BubbleAvatarBase : undefined}
      >
        <Avatar
          className={css.MessageAvatar}
          as="button"
          size="300"
          data-user-id={senderId}
          onClick={onUserClick}
        >
          <UserAvatar
            userId={senderId}
            src={
              senderAvatarMxc
                ? mxcUrlToHttp(mx, senderAvatarMxc, useAuthentication, 48, 48, 'crop') ?? undefined
                : undefined
            }
            alt={senderDisplayName}
            renderFallback={() => <Icon size="200" src={Icons.User} filled />}
          />
        </Avatar>
      </AvatarBase>
    );

    const msgContentJSX = (
      <Box
        direction="Column"
        alignSelf="Start"
        style={{
          maxWidth: '100%',
          opacity: isPending ? 0.6 : isFailed ? 0.4 : 1,
          transition: 'opacity 0.4s linear',
        }}
      >
        {reply}
        {edit && onEditId ? (
          <MessageEditor
            style={{
              maxWidth: '100%',
              width: '100vw',
            }}
            roomId={room.roomId}
            room={room}
            mEvent={mEvent}
            imagePackRooms={imagePackRooms}
            onCancel={() => onEditId()}
          />
        ) : (
          <MessageEventIdContext.Provider value={eventId}>
            {children}
          </MessageEventIdContext.Provider>
        )}
        {reactions}
      </Box>
    );

    const handleContextMenu: MouseEventHandler<HTMLDivElement> = (evt) => {
      if (selectionMode || evt.altKey || !window.getSelection()?.isCollapsed || edit) return;
      const target = evt.target as Element | null;
      if (target?.tagName.toLowerCase() === 'a') return;
      evt.preventDefault();
      setMenuAnchor({
        x: evt.clientX,
        y: evt.clientY,
        width: 0,
        height: 0,
      });
    };

    const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
      const target = evt.currentTarget.parentElement?.parentElement ?? evt.currentTarget;
      setMenuAnchor(target.getBoundingClientRect());
    };

    const closeMenu = () => {
      setMenuAnchor(undefined);
    };

    const handleAddReactions: MouseEventHandler<HTMLButtonElement> = () => {
      const rect = menuAnchor;
      if (!rect) return;
      skipMenuReturnFocusRef.current = true;
      closeMenu();
      if (rect.width === 0) {
        emojiBoardRef.current?.openAtRect(rect, { align: 'Start', offset: 0 });
      } else {
        emojiBoardRef.current?.openAtRect(rect);
      }
    };

    return (
      <MessageBase
        className={classNames(css.MessageBase, className, {
          [css.MessageBaseBubbleCollapsed]: messageLayout === MessageLayout.Bubble && collapse,
          [css.MessageBaseSelecting]: selectionMode,
        })}
        tabIndex={0}
        space={messageSpacing}
        collapse={collapse}
        highlight={highlight}
        mentionHighlight={mentionHighlight}
        selected={!!menuAnchor || emojiBoardOpen || isSelected}
        onClick={selectionMode && canDelete ? toggleSelection : handleTap}
        onContextMenu={handleContextMenu}
        style={selectionMode ? { cursor: 'pointer' } : undefined}
        {...props}
        {...hoverProps}
        {...focusWithinProps}
        ref={ref}
      >
        {selectionMode && canDelete && (
          <Box className={css.SelectionCheckbox} alignItems="Center" justifyContent="Center">
            <Checkbox variant="Primary" size="300" checked={!!isSelected} />
          </Box>
        )}
        {!selectionMode && !edit && (showOptions || !!menuAnchor || emojiBoardOpen) && (
          <div className={css.MessageOptionsBase}>
            <Menu className={css.MessageOptionsBar} variant="SurfaceVariant">
              <Box gap="100">
                {canSendReaction && (
                  <EmojiBoardPopOut
                    ref={emojiBoardRef}
                    position="Bottom"
                    align="End"
                    imagePackRooms={imagePackRooms ?? []}
                    returnFocusOnDeactivate={false}
                    allowTextCustomEmoji
                    onEmojiSelect={(key) => {
                      onReactionToggle(eventId, key);
                    }}
                    onCustomEmojiSelect={(mxc, shortcode) => {
                      onReactionToggle(eventId, mxc, shortcode);
                    }}
                    onOpenChange={setEmojiBoardOpen}
                  >
                    {({ triggerRef, open, isOpen }) => (
                      <IconButton
                        ref={triggerRef}
                        onClick={open}
                        variant="SurfaceVariant"
                        size="300"
                        radii="300"
                        aria-pressed={isOpen}
                      >
                        <Icon src={Icons.SmilePlus} size="100" />
                      </IconButton>
                    )}
                  </EmojiBoardPopOut>
                )}
                {relations && (
                  <MessageAllReactionButton onOpen={() => openReactionViewer(room, relations)} />
                )}
                <IconButton
                  onClick={onReplyClick}
                  data-event-id={mEvent.getId()}
                  variant="SurfaceVariant"
                  size="300"
                  radii="300"
                >
                  <Icon src={Icons.ReplyArrow} size="100" />
                </IconButton>
                {canEditEvent(mx, mEvent) && onEditId && (
                  <IconButton
                    onClick={() => onEditId(mEvent.getId())}
                    variant="SurfaceVariant"
                    size="300"
                    radii="300"
                  >
                    <Icon src={Icons.Pencil} size="100" />
                  </IconButton>
                )}
                <PopOut
                  anchor={menuAnchor}
                  position="Bottom"
                  align={menuAnchor?.width === 0 ? 'Start' : 'End'}
                  offset={menuAnchor?.width === 0 ? 0 : undefined}
                  content={
                    <FocusTrap
                      focusTrapOptions={{
                        initialFocus: false,
                        onDeactivate: () => setMenuAnchor(undefined),
                        clickOutsideDeactivates: true,
                        isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                        isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                        escapeDeactivates: stopPropagation,
                        setReturnFocus: (previousFocusedElement) => {
                          if (skipMenuReturnFocusRef.current) {
                            skipMenuReturnFocusRef.current = false;
                            return false;
                          }
                          return previousFocusedElement;
                        },
                      }}
                    >
                      <Menu>
                        {canSendReaction && (
                          <MessageQuickReactions
                            onReaction={(key, shortcode) => {
                              onReactionToggle(eventId, key, shortcode);
                              closeMenu();
                            }}
                          />
                        )}
                        <Box direction="Column" gap="100" className={css.MessageMenuGroup}>
                          {canSendReaction && (
                            <MenuItem
                              size="300"
                              after={<Icon size="100" src={Icons.SmilePlus} />}
                              radii="300"
                              onClick={handleAddReactions}
                            >
                              <Text
                                className={css.MessageMenuItemText}
                                as="span"
                                size="T300"
                                truncate
                              >
                                Add Reaction
                              </Text>
                            </MenuItem>
                          )}
                          {relations && (
                            <MessageAllReactionItem
                              onOpen={() => {
                                openReactionViewer(room, relations);
                                closeMenu();
                              }}
                            />
                          )}
                          <MenuItem
                            size="300"
                            after={<Icon size="100" src={Icons.ReplyArrow} />}
                            radii="300"
                            data-event-id={mEvent.getId()}
                            onClick={(evt) => {
                              onReplyClick(evt);
                              closeMenu();
                            }}
                          >
                            <Text
                              className={css.MessageMenuItemText}
                              as="span"
                              size="T300"
                              truncate
                            >
                              Reply
                            </Text>
                          </MenuItem>
                          {canEditEvent(mx, mEvent) && onEditId && (
                            <MenuItem
                              size="300"
                              after={<Icon size="100" src={Icons.Pencil} />}
                              radii="300"
                              data-event-id={mEvent.getId()}
                              onClick={() => {
                                skipMenuReturnFocusRef.current = true;
                                onEditId(mEvent.getId());
                                closeMenu();
                              }}
                            >
                              <Text
                                className={css.MessageMenuItemText}
                                as="span"
                                size="T300"
                                truncate
                              >
                                Edit Message
                              </Text>
                            </MenuItem>
                          )}
                          {!hideReadReceipts && (
                            <MessageReadReceiptItem
                              room={room}
                              eventId={mEvent.getId() ?? ''}
                              onClose={closeMenu}
                            />
                          )}
                          {showDeveloperTools && (
                            <MessageSourceCodeItem
                              room={room}
                              mEvent={mEvent}
                              onClose={closeMenu}
                            />
                          )}
                          <MessageCopyLinkItem room={room} mEvent={mEvent} onClose={closeMenu} />
                          {canPinEvent && (
                            <MessagePinItem room={room} mEvent={mEvent} onClose={closeMenu} />
                          )}
                          {isImageMessage && (
                            <MenuItem
                              size="300"
                              after={
                                <Icon size="100" src={isImageHidden ? Icons.Eye : Icons.EyeBlind} />
                              }
                              radii="300"
                              onClick={() => {
                                toggleImageHidden();
                                closeMenu();
                              }}
                            >
                              <Text
                                className={css.MessageMenuItemText}
                                as="span"
                                size="T300"
                                truncate
                              >
                                {isImageHidden ? 'Show Image' : 'Hide Image'}
                              </Text>
                            </MenuItem>
                          )}
                        </Box>
                        {((!mEvent.isRedacted() && canDelete) ||
                          mEvent.getSender() !== mx.getUserId()) && (
                          <>
                            <Line size="300" />
                            <Box direction="Column" gap="100" className={css.MessageMenuGroup}>
                              {!mEvent.isRedacted() && canDelete && (
                                <MessageDeleteItem
                                  room={room}
                                  mEvent={mEvent}
                                  onClose={closeMenu}
                                />
                              )}
                              {mEvent.getSender() !== mx.getUserId() && (
                                <MessageReportItem
                                  room={room}
                                  mEvent={mEvent}
                                  onClose={closeMenu}
                                />
                              )}
                            </Box>
                          </>
                        )}
                      </Menu>
                    </FocusTrap>
                  }
                >
                  <IconButton
                    onClick={handleOpenMenu}
                    variant="SurfaceVariant"
                    size="300"
                    radii="300"
                    aria-pressed={!!menuAnchor}
                  >
                    <Icon src={Icons.VerticalDots} size="100" />
                  </IconButton>
                </PopOut>
              </Box>
            </Menu>
          </div>
        )}
        {messageLayout === MessageLayout.Compact && (
          <CompactLayout before={headerJSX}>{msgContentJSX}</CompactLayout>
        )}
        {messageLayout === MessageLayout.Bubble && (
          <BubbleLayout before={avatarJSX} header={headerJSX}>
            {msgContentJSX}
          </BubbleLayout>
        )}
        {messageLayout !== MessageLayout.Compact && messageLayout !== MessageLayout.Bubble && (
          <ModernLayout before={avatarJSX}>
            {headerJSX}
            {msgContentJSX}
          </ModernLayout>
        )}
      </MessageBase>
    );
  }
);
