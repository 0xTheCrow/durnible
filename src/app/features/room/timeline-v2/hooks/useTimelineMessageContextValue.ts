import type { MouseEventHandler, RefObject } from 'react';
import { useCallback, useMemo } from 'react';
import type { Room } from 'matrix-js-sdk';
import type { HTMLReactParserOptions } from 'html-react-parser';
import type { Opts as LinkifyOpts } from 'linkifyjs';
import { useAtomValue } from 'jotai';
import type { EditorController } from '../../../../components/editor';
import { useMatrixClient } from '../../../../hooks/useMatrixClient';
import { useSetting } from '../../../../state/hooks/settings';
import { settingsAtom } from '../../../../state/settings';
import { useIsDirectRoom } from '../../../../hooks/useRoom';
import { useMediaAuthentication } from '../../../../hooks/useMediaAuthentication';
import { usePowerLevelsContext } from '../../../../hooks/usePowerLevels';
import { useRoomCreators } from '../../../../hooks/useRoomCreators';
import { useRoomCreatorsTag } from '../../../../hooks/useRoomCreatorsTag';
import { usePowerLevelTags } from '../../../../hooks/usePowerLevelTags';
import { useRoomPermissions } from '../../../../hooks/useRoomPermissions';
import {
  useAccessiblePowerTagColors,
  useGetMemberPowerTag,
} from '../../../../hooks/useMemberPowerTag';
import { useTheme } from '../../../../hooks/useTheme';
import { useImagePackRooms } from '../../../../hooks/useImagePackRooms';
import { useMentionClickHandler } from '../../../../hooks/useMentionClickHandler';
import { useSpoilerClickHandler } from '../../../../hooks/useSpoilerClickHandler';
import { useOpenUserRoomProfile } from '../../../../state/hooks/userRoomProfile';
import { useSpaceOptionally } from '../../../../hooks/useSpace';
import { roomToParentsAtom } from '../../../../state/room/roomToParents';
import { roomIdToReplyDraftAtomFamily } from '../../../../state/room/roomInputDrafts';
import { MessageEvent, StateEvent } from '../../../../../types/matrix/room';
import {
  factoryRenderLinkifyWithMention,
  getReactCustomHtmlParser,
  LINKIFY_OPTS,
  makeMentionCustomProps,
  renderMatrixMention,
} from '../../../../plugins/react-custom-html-parser';
import { decryptAllTimelineEvent } from '../../../../utils/room';
import { getLinkedTimelines, getLiveTimeline } from '../../timeline/timelineUtils';
import { useTimelineClickHandlers } from '../../timeline/useTimelineClickHandlers';
import type { TimelineMessageContextValue } from '../../timeline/TimelineMessageContext';

type Params = {
  room: Room;
  editorInputRef: RefObject<EditorController | null>;
  editId: string | undefined;
  handleEdit: (editEvtId?: string) => void;
  handleOpenReply: MouseEventHandler<HTMLButtonElement>;
};

