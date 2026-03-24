/* eslint-disable react/destructuring-assignment */
import React, { MouseEventHandler, useMemo } from 'react';
import { IEventWithRoomId, JoinRule, RelationType, Room } from 'matrix-js-sdk';
import { HTMLReactParserOptions } from 'html-react-parser';
import { Avatar, Box, Chip, Header, Icon, Icons, Text, config, toRem } from 'folds';
import { Opts as LinkifyOpts } from 'linkifyjs';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import {
  factoryRenderLinkifyWithMention,
  getReactCustomHtmlParser,
  LINKIFY_OPTS,
  makeHighlightRegex,
  makeMentionCustomProps,
  renderMatrixMention,
} from '../../plugins/react-custom-html-parser';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useMatrixEventRenderer } from '../../hooks/useMatrixEventRenderer';
import { GetContentCallback, MessageEvent, StateEvent } from '../../../types/matrix/room';
import {
  AvatarBase,
  ImageContent,
  MSticker,
  ModernLayout,
  RedactedContent,
  Reply,
  Username,
  UsernameBold,
} from '../../components/message';
import { timeDayMonYear, timeHourMinute } from '../../utils/time';
import { RenderMessageContent } from '../../components/RenderMessageContent';
import { Image } from '../../components/media';
import * as customHtmlCss from '../../styles/CustomHtml.css';
import { RoomAvatar, RoomIcon } from '../../components/room-avatar';
import { getMemberAvatarMxc, getMemberDisplayName, getRoomAvatarUrl } from '../../utils/room';
import { ResultItem } from './useMessageSearch';
import { SequenceCard } from '../../components/sequence-card';
import { UserAvatar } from '../../components/user-avatar';
import { useMentionClickHandler } from '../../hooks/useMentionClickHandler';
import { useSpoilerClickHandler } from '../../hooks/useSpoilerClickHandler';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { usePowerLevels } from '../../hooks/usePowerLevels';
import { usePowerLevelTags } from '../../hooks/usePowerLevelTags';
import { useTheme } from '../../hooks/useTheme';
import { PowerIcon } from '../../components/power';
import colorMXID from '../../../util/colorMXID';
import {
  getPowerTagIconSrc,
  useAccessiblePowerTagColors,
  useGetMemberPowerTag,
} from '../../hooks/useMemberPowerTag';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useRoomCreatorsTag } from '../../hooks/useRoomCreatorsTag';

