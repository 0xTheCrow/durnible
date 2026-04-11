import React, { useState } from 'react';
import { Box, Text, as } from 'folds';
import classNames from 'classnames';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import * as css from './Reaction.css';
import { getHexcodeForEmoji, getShortcodeFor } from '../../plugins/emoji';
import { getMemberDisplayName } from '../../utils/room';
import { eventWithShortcode, getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { isAnimatedImageMimetype } from '../../utils/mimeTypes';
import { AnimatedEmojiOverlay } from '../AnimatedEmojiOverlay';

export const Reaction = as<
  'button',
  {
    mx: MatrixClient;
    count: number;
    reaction: string;
    useAuthentication?: boolean;
    pauseGifs?: boolean;
    imagePackMimetypes?: Map<string, string>;
  }
>(
  (
    { className, mx, count, reaction, useAuthentication, pauseGifs, imagePackMimetypes, ...props },
    ref
  ) => {
    const [hovered, setHovered] = useState(false);

    const isMxc = reaction.startsWith('mxc://');
    const isAnimated = isMxc && isAnimatedImageMimetype(imagePackMimetypes?.get(reaction));

    let reactionContent: React.ReactNode;
    if (!isMxc) {
      reactionContent = (
        <Text as="span" size="Inherit" truncate>
          {reaction}
        </Text>
      );
    } else {
      const resolvedSrc = mxcUrlToHttp(mx, reaction, useAuthentication) ?? reaction;
      reactionContent = isAnimated ? (
        <AnimatedEmojiOverlay
          className={css.ReactionImg}
          src={resolvedSrc}
          alt={reaction}
          pauseGifs={pauseGifs ?? false}
          hovered={hovered}
        />
      ) : (
        <img className={css.ReactionImg} src={resolvedSrc} alt={reaction} />
      );
    }

    return (
      <Box
        as="button"
        className={classNames(css.Reaction, className)}
        alignItems="Center"
        shrink="No"
        gap="200"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        {...props}
        ref={ref}
      >
        <Text className={css.ReactionText} as="span" size="T500">
          {reactionContent}
        </Text>
        <Text as="span" size="T300">
          {count}
        </Text>
      </Box>
    );
  }
);

type ReactionTooltipMsgProps = {
  room: Room;
  reaction: string;
  events: MatrixEvent[];
};

export function ReactionTooltipMsg({ room, reaction, events }: ReactionTooltipMsgProps) {
  const shortCodeEvt = events.find(eventWithShortcode);
  const shortcode =
    shortCodeEvt?.getContent().shortcode ??
    getShortcodeFor(getHexcodeForEmoji(reaction)) ??
    reaction;
  const names = events.map(
    (ev: MatrixEvent) =>
      getMemberDisplayName(room, ev.getSender() ?? 'Unknown') ??
      getMxIdLocalPart(ev.getSender() ?? 'Unknown') ??
      'Unknown'
  );

  return (
    <>
      {names.length === 1 && <b>{names[0]}</b>}
      {names.length === 2 && (
        <>
          <b>{names[0]}</b>
          <Text as="span" size="Inherit" priority="300">
            {' and '}
          </Text>
          <b>{names[1]}</b>
        </>
      )}
      {names.length === 3 && (
        <>
          <b>{names[0]}</b>
          <Text as="span" size="Inherit" priority="300">
            {', '}
          </Text>
          <b>{names[1]}</b>
          <Text as="span" size="Inherit" priority="300">
            {' and '}
          </Text>
          <b>{names[2]}</b>
        </>
      )}
      {names.length > 3 && (
        <>
          <b>{names[0]}</b>
          <Text as="span" size="Inherit" priority="300">
            {', '}
          </Text>
          <b>{names[1]}</b>
          <Text as="span" size="Inherit" priority="300">
            {', '}
          </Text>
          <b>{names[2]}</b>
          <Text as="span" size="Inherit" priority="300">
            {' and '}
          </Text>
          <b>{names.length - 3} others</b>
        </>
      )}
      <Text as="span" size="Inherit" priority="300">
        {' reacted with '}
      </Text>
      :<b>{shortcode}</b>:
    </>
  );
}
