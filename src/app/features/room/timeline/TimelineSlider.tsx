import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Spinner, Text, color } from 'folds';
import { atom, useAtom, useAtomValue } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import { useStateEvent } from '../../../hooks/useStateEvent';
import { StateEvent } from '../../../../types/matrix/room';
import { timeDayMonthYear, timeHourMinute } from '../../../utils/time';
import { useSetting } from '../../../state/hooks/settings';
import type { TimelineSliderRange } from '../../../state/settings';
import { settingsAtom } from '../../../state/settings';
import * as css from './TimelineSlider.css';

export const timelineSliderVisibleAtom = atom(false);
export const timelineSliderPositionAtom = atom(1);

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
  onJumpToTimestamp: (timestamp: number) => void;
  onJumpToLatest: () => void;
  loading?: boolean;
  error?: string;
};

export function TimelineSlider({
  room,
  onJumpToTimestamp,
  onJumpToLatest,
  loading,
  error,
}: TimelineSliderProps) {
  const visible = useAtomValue(timelineSliderVisibleAtom);

  const createStateEvent = useStateEvent(room, StateEvent.RoomCreate);
  const createTs = useMemo(() => createStateEvent?.getTs() ?? 0, [createStateEvent]);

  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [sliderRange, setSliderRange] = useSetting(settingsAtom, 'timelineSliderRange');

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [hoverPos, setHoverPos] = useState(0);
  const [position, setPosition] = useAtom(timelineSliderPositionAtom);

  const now = Date.now();
  const rangeDuration = rangeToMs[sliderRange];
  const minTs = rangeDuration !== null ? Math.max(createTs, now - rangeDuration) : createTs;
  const maxTs = now;

  const positionToTs = useCallback(
    (pos: number): number => minTs + (maxTs - minTs) * pos,
    [minTs, maxTs]
  );

  const currentTs = positionToTs(position);

  const getPositionFromPointer = useCallback((clientY: number) => {
    const track = trackRef.current;
    if (!track) return 1;
    const rect = track.getBoundingClientRect();
    const y = clientY - rect.top;
    return Math.max(0, Math.min(1, y / rect.height));
  }, []);

  // Refs so the document-level onUp always reads the latest callbacks
  const onJumpRef = useRef(onJumpToTimestamp);
  onJumpRef.current = onJumpToTimestamp;
  const onJumpLatestRef = useRef(onJumpToLatest);
  onJumpLatestRef.current = onJumpToLatest;
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

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        setDragging(false);

        const finalPos = positionRef.current;
        if (finalPos >= 0.98) {
          onJumpLatestRef.current();
        } else {
          const ts = minTsRef.current + (maxTsRef.current - minTsRef.current) * finalPos;
          onJumpRef.current(ts);
        }
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [getPositionFromPointer, setPosition]
  );

  if (!visible) return null;

  const rangeLabels: { key: TimelineSliderRange; label: string }[] = [
    { key: 'day', label: '1D' },
    { key: 'week', label: '1W' },
    { key: 'month', label: '1M' },
    { key: '3months', label: '3M' },
    { key: '6months', label: '6M' },
    { key: 'year', label: '1Y' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className={css.SliderContainer}>
      <div className={css.RangeChips}>
        {rangeLabels.map(({ key, label }) => {
          const handleSelect = () => {
            const currentTimestamp = minTs + (maxTs - minTs) * position;
            const newRangeDuration = rangeToMs[key];
            const newMinTs =
              newRangeDuration !== null ? Math.max(createTs, now - newRangeDuration) : createTs;
            const newRange = maxTs - newMinTs;
            if (newRange > 0) {
              setPosition(Math.max(0, Math.min(1, (currentTimestamp - newMinTs) / newRange)));
            }
            setSliderRange(key);
          };
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              aria-pressed={sliderRange === key}
              className={css.RangeChip}
              data-active={sliderRange === key}
              onClick={handleSelect}
              onKeyDown={(evt) => {
                if (evt.key === 'Enter' || evt.key === ' ') {
                  evt.preventDefault();
                  handleSelect();
                }
              }}
            >
              <Text size="T200" style={{ color: sliderRange === key ? 'white' : undefined }}>
                {label}
              </Text>
            </div>
          );
        })}
      </div>
      <div
        ref={trackRef}
        className={css.SliderTrack}
        onPointerDown={handlePointerDown}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onPointerMove={(e) => {
          if (!dragging) setHoverPos(getPositionFromPointer(e.clientY));
        }}
      >
        <div
          className={css.SliderThumb}
          data-dragging={dragging}
          style={{ top: `${position * 100}%` }}
        >
          {loading ? (
            <Spinner size="200" variant="Primary" fill="Solid" />
          ) : (
            <div className={css.SliderThumbGrip}>
              <div className={css.SliderThumbGripLine} />
              <div className={css.SliderThumbGripLine} />
              <div className={css.SliderThumbGripLine} />
            </div>
          )}
        </div>
        {dragging && (
          <div className={css.SliderTooltip} style={{ top: `${position * 100}%` }}>
            <Text size="T200">
              {timeDayMonthYear(currentTs)} {timeHourMinute(currentTs, hour24Clock)}
            </Text>
          </div>
        )}
        {hovering && !dragging && (
          <div className={css.SliderTooltip} style={{ top: `${hoverPos * 100}%` }}>
            <Text size="T200">
              {timeDayMonthYear(positionToTs(hoverPos))}{' '}
              {timeHourMinute(positionToTs(hoverPos), hour24Clock)}
            </Text>
          </div>
        )}
        {error && !dragging && (
          <div className={css.SliderTooltip} style={{ top: `${position * 100}%` }}>
            <Text size="T200" style={{ color: color.Critical.Main }}>
              {error}
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}
