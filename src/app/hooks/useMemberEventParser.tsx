import React, { ReactNode } from 'react';
import { IconSrc, Icons } from 'folds';
import { MatrixEvent } from 'matrix-js-sdk';
import { IMemberContent, Membership } from '../../types/matrix/room';
import { getMxIdLocalPart } from '../utils/matrix';
import { isMembershipChanged } from '../utils/room';

import { useTranslation } from '../internationalization';

export type ParsedResult = {
  icon: IconSrc;
  body: ReactNode;
};

export type MemberEventParser = (mEvent: MatrixEvent) => ParsedResult;

export const useMemberEventParser = (): MemberEventParser => {
  const [t] = useTranslation();
  const parseMemberEvent: MemberEventParser = (mEvent) => {
    const content = mEvent.getContent<IMemberContent>();
    const prevContent = mEvent.getPrevContent() as IMemberContent;
    const senderId = mEvent.getSender();
    const userId = mEvent.getStateKey();
    const reason = typeof content.reason === 'string' ? content.reason : undefined;

    if (!senderId || !userId)
      return {
        icon: Icons.User,
        body: t.Hooks.MemberEventParser.broken,
      };

    const senderName = getMxIdLocalPart(senderId);
    const userName =
      typeof content.displayname === 'string'
        ? content.displayname || getMxIdLocalPart(userId)
        : getMxIdLocalPart(userId);

    if (isMembershipChanged(mEvent)) {
      if (content.membership === Membership.Invite) {
        if (prevContent.membership === Membership.Knock) {
          return {
            icon: Icons.ArrowGoRightPlus,
            body: (
              <>
                <b>{senderName}</b>
                {t.Hooks.MemberEventParser.accepted}
                <b>{userName}</b>
                {t.Hooks.MemberEventParser.joinRequest}
                {reason}
              </>
            ),
          };
        }

        return {
          icon: Icons.ArrowGoRightPlus,
          body: (
            <>
              <b>{senderName}</b>
              {t.Hooks.MemberEventParser.invited}
              <b>{userName}</b> {reason}
            </>
          ),
        };
      }

      if (content.membership === Membership.Knock) {
        return {
          icon: Icons.ArrowGoRightPlus,
          body: (
            <>
              <b>{userName}</b>
              {t.Hooks.MemberEventParser.requestToJoin}
              {reason}
            </>
          ),
        };
      }

      if (content.membership === Membership.Join) {
        return {
          icon: Icons.ArrowGoRight,
          body: (
            <>
              <b>{userName}</b>
              {t.Hooks.MemberEventParser.joined}
            </>
          ),
        };
      }

      if (content.membership === Membership.Leave) {
        if (prevContent.membership === Membership.Invite) {
          return {
            icon: Icons.ArrowGoRightCross,
            body:
              senderId === userId ? (
                <>
                  <b>{userName}</b>
                  {t.Hooks.MemberEventParser.rejectedInvitation}
                  {reason}
                </>
              ) : (
                <>
                  <b>{senderName}</b>
                  {t.Hooks.MemberEventParser.rejected}
                  <b>{userName}</b>
                  {t.Hooks.MemberEventParser.joinRequest}
                  {reason}
                </>
              ),
          };
        }

        if (prevContent.membership === Membership.Knock) {
          return {
            icon: Icons.ArrowGoRightCross,
            body:
              senderId === userId ? (
                <>
                  <b>{userName}</b>
                  {t.Hooks.MemberEventParser.revokedJoinedRequest}
                  {reason}
                </>
              ) : (
                <>
                  <b>{senderName}</b>
                  {t.Hooks.MemberEventParser.revoked}
                  <b>{userName}</b>
                  {t.Hooks.MemberEventParser.invite}
                  {reason}
                </>
              ),
          };
        }

        if (prevContent.membership === Membership.Ban) {
          return {
            icon: Icons.ArrowGoLeft,
            body: (
              <>
                <b>{senderName}</b>
                {t.Hooks.MemberEventParser.unbanned}
                <b>{userName}</b> {reason}
              </>
            ),
          };
        }

        return {
          icon: Icons.ArrowGoLeft,
          body:
            senderId === userId ? (
              <>
                <b>{userName}</b>
                {t.Hooks.MemberEventParser.left}
                {reason}
              </>
            ) : (
              <>
                <b>{senderName}</b>
                {t.Hooks.MemberEventParser.kicked}
                <b>{userName}</b> {reason}
              </>
            ),
        };
      }

      if (content.membership === Membership.Ban) {
        return {
          icon: Icons.ArrowGoLeft,
          body: (
            <>
              <b>{senderName}</b>
              {t.Hooks.MemberEventParser.banned}
              <b>{userName}</b> {reason}
            </>
          ),
        };
      }
    }

    if (content.displayname !== prevContent.displayname) {
      const prevUserName =
        typeof prevContent.displayname === 'string'
          ? prevContent.displayname || getMxIdLocalPart(userId)
          : getMxIdLocalPart(userId);

      return {
        icon: Icons.Mention,
        body:
          typeof content.displayname === 'string' ? (
            <>
              <b>{prevUserName}</b>
              {t.Hooks.MemberEventParser.changedDisplayName}
              <b>{userName}</b>
            </>
          ) : (
            <>
              <b>{prevUserName}</b>
              {t.Hooks.MemberEventParser.removedDisplayName}
            </>
          ),
      };
    }
    if (content.avatar_url !== prevContent.avatar_url) {
      return {
        icon: Icons.User,
        body:
          content.avatar_url && typeof content.avatar_url === 'string' ? (
            <>
              <b>{userName}</b>
              {t.Hooks.MemberEventParser.changedAvatar}
            </>
          ) : (
            <>
              <b>{userName}</b>
              {t.Hooks.MemberEventParser.removedAvatar}
            </>
          ),
      };
    }

    return {
      icon: Icons.User,
      body: t.Hooks.MemberEventParser.noChanges,
    };
  };

  return parseMemberEvent;
};
