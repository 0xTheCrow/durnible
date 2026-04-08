import React, { MouseEventHandler } from 'react';
import { Room, MatrixClient } from 'matrix-js-sdk';
import { HTMLReactParserOptions } from 'html-react-parser';
import { Opts as LinkifyOpts } from 'linkifyjs';
import { MessageLayout, MessageSpacing } from '../../state/settings';
import { GetMemberPowerTag } from '../../hooks/useMemberPowerTag';

export type TimelineMessageContextValue = {
  room: Room;
  mx: MatrixClient;
  messageLayout: MessageLayout;
  messageSpacing: MessageSpacing;
  mediaAutoLoad: boolean;
  showUrlPreview: boolean;
  canRedact: boolean;
  canSendReaction: boolean;
  canPinEvent: boolean;
  imagePackRooms: Room[];
  getMemberPowerTag: GetMemberPowerTag;
  accessiblePowerTagColors: Map<string, string>;
  legacyUsernameColor: boolean;
  direct: boolean;
  hideReadReceipts: boolean;
  showDeveloperTools: boolean;
  hour24Clock: boolean;
  dateFormatString: string;
  htmlReactParserOptions: HTMLReactParserOptions;
  linkifyOpts: LinkifyOpts;
  replyHighlight: boolean;
  showHiddenEvents: boolean;
  hideMembershipEvents: boolean;
  hideNickAvatarEvents: boolean;
  handleUserClick: MouseEventHandler<HTMLButtonElement>;
  handleUsernameClick: MouseEventHandler<HTMLButtonElement>;
  handleReplyClick: (
    ev: Parameters<MouseEventHandler<HTMLButtonElement>>[0],
    startThread?: boolean
  ) => void;
  handleReactionToggle: (targetEventId: string, key: string, shortcode?: string) => void;
  editId: string | undefined;
  handleEdit: (editEvtId?: string) => void;
  handleOpenReply: MouseEventHandler<HTMLButtonElement>;
  handleDecryptRetry: () => Promise<void>;
};

export const TimelineMessageContext =
  React.createContext<TimelineMessageContextValue | null>(null);

export const useTimelineMessageContext = (): TimelineMessageContextValue => {
  const ctx = React.useContext(TimelineMessageContext);
  if (!ctx)
    throw new Error(
      'useTimelineMessageContext must be used within TimelineMessageContext.Provider'
    );
  return ctx;
};