type SearchResultGroupProps = {
  room: Room;
  highlights: string[];
  items: ResultItem[];
  mediaAutoLoad?: boolean;
  onOpen: (roomId: string, eventId: string) => void;
  legacyUsernameColor?: boolean;
  hour24Clock: boolean;
  dateFormatString: string;
};
export function SearchResultGroup({
  room,
  highlights,
  items,
  mediaAutoLoad,
  onOpen,
  legacyUsernameColor,
  hour24Clock,
  dateFormatString,
}: SearchResultGroupProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [pauseGifs] = useSetting(settingsAtom, 'pauseGifs');
  const highlightRegex = useMemo(() => makeHighlightRegex(highlights), [highlights]);

  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);

  const creatorsTag = useRoomCreatorsTag();
  const powerLevelTags = usePowerLevelTags(room, powerLevels);
  const getMemberPowerTag = useGetMemberPowerTag(room, creators, powerLevels);

  const theme = useTheme();
  const accessibleTagColors = useAccessiblePowerTagColors(theme.kind, creatorsTag, powerLevelTags, true);

  const mentionClickHandler = useMentionClickHandler(room.roomId);
  const spoilerClickHandler = useSpoilerClickHandler();

  const linkifyOpts = useMemo<LinkifyOpts>(
    () => ({
      ...LINKIFY_OPTS,
      render: factoryRenderLinkifyWithMention((href) =>
        renderMatrixMention(mx, room.roomId, href, makeMentionCustomProps(mentionClickHandler))
      ),
    }),
    [mx, room, mentionClickHandler]
  );
  const htmlReactParserOptions = useMemo<HTMLReactParserOptions>(
    () =>
      getReactCustomHtmlParser(mx, room.roomId, {
        linkifyOpts,
        highlightRegex,
        useAuthentication,
        handleSpoilerClick: spoilerClickHandler,
        handleMentionClick: mentionClickHandler,
        pauseGifs,
      }),
    [
      mx,
      room,
      linkifyOpts,
      highlightRegex,
      mentionClickHandler,
      spoilerClickHandler,
      useAuthentication,
      pauseGifs,
    ]
  );

  const renderMatrixEvent = useMatrixEventRenderer<[IEventWithRoomId, string, GetContentCallback]>(
    {
      [MessageEvent.RoomMessage]: (event, displayName, getContent) => {
        if (event.unsigned?.redacted_because) {
          return <RedactedContent reason={event.unsigned?.redacted_because.content.reason} />;
        }

        return (
          <RenderMessageContent
            displayName={displayName}
            msgType={event.content.msgtype ?? ''}
            ts={event.origin_server_ts}
            content={getContent()}
            mediaAutoLoad={mediaAutoLoad}
            urlPreview={false}
            htmlReactParserOptions={htmlReactParserOptions}
            linkifyOpts={linkifyOpts}
            highlightRegex={highlightRegex}
            outlineAttachment
          />
        );
      },
      [MessageEvent.Reaction]: (event, displayName, getContent) => {
        if (event.unsigned?.redacted_because) {
          return <RedactedContent reason={event.unsigned?.redacted_because.content.reason} />;
        }
        return (
          <MSticker
            content={getContent()}
            renderImageContent={(props) => (
              <ImageContent
                {...props}
                autoPlay={mediaAutoLoad}
                renderImage={(p) => <Image {...p} loading="lazy" />}
              />
            )}
          />
        );
      },
      [StateEvent.RoomTombstone]: (event) => {
        const { content } = event;
        return (
          <Box grow="Yes" direction="Column">
            <Text size="T400" priority="300">
              Room Tombstone. {content.body}
            </Text>
          </Box>
        );
      },
    },
    undefined,
    (event) => {
      if (event.unsigned?.redacted_because) {
        return <RedactedContent reason={event.unsigned?.redacted_because.content.reason} />;
      }
      return (
        <Box grow="Yes" direction="Column">
          <Text size="T400" priority="300">
            <code className={customHtmlCss.Code}>{event.type}</code>
            {' event'}
          </Text>
        </Box>
      );
    }
  );

  const handleOpenClick: MouseEventHandler = (evt) => {
    const eventId = evt.currentTarget.getAttribute('data-event-id');
    if (!eventId) return;
    onOpen(room.roomId, eventId);
  };

  return (
    <Box direction="Column" gap="200">
      <Header size="300">
        <Box gap="200" grow="Yes">
          <Avatar size="200" radii="300">
            <RoomAvatar
              roomId={room.roomId}
              src={getRoomAvatarUrl(mx, room, 96, useAuthentication)}
              alt={room.name}
              renderFallback={() => (
                <RoomIcon size="50" joinRule={room.getJoinRule() ?? JoinRule.Restricted} filled />
              )}
            />
          </Avatar>
          <Text size="H4" truncate>
            {room.name}
          </Text>
        </Box>
      </Header>
      <Box direction="Column" gap="100">
        {items.map((item) => {
          const { event } = item;

          const displayName =
            getMemberDisplayName(room, event.sender) ??
            getMxIdLocalPart(event.sender) ??
            event.sender;
          const senderAvatarMxc = getMemberAvatarMxc(room, event.sender);

          const relation = event.content['m.relates_to'];
          const mainEventId =
            relation?.rel_type === RelationType.Replace ? relation.event_id : event.event_id;

          const getContent = (() =>
            event.content['m.new_content'] ?? event.content) as GetContentCallback;

          const replyEventId = relation?.['m.in_reply_to']?.event_id;
          const threadRootId =
            relation?.rel_type === RelationType.Thread ? relation.event_id : undefined;

          const memberPowerTag = getMemberPowerTag(event.sender);
          const tagColor = memberPowerTag?.color
            ? accessibleTagColors?.get(memberPowerTag.color)
            : undefined;
          const tagIconSrc = memberPowerTag?.icon
            ? getPowerTagIconSrc(mx, useAuthentication, memberPowerTag.icon)
            : undefined;

          const usernameColor = legacyUsernameColor ? colorMXID(event.sender) : tagColor;

          return (
            <SequenceCard
              key={event.event_id}
              style={{ padding: 0 }}
              variant="SurfaceVariant"
              direction="Row"
            >
              <Box grow="Yes" style={{ padding: config.space.S400, minWidth: 0 }} direction="Column">
                <ModernLayout
                  before={
                    <AvatarBase>
                      <Avatar size="300">
                        <UserAvatar
                          userId={event.sender}
                          src={
                            senderAvatarMxc
                              ? mxcUrlToHttp(
                                  mx,
                                  senderAvatarMxc,
                                  useAuthentication,
                                  48,
                                  48,
                                  'crop'
                                ) ?? undefined
                              : undefined
                          }
                          alt={displayName}
                          renderFallback={() => <Icon size="200" src={Icons.User} filled />}
                        />
                      </Avatar>
                    </AvatarBase>
                  }
                >
                  <Box gap="200" alignItems="Baseline" grow="Yes">
                    <Box alignItems="Center" gap="200">
                      <Username style={{ color: usernameColor }}>
                        <Text as="span" truncate>
                          <UsernameBold>{displayName}</UsernameBold>
                        </Text>
                      </Username>
                      {tagIconSrc && <PowerIcon size="100" iconSrc={tagIconSrc} />}
                    </Box>
                    <Text as="time" style={{ flexShrink: 0 }} size="T200" priority="300">
                      {`${timeDayMonYear(event.origin_server_ts, dateFormatString)} ${timeHourMinute(event.origin_server_ts, hour24Clock)}`}
                    </Text>
                  </Box>
                  {replyEventId && (
                    <Reply
                      room={room}
                      replyEventId={replyEventId}
                      threadRootId={threadRootId}
                      onClick={handleOpenClick}
                      getMemberPowerTag={getMemberPowerTag}
                      accessibleTagColors={accessibleTagColors}
                      legacyUsernameColor={legacyUsernameColor}
                    />
                  )}
                  {renderMatrixEvent(event.type, false, event, displayName, getContent)}
                  {item.attachedImages && item.attachedImages.length > 0 && (
                    <Box gap="200" wrap="Wrap" style={{ marginTop: config.space.S200 }}>
                      {item.attachedImages.map((img) => {
                        const imgUrl = (img.content.file as Record<string, unknown>)?.url as string
                          ?? img.content.url as string;
                        if (!imgUrl) return null;
                        const info = img.content.info as Record<string, unknown> | undefined;
                        return (
                          <ImageContent
                            key={img.event_id}
                            body={img.content.body as string ?? 'Image'}
                            mimeType={info?.mimetype as string | undefined}
                            url={imgUrl}
                            info={info as any}
                            encInfo={img.content.file as any}
                            autoPlay={mediaAutoLoad}
                            style={{
                              maxWidth: toRem(200),
                              maxHeight: toRem(200),
                              borderRadius: config.radii.R300,
                            }}
                            renderImage={(p) => <Image {...p} loading="lazy" />}
                          />
                        );
                      })}
                    </Box>
                  )}
                </ModernLayout>
              </Box>
              <Box shrink="No" alignItems="Stretch" style={{ alignSelf: 'stretch' }}>
                <Chip
                  data-event-id={mainEventId}
                  onClick={handleOpenClick}
                  variant="Secondary"
                  radii="0"
                  fill="None"
                  style={{
                    height: '100%',
                    padding: `0 ${config.space.S400}`,
                  }}
                >
                  <Text size="T200">Open</Text>
                </Chip>
              </Box>
            </SequenceCard>
          );
        })}
      </Box>
    </Box>
  );
}
