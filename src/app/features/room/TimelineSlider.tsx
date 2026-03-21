import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Spinner, Text } from 'folds';
import { atom, useAtomValue } from 'jotai';
import { Direction, Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { useAlive } from '../../hooks/useAlive';
import { useStateEvent } from '../../hooks/useStateEvent';
import { StateEvent } from '../../../types/matrix/room';
import { timeDayMonthYear, timeHourMinute } from '../../utils/time';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom, TimelineSliderRange } from '../../state/settings';
import * as css from './TimelineSlider.css';

export const timelineSliderVisibleAtom = atom(false);

const rangeToMs: Record<TimelineSliderRange, number | null> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  '3months': 90 * 24 * 60 * 60 * 1000,
  '6months': 180 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
  all: null,
};

type TimelineSliderProps = {
  room: Room;
};

export function TimelineSlider({ room }: TimelineSliderProps) {
  const mx = useMatrixClient();
  const { navigateRoom } = useRoomNavigate();
  const alive = useAlive();
  const visible = useAtomValue(timelineSliderVisibleAtom);

  const createStateEvent = useStateEvent(room, StateEvent.RoomCreate);
  const createTs = useMemo(() => createStateEvent?.getTs() ?? 0, [createStateEvent]);

  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [sliderRange] = useSetting(settingsAtom, 'timelineSliderRange');

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState(1);
  const [loading, setLoading] = useState(false);

  const now = Date.now();
  const rangeDuration = rangeToMs[sliderRange];
  const minTs = rangeDuration !== null ? Math.max(createTs, now - rangeDuration) : createTs;
  const maxTs = now;

  const positionToTs = useCallback(
    (pos: number): number => minTs + (maxTs - minTs) * pos,
    [minTs, maxTs]
  );

  const currentTs = positionToTs(position);

  const getPositionFromPointer = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return 1;
      const rect = track.getBoundingClientRect();
      const y = clientY - rect.top;
      return Math.max(0, Math.min(1, y / rect.height));
    },
    []
  );

  // Use refs to share latest values with document-level listeners
  const positionRef = useRef(position);
  positionRef.current = position;
  const minTsRef = useRef(minTs);
  minTsRef.current = minTs;
  const maxTsRef = useRef(maxTs);
  maxTsRef.current = maxTs;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const pos = getPositionFromPointer(e.clientY);
      positionRef.current = pos;
      setPosition(pos);
      setDragging(true);

      const onMove = (ev: PointerEvent) => {
        ev.preventDefault();
        const p = getPositionFromPointer(ev.clientY);
        positionRef.current = p;
        setPosition(p);
      };

      const onUp = async () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        setDragging(false);

        const finalPos = positionRef.current;
        const ts = minTsRef.current + (maxTsRef.current - minTsRef.current) * finalPos;

        try {
          setLoading(true);
          const result = await mx.timestampToEvent(room.roomId, ts, Direction.Forward);
          if (alive()) {
            navigateRoom(room.roomId, result.event_id);
          }
        } catch {
          // server may not support MSC3030
        } finally {
          if (alive()) {
            setLoading(false);
          }
        }
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [getPositionFromPointer, mx, room.roomId, alive, navigateRoom]
  );

  if (!visible) return null;

  return (
    <div className={css.SliderContainer}>
      <div
        ref={trackRef}
        className={css.SliderTrack}
        onPointerDown={handlePointerDown}
      >
        <div
          className={css.SliderThumb}
          data-dragging={dragging}
          style={{ top: `${position * 100}%` }}
        >
          <div className={css.SliderThumbGrip}>
            <div className={css.SliderThumbGripLine} />
            <div className={css.SliderThumbGripLine} />
            <div className={css.SliderThumbGripLine} />
          </div>
        </div>
        {dragging && (
          <div className={css.SliderTooltip} style={{ top: `${position * 100}%` }}>
            <Text size="T200">
              {timeDayMonthYear(currentTs)} {timeHourMinute(currentTs, hour24Clock)}
            </Text>
          </div>
        )}
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: `${position * 100}%`,
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <Spinner size="200" />
          </div>
        )}
      </div>
    </div>
  );
}
