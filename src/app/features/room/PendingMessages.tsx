import React, { useEffect, useRef } from 'react';
import { Avatar, Box, Icon, IconButton, Icons, Spinner, Text, color } from 'folds';
import { Room } from 'matrix-js-sdk';
import { useAtom } from 'jotai';
import {
  PendingMessage,
  PendingStatus,
  roomIdToPendingMessagesAtomFamily,
} from '../../state/room/pendingMessages';
import { MessageLayout, MessageSpacing } from '../../state/settings';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getMemberAvatarMxc, getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { UserAvatar } from '../../components/user-avatar';
import {
  AvatarBase,
  BubbleLayout,
  CompactLayout,
  MessageBase,
  MessageTextBody,
  ModernLayout,
  Username,
  UsernameBold,
} from '../../components/message';

const SEND_TIMEOUT_MS = 30_000;

type PendingMessageItemProps = {
  msg: PendingMessage;
  displayName: string;
  avatarSrc?: string;
  myUserId: string;
  messageLayout: MessageLayout;
  messageSpacing: MessageSpacing;
  onRetry: () => void;
  onDelete: () => void;
};

function PendingMessageItem({
  msg,
  displayName,
  avatarSrc,
  myUserId,
  messageLayout,
  messageSpacing,
  onRetry,
  onDelete,
}: PendingMessageItemProps) {
  const isPending = msg.status === 'pending';
  const isFailed = msg.status === 'failed';

  const statusJSX = isPending ? (
    <Box alignItems="Center" gap="100">
      <Spinner size="200" />
      <Text as="span" size="T200" priority="300">
        Sending...
      </Text>
    </Box>
  ) : (
    <Box alignItems="Center" gap="200">
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
        onClick={onRetry}
      >
        Retry
      </Text>
      <IconButton size="300" variant="Critical" radii="300" onClick={onDelete} aria-label="Delete">
        <Icon size="100" src={Icons.Delete} />
      </IconButton>
    </Box>
  );

  const headerJSX = (
    <Box gap="200" alignItems="Center" wrap="Wrap">
      <Username>
        <Text as="span" size="T400" truncate>
          <UsernameBold>{displayName}</UsernameBold>
        </Text>
      </Username>
      {statusJSX}
    </Box>
  );

  const avatarJSX = messageLayout !== MessageLayout.Compact ? (
    <AvatarBase>
      <Avatar size="300">
        <UserAvatar
          userId={myUserId}
          src={avatarSrc}
          alt={displayName}
          renderFallback={() => <Icon size="200" src={Icons.User} filled />}
        />
      </Avatar>
    </AvatarBase>
  ) : null;

  const bodyText = msg.content.body as string | undefined;
  const contentOpacity = isFailed ? 0.4 : 0.6;

  const contentJSX = bodyText ? (
    <Box direction="Column" style={{ opacity: contentOpacity }}>
      <MessageTextBody preWrap>{bodyText}</MessageTextBody>
    </Box>
  ) : null;

  return (
    <MessageBase space={messageSpacing}>
      {messageLayout === MessageLayout.Compact && (
        <CompactLayout before={headerJSX}>{contentJSX}</CompactLayout>
      )}
      {messageLayout === MessageLayout.Bubble && (
        <BubbleLayout before={avatarJSX} header={headerJSX}>
          {contentJSX}
        </BubbleLayout>
      )}
      {messageLayout !== MessageLayout.Compact && messageLayout !== MessageLayout.Bubble && (
        <ModernLayout before={avatarJSX}>
          {headerJSX}
          {contentJSX}
        </ModernLayout>
      )}
    </MessageBase>
  );
}

type PendingMessagesProps = {
  room: Room;
  messageLayout: MessageLayout;
  messageSpacing: MessageSpacing;
};

export function PendingMessages({ room, messageLayout, messageSpacing }: PendingMessagesProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const roomId = room.roomId;
  const [messages, setMessages] = useAtom(roomIdToPendingMessagesAtomFamily(roomId));
  const inFlightRef = useRef<Set<string>>(new Set());

  const myUserId = mx.getSafeUserId();
  const displayName =
    getMemberDisplayName(room, myUserId) ?? getMxIdLocalPart(myUserId) ?? myUserId;
  const avatarMxc = getMemberAvatarMxc(room, myUserId);
  const avatarSrc = avatarMxc
    ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 48, 48, 'crop') ?? undefined
    : undefined;

  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.status !== 'pending') return;
      if (inFlightRef.current.has(msg.id)) return;

      inFlightRef.current.add(msg.id);

      const timer = setTimeout(() => {
        if (!inFlightRef.current.has(msg.id)) return;
        inFlightRef.current.delete(msg.id);
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, status: 'failed' as PendingStatus } : m))
        );
      }, SEND_TIMEOUT_MS);

      (mx.sendMessage(roomId, msg.content as any) as Promise<unknown>)
        .then(() => {
          clearTimeout(timer);
          inFlightRef.current.delete(msg.id);
          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        })
        .catch(() => {
          clearTimeout(timer);
          inFlightRef.current.delete(msg.id);
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? { ...m, status: 'failed' as PendingStatus } : m))
          );
        });
    });
  }, [messages, mx, roomId, setMessages]);

  if (messages.length === 0) return null;

  return (
    <>
      {messages.map((msg) => (
        <PendingMessageItem
          key={msg.id}
          msg={msg}
          displayName={displayName}
          avatarSrc={avatarSrc}
          myUserId={myUserId}
          messageLayout={messageLayout}
          messageSpacing={messageSpacing}
          onRetry={() =>
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msg.id ? { ...m, status: 'pending' as PendingStatus } : m
              )
            )
          }
          onDelete={() => setMessages((prev) => prev.filter((m) => m.id !== msg.id))}
        />
      ))}
    </>
  );
}
