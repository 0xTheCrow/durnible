/**
 * Revy Message Components
 * Premium message design for Revy Comms
 */

import React, { ReactNode, useState, useCallback, forwardRef, useMemo } from 'react';
import classNames from 'classnames';
import * as css from './RevyMessage.css';

// ============================================================================
// ICONS
// ============================================================================

const SmileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" x2="9.01" y1="9" y2="9" />
    <line x1="15" x2="15.01" y1="9" y2="9" />
  </svg>
);

const ReplyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 17 4 12 9 7" />
    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </svg>
);

const MoreHorizontalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const BookmarkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const MessageSquareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const BotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const RefreshCwIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

// ============================================================================
// TYPES
// ============================================================================

export interface MessageAuthor {
  id: string;
  name: string;
  avatar?: string;
  isAI?: boolean;
  badge?: 'ai' | 'bot' | 'mod' | 'admin';
}

export interface MessageReaction {
  emoji: string;
  count: number;
  active: boolean;
}

export interface MessageProps {
  id: string;
  author: MessageAuthor;
  content: ReactNode;
  timestamp: string;
  isFirst?: boolean;
  highlight?: boolean;
  selected?: boolean;
  reactions?: MessageReaction[];
  threadCount?: number;
  threadParticipants?: string[];
  reply?: {
    authorName: string;
    authorAvatar?: string;
    content: string;
  };
  onReply?: () => void;
  onReact?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMore?: () => void;
  onReactionClick?: (emoji: string) => void;
  onThreadClick?: () => void;
  onAuthorClick?: () => void;
  onReplyClick?: () => void;
}

// ============================================================================
// MESSAGE COMPONENT
// ============================================================================

