import { Box, Icon, Icons, Text, as, color, toRem } from 'folds';
import type { EventTimelineSet, Room } from 'matrix-js-sdk';
import type { MouseEventHandler, ReactNode } from 'react';
import React, { useCallback, useMemo } from 'react';
import type { HTMLReactParserOptions } from 'html-react-parser';
import parse from 'html-react-parser';
import classNames from 'classnames';
import {
  getMemberDisplayName,
  trimReplyFromBody,
  trimReplyFromFormattedBody,
} from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';
import { LinePlaceholder } from './placeholder';
import { randomNumberBetween } from '../../utils/common';
import * as css from './Reply.css';
import { MessageDeletedContent, MessageFailedContent } from './content';
import { scaleSystemEmoji } from '../../plugins/react-custom-html-parser';
import { sanitizeCustomHtml } from '../../utils/sanitize';
import { useRoomEvent } from '../../hooks/useRoomEvent';
import colorMXID from '../../../util/colorMXID';
import type { GetMemberPowerTag } from '../../hooks/useMemberPowerTag';

type ReplyLayoutProps = {
  userColor?: string;
  username?: ReactNode;
};
export const ReplyLayout = as<'div', ReplyLayoutProps>(
  ({ username, userColor, className, children, ...props }, ref) => (
    <Box
      className={classNames(css.Reply, className)}
      alignItems="Center"
      gap="100"
      {...props}
      ref={ref}
    >
      <Box style={{ color: userColor, maxWidth: toRem(200) }} alignItems="Center" shrink="No">
        <Icon size="100" src={Icons.ReplyArrow} />
        {username}
      </Box>
      <Box grow="Yes" className={css.ReplyContent}>
        {children}
      </Box>
    </Box>
  )
);

export const ThreadIndicator = as<'div'>(({ ...props }, ref) => (
  <Box
    shrink="No"
    className={css.ThreadIndicator}
    alignItems="Center"
    gap="100"
    {...props}
    ref={ref}
  >
    <Icon size="50" src={Icons.Thread} />
    <Text size="L400">Thread</Text>
  </Box>
));

type ReplyProps = {
  room: Room;
  timelineSet?: EventTimelineSet | undefined;
  replyEventId: string;
  threadRootId?: string | undefined;
  onClick?: MouseEventHandler | undefined;
  getMemberPowerTag?: GetMemberPowerTag;
  accessibleTagColors?: Map<string, string>;
  legacyUsernameColor?: boolean;
  htmlReactParserOptions?: HTMLReactParserOptions;
};

export const Reply = as<'div', ReplyProps>(
  (
    {
      room,
      timelineSet,
      replyEventId,
      threadRootId,
      onClick,
      getMemberPowerTag,
      accessibleTagColors,
      legacyUsernameColor,
      htmlReactParserOptions,
      ...props
    },
    ref
  ) => {
    const placeholderWidth = useMemo(() => randomNumberBetween(40, 400), []);
    const getFromLocalTimeline = useCallback(
      () => timelineSet?.findEventById(replyEventId),
      [timelineSet, replyEventId]
    );
    const replyEvent = useRoomEvent(room, replyEventId, getFromLocalTimeline);

    const { body, formatted_body: customBody } = replyEvent?.getContent() ?? {};
    const sender = replyEvent?.getSender();
    const powerTag = sender ? getMemberPowerTag?.(sender) : undefined;
    const tagColor = powerTag?.color ? accessibleTagColors?.get(powerTag.color) : undefined;

    const usernameColor = sender ? (legacyUsernameColor ? colorMXID(sender) : tagColor) : undefined;

    const isRedacted = replyEvent?.isRedacted() ?? false;
    const showContent = replyEvent !== undefined;
    const isFormattedBody =
      typeof body === 'string' &&
      typeof customBody === 'string' &&
      htmlReactParserOptions !== undefined;

    let bodyJSX: ReactNode;
    let bodyTestId: string;
    if (body) {
      bodyJSX = isFormattedBody
        ? parse(sanitizeCustomHtml(trimReplyFromFormattedBody(customBody)), htmlReactParserOptions)
        : scaleSystemEmoji(trimReplyFromBody(body));
      bodyTestId = 'reply-body';
    } else if (isRedacted) {
      bodyJSX = <MessageDeletedContent />;
      bodyTestId = 'reply-deleted';
    } else {
      bodyJSX = <MessageFailedContent />;
      bodyTestId = 'reply-failed';
    }

    return (
      <Box
        direction="Row"
        gap="200"
        alignItems="Center"
        style={{ width: '100vw', maxWidth: '100%' }}
        {...props}
        ref={ref}
      >
        {threadRootId && (
          <ThreadIndicator as="button" data-event-id={threadRootId} onClick={onClick} />
        )}
        <ReplyLayout
          as="button"
          userColor={usernameColor}
          username={
            sender && (
              <Text size="T300" truncate>
                <b>{getMemberDisplayName(room, sender) ?? getMxIdLocalPart(sender)}</b>
              </Text>
            )
          }
          data-event-id={replyEventId}
          onClick={onClick}
        >
          {showContent ? (
            <Text
              size="T300"
              truncate
              className={isFormattedBody ? css.FormattedReplyBody : undefined}
              data-testid={bodyTestId}
            >
              {bodyJSX}
            </Text>
          ) : (
            <LinePlaceholder
              data-testid="reply-loading"
              style={{
                backgroundColor: color.SurfaceVariant.ContainerActive,
                width: toRem(placeholderWidth),
                maxWidth: '100%',
              }}
            />
          )}
        </ReplyLayout>
      </Box>
    );
  }
);
