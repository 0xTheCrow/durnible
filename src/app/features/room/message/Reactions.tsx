import React, { MouseEventHandler, useCallback, useMemo, useState } from 'react';
import {
  Box,
  Modal,
  Text,
  Tooltip,
  TooltipProvider,
  as,
  toRem,
} from 'folds';
import classNames from 'classnames';
import { EventType, MatrixEvent, RelationType, Room } from 'matrix-js-sdk';
import { type Relations } from 'matrix-js-sdk/lib/models/relations';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { factoryEventSentBy } from '../../../utils/matrix';
import { Reaction, ReactionTooltipMsg } from '../../../components/message';
import { useRelations } from '../../../hooks/useRelations';
import * as css from './styles.css';
import { ReactionViewer } from '../reaction-viewer';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { OverlayModal } from '../../../components/OverlayModal';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';

export type ReactionsProps = {
  room: Room;
  mEventId: string;
  canSendReaction?: boolean;
  relations: Relations;
  onReactionToggle: (targetEventId: string, key: string, shortcode?: string) => void;
};
export const Reactions = as<'div', ReactionsProps>(
  ({ className, room, relations, mEventId, canSendReaction, onReactionToggle, ...props }, ref) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const screenSize = useScreenSizeContext();
    const [pauseGifs] = useSetting(settingsAtom, 'pauseGifs');
    const [viewer, setViewer] = useState<boolean | string>(false);
    const myUserId = mx.getUserId();

    // Get earliest timestamp for each reaction key from timeline (including redacted events)
    // This preserves ordering even when the original reactor unreacts
    const firstReactionTimestamps = useMemo(() => {
      const timeline = room.getLiveTimeline();
      const timelineEvents = timeline.getEvents();

      return timelineEvents.reduce((timestamps, event) => {
        if (event.getType() !== EventType.Reaction) return timestamps;
        const relation = event.getRelation();
        if (
          relation?.event_id !== mEventId ||
          relation?.rel_type !== RelationType.Annotation ||
          typeof relation?.key !== 'string'
        ) return timestamps;

        const { key } = relation;
        const ts = event.getTs() ?? 0;
        const existing = timestamps.get(key);
        if (existing === undefined || ts < existing) {
          timestamps.set(key, ts);
        }
        return timestamps;
      }, new Map<string, number>());
    }, [room, mEventId]);

    const reactions = useRelations(
      relations,
      useCallback((rel) => {
        const events = rel.getRelations();
        const keyMap = events.reduce((map, ev) => {
          const key = ev.getRelation()?.key;
          if (typeof key !== 'string') return map;
          const existing = map.get(key) ?? new Set<MatrixEvent>();
          existing.add(ev);
          map.set(key, existing);
          return map;
        }, new Map<string, Set<MatrixEvent>>());

        // Sort by earliest reaction timestamp (from timeline, includes redacted)
        return Array.from(keyMap.entries()).sort((a, b) => {
          const aTs = firstReactionTimestamps.get(a[0]) ?? Infinity;
          const bTs = firstReactionTimestamps.get(b[0]) ?? Infinity;
          return aTs - bTs;
        });
      }, [firstReactionTimestamps])
    );

    const handleViewReaction: MouseEventHandler<HTMLButtonElement> = (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      const key = evt.currentTarget.getAttribute('data-reaction-key');
      if (!key) setViewer(true);
      else setViewer(key);
    };

    return (
      <Box
        className={classNames(css.ReactionsContainer, className)}
        gap="200"
        wrap="Wrap"
        {...props}
        ref={ref}
      >
        {reactions.map(([key, events]) => {
          const rEvents = Array.from(events);
          if (rEvents.length === 0 || typeof key !== 'string') return null;
          const myREvent = myUserId ? rEvents.find(factoryEventSentBy(myUserId)) : undefined;
          const isPressed = !!myREvent?.getRelation();

          return (
            <TooltipProvider
              key={key}
              position="Top"
              tooltip={
                viewer || screenSize === ScreenSize.Mobile ? undefined : (
                  <Tooltip style={{ maxWidth: toRem(200) }}>
                    <Text className={css.ReactionsTooltipText} size="T300">
                      <ReactionTooltipMsg room={room} reaction={key} events={rEvents} />
                    </Text>
                  </Tooltip>
                )
              }
            >
              {(targetRef) => (
                <Reaction
                  ref={targetRef}
                  data-reaction-key={key}
                  aria-pressed={isPressed}
                  key={key}
                  mx={mx}
                  reaction={key}
                  count={events.size}
                  onClick={canSendReaction ? () => onReactionToggle(mEventId, key) : undefined}
                  onContextMenu={handleViewReaction}
                  aria-disabled={!canSendReaction}
                  useAuthentication={useAuthentication}
                  pauseGifs={pauseGifs}
                />
              )}
            </TooltipProvider>
          );
        })}
        {reactions.length > 0 && (
          <OverlayModal
            open={!!viewer}
            requestClose={() => setViewer(false)}
            overlayProps={{ onContextMenu: (evt: any) => { evt.stopPropagation(); } }}
            focusTrapOptions={{
              returnFocusOnDeactivate: false,
            }}
          >
            <Modal
              variant="Surface"
              size="300"
              flexHeight
            >
              <ReactionViewer
                room={room}
                initialKey={typeof viewer === 'string' ? viewer : undefined}
                relations={relations}
                requestClose={() => setViewer(false)}
              />
            </Modal>
          </OverlayModal>
        )}
      </Box>
    );
  }
);