export const RevyMessage = forwardRef<HTMLDivElement, MessageProps>(
  (
    {
      id,
      author,
      content,
      timestamp,
      isFirst = false,
      highlight = false,
      selected = false,
      reactions,
      threadCount,
      threadParticipants,
      reply,
      onReply,
      onReact,
      onEdit,
      onDelete,
      onMore,
      onReactionClick,
      onThreadClick,
      onAuthorClick,
      onReplyClick,
    },
    ref
  ) => {
    const initials = author.name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    return (
      <div
        ref={ref}
        id={id}
        className={css.MessageContainer({
          highlight,
          selected,
          isAI: author.isAI,
          isFirst,
        })}
      >
        {/* Message Actions (hover toolbar) */}
        <div className={css.MessageActions}>
          {onReact && (
            <button
              className={css.MessageActionButton()}
              onClick={onReact}
              type="button"
              aria-label="Add reaction"
            >
              <span className={css.MessageActionIcon}>
                <SmileIcon />
              </span>
            </button>
          )}
          {onReply && (
            <button
              className={css.MessageActionButton()}
              onClick={onReply}
              type="button"
              aria-label="Reply"
            >
              <span className={css.MessageActionIcon}>
                <ReplyIcon />
              </span>
            </button>
          )}
          {onEdit && (
            <button
              className={css.MessageActionButton()}
              onClick={onEdit}
              type="button"
              aria-label="Edit"
            >
              <span className={css.MessageActionIcon}>
                <EditIcon />
              </span>
            </button>
          )}
          {onDelete && (
            <button
              className={css.MessageActionButton({ danger: true })}
              onClick={onDelete}
              type="button"
              aria-label="Delete"
            >
              <span className={css.MessageActionIcon}>
                <TrashIcon />
              </span>
            </button>
          )}
          {onMore && (
            <button
              className={css.MessageActionButton()}
              onClick={onMore}
              type="button"
              aria-label="More options"
            >
              <span className={css.MessageActionIcon}>
                <MoreHorizontalIcon />
              </span>
            </button>
          )}
        </div>

        <div className={css.MessageLayout}>
          {/* Avatar Area */}
          <div className={css.MessageAvatarArea}>
            {isFirst && (
              <button
                className={classNames(
                  css.MessageAvatar({ size: 'lg' }),
                  author.isAI && css.MessageAvatarAI
                )}
                onClick={onAuthorClick}
                type="button"
              >
                {author.isAI ? (
                  <span style={{ width: 20, height: 20 }}>
                    <BotIcon />
                  </span>
                ) : author.avatar ? (
                  <img className={css.MessageAvatarImage} src={author.avatar} alt={author.name} />
                ) : (
                  <div className={css.MessageAvatarFallback}>{initials}</div>
                )}
              </button>
            )}
          </div>

          {/* Content Area */}
          <div className={css.MessageContent}>
            {/* Header (only on first message in group) */}
            {isFirst && (
              <div className={css.MessageHeader}>
                <span
                  className={css.MessageUsername({ isAI: author.isAI })}
                  onClick={onAuthorClick}
                  role="button"
                  tabIndex={0}
                >
                  {author.name}
                </span>
                {author.badge && (
                  <span className={css.MessageBadge({ variant: author.badge })}>
                    {author.badge}
                  </span>
                )}
                <span className={css.MessageTimestamp()}>{timestamp}</span>
              </div>
            )}

            {/* Reply Quote */}
            {reply && (
              <div className={css.ReplyQuote} onClick={onReplyClick} role="button" tabIndex={0}>
                <div className={css.ReplyQuoteAvatar}>
                  {reply.authorAvatar ? (
                    <img
                      src={reply.authorAvatar}
                      alt={reply.authorName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#6366F1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#FFF',
                      }}
                    >
                      {reply.authorName[0]}
                    </div>
                  )}
                </div>
                <div className={css.ReplyQuoteContent}>
                  <span className={css.ReplyQuoteName}>{reply.authorName}</span>
                  <span className={css.ReplyQuoteText}>{reply.content}</span>
                </div>
              </div>
            )}

            {/* Message Body */}
            <div className={css.MessageBody()}>{content}</div>

            {/* Reactions */}
            {reactions && reactions.length > 0 && (
              <div className={css.ReactionsContainer}>
                {reactions.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    className={css.ReactionChip({ active: reaction.active })}
                    onClick={() => onReactionClick?.(reaction.emoji)}
                    type="button"
                  >
                    <span className={css.ReactionEmoji}>{reaction.emoji}</span>
                    <span className={css.ReactionCount}>{reaction.count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Thread Indicator */}
            {threadCount !== undefined && threadCount > 0 && (
              <button
                className={css.ThreadIndicator}
                onClick={onThreadClick}
                type="button"
              >
                <MessageSquareIcon />
                <span>
                  {threadCount} {threadCount === 1 ? 'reply' : 'replies'}
                </span>
                {threadParticipants && threadParticipants.length > 0 && (
                  <div className={css.ThreadIndicatorAvatars}>
                    {threadParticipants.slice(0, 3).map((avatar, i) => (
                      <div key={i} className={css.ThreadIndicatorAvatar}>
                        <img
                          src={avatar}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </button>
            )}

            {/* Timestamp for non-first messages (shows on hover) */}
            {!isFirst && (
              <span className={css.MessageTimestamp({ hover: true })}>{timestamp}</span>
            )}
          </div>
        </div>
      </div>
    );
  }
);
RevyMessage.displayName = 'RevyMessage';

// ============================================================================
// AI RESPONSE CARD
// ============================================================================

interface AIResponseCardProps {
  title: string;
  children: ReactNode;
  onCopy?: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onSendEmail?: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function AIResponseCard({
  title,
  children,
  onCopy,
  onEdit,
  onRegenerate,
  onSendEmail,
  primaryAction,
}: AIResponseCardProps) {
  return (
    <div className={css.AIResponseCard}>
      <div className={css.AIResponseHeader}>
        <span className={css.AIResponseIcon}>
          <BotIcon />
        </span>
        <span className={css.AIResponseTitle}>{title}</span>
      </div>
      <div className={css.AIResponseContent}>{children}</div>
      <div className={css.AIResponseActions}>
        {onCopy && (
          <button className={css.AIResponseAction()} onClick={onCopy} type="button">
            <CopyIcon />
            Copy
          </button>
        )}
        {onEdit && (
          <button className={css.AIResponseAction()} onClick={onEdit} type="button">
            <EditIcon />
            Edit
          </button>
        )}
        {onSendEmail && (
          <button className={css.AIResponseAction()} onClick={onSendEmail} type="button">
            <SendIcon />
            Send as Email
          </button>
        )}
        {onRegenerate && (
          <button className={css.AIResponseAction()} onClick={onRegenerate} type="button">
            <RefreshCwIcon />
            Regenerate
          </button>
        )}
        {primaryAction && (
          <button
            className={css.AIResponseAction({ primary: true })}
            onClick={primaryAction.onClick}
            type="button"
          >
            {primaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// FILE ATTACHMENT
// ============================================================================

interface FileAttachmentProps {
  name: string;
  size: string;
  onDownload?: () => void;
  onClick?: () => void;
}

export function FileAttachment({ name, size, onDownload, onClick }: FileAttachmentProps) {
  return (
    <div className={css.FileAttachment} onClick={onClick} role="button" tabIndex={0}>
      <div className={css.FileAttachmentIcon}>
        <FileIcon />
      </div>
      <div className={css.FileAttachmentInfo}>
        <div className={css.FileAttachmentName}>{name}</div>
        <div className={css.FileAttachmentSize}>{size}</div>
      </div>
      {onDownload && (
        <button
          className={css.FileAttachmentDownload}
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          type="button"
          aria-label="Download"
        >
          <DownloadIcon />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// IMAGE ATTACHMENT
// ============================================================================

interface ImageAttachmentProps {
  src: string;
  alt?: string;
  onClick?: () => void;
}

export function ImageAttachment({ src, alt = '', onClick }: ImageAttachmentProps) {
  return (
    <div className={css.ImageAttachment} onClick={onClick} role="button" tabIndex={0}>
      <img className={css.ImageAttachmentImg} src={src} alt={alt} loading="lazy" />
    </div>
  );
}

// ============================================================================
// DATE DIVIDER
// ============================================================================

interface DateDividerProps {
  date: string;
}

export function DateDivider({ date }: DateDividerProps) {
  return (
    <div className={css.DateDivider}>
      <div className={css.DateDividerLine} />
      <span className={css.DateDividerText}>{date}</span>
      <div className={css.DateDividerLine} />
    </div>
  );
}

// ============================================================================
// UNREAD DIVIDER
// ============================================================================

interface UnreadDividerProps {
  label?: string;
}

export function UnreadDivider({ label = 'New messages' }: UnreadDividerProps) {
  return (
    <div className={css.UnreadDivider}>
      <div className={css.UnreadDividerLine} />
      <span className={css.UnreadDividerText}>{label}</span>
      <div className={css.UnreadDividerLine} />
    </div>
  );
}

// ============================================================================
// TYPING INDICATOR
// ============================================================================

interface TypingIndicatorProps {
  users: string[];
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  const text = useMemo(() => {
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0]} is typing`;
    if (users.length === 2) return `${users[0]} and ${users[1]} are typing`;
    return `${users[0]} and ${users.length - 1} others are typing`;
  }, [users]);

  if (users.length === 0) return null;

  return (
    <div className={css.TypingIndicator}>
      <div className={css.TypingDots}>
        <div className={css.TypingDot} />
        <div className={css.TypingDot} />
        <div className={css.TypingDot} />
      </div>
      <span>{text}</span>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default RevyMessage;