export const useTimelineMessageContextValue = ({
  room,
  editorInputRef,
  editId,
  handleEdit,
  handleOpenReply,
}: Params): TimelineMessageContextValue => {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const [messageLayout] = useSetting(settingsAtom, 'messageLayout');
  const [messageSpacing] = useSetting(settingsAtom, 'messageSpacing');
  const [legacyUsernameColor] = useSetting(settingsAtom, 'legacyUsernameColor');
  const [hideMembershipEvents] = useSetting(settingsAtom, 'hideMembershipEvents');
  const [hideNickAvatarEvents] = useSetting(settingsAtom, 'hideNickAvatarEvents');
  const [mediaAutoLoad] = useSetting(settingsAtom, 'mediaAutoLoad');
  const [urlPreview] = useSetting(settingsAtom, 'urlPreview');
  const [encUrlPreview] = useSetting(settingsAtom, 'encUrlPreview');
  const showUrlPreview = room.hasEncryptionStateEvent() ? encUrlPreview : urlPreview;
  const [showHiddenEvents] = useSetting(settingsAtom, 'showHiddenEvents');
  const [showDeveloperTools] = useSetting(settingsAtom, 'developerTools');
  const [replyHighlight] = useSetting(settingsAtom, 'replyHighlight');
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [dateFormatString] = useSetting(settingsAtom, 'dateFormatString');
  const [pauseGifs] = useSetting(settingsAtom, 'pauseGifs');

  const direct = useIsDirectRoom();

  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);
  const creatorsTag = useRoomCreatorsTag();
  const powerLevelTags = usePowerLevelTags(room, powerLevels);
  const getMemberPowerTag = useGetMemberPowerTag(room, creators, powerLevels);

  const theme = useTheme();
  const accessiblePowerTagColors = useAccessiblePowerTagColors(
    theme.kind,
    creatorsTag,
    powerLevelTags,
    true
  );

  const permissions = useRoomPermissions(creators, powerLevels);
  const canRedact = permissions.action('redact', mx.getSafeUserId());
  const canSendReaction = permissions.event(MessageEvent.Reaction, mx.getSafeUserId());
  const canPinEvent = permissions.stateEvent(StateEvent.RoomPinnedEvents, mx.getSafeUserId());

  const roomToParents = useAtomValue(roomToParentsAtom);
  const imagePackRooms = useImagePackRooms(room.roomId, roomToParents);

  const mentionClickHandler = useMentionClickHandler(room.roomId);
  const spoilerClickHandler = useSpoilerClickHandler();
  const openUserRoomProfile = useOpenUserRoomProfile();
  const space = useSpaceOptionally();

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
        useAuthentication,
        handleSpoilerClick: spoilerClickHandler,
        handleMentionClick: mentionClickHandler,
        pauseGifs,
      }),
    [mx, room, linkifyOpts, spoilerClickHandler, mentionClickHandler, useAuthentication, pauseGifs]
  );

  const { handleUserClick, handleUsernameClick, handleReplyClick, handleReactionToggle } =
    useTimelineClickHandlers({
      mx,
      room,
      spaceRoomId: space?.roomId,
      openUserRoomProfile,
      editorInputRef,
      replyDraftAtom: roomIdToReplyDraftAtomFamily(room.roomId),
    });

  const handleDecryptRetry = useCallback(async () => {
    const linkedTimelines = getLinkedTimelines(getLiveTimeline(room));
    await Promise.allSettled(
      linkedTimelines.map((eventTimeline) => decryptAllTimelineEvent(mx, eventTimeline))
    );
  }, [mx, room]);

  return useMemo(
    () => ({
      room,
      mx,
      messageLayout,
      messageSpacing,
      mediaAutoLoad,
      showUrlPreview,
      canRedact,
      canSendReaction,
      canPinEvent,
      imagePackRooms,
      getMemberPowerTag,
      accessiblePowerTagColors,
      legacyUsernameColor,
      direct,
      hideReadReceipts: hideActivity,
      showDeveloperTools,
      hour24Clock,
      dateFormatString,
      htmlReactParserOptions,
      linkifyOpts,
      replyHighlight,
      showHiddenEvents,
      hideMembershipEvents,
      hideNickAvatarEvents,
      handleUserClick,
      handleUsernameClick,
      handleReplyClick,
      handleReactionToggle,
      editId,
      handleEdit,
      handleOpenReply,
      handleDecryptRetry,
    }),
    [
      room,
      mx,
      messageLayout,
      messageSpacing,
      mediaAutoLoad,
      showUrlPreview,
      canRedact,
      canSendReaction,
      canPinEvent,
      imagePackRooms,
      getMemberPowerTag,
      accessiblePowerTagColors,
      legacyUsernameColor,
      direct,
      hideActivity,
      showDeveloperTools,
      hour24Clock,
      dateFormatString,
      htmlReactParserOptions,
      linkifyOpts,
      replyHighlight,
      showHiddenEvents,
      hideMembershipEvents,
      hideNickAvatarEvents,
      handleUserClick,
      handleUsernameClick,
      handleReplyClick,
      handleReactionToggle,
      editId,
      handleEdit,
      handleOpenReply,
      handleDecryptRetry,
    ]
  );
};
