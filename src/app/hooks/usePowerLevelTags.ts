import { Room } from 'matrix-js-sdk';
import { useMemo } from 'react';
import { IPowerLevels } from './usePowerLevels';
import { useStateEvent } from './useStateEvent';
import { MemberPowerTag, StateEvent } from '../../types/matrix/room';
import { useTranslation } from '../internationalization';

export type PowerLevelTags = Record<number, MemberPowerTag>;

const powerSortFn = (a: number, b: number) => b - a;
const sortPowers = (powers: number[]): number[] => powers.sort(powerSortFn);

export const getPowers = (tags: PowerLevelTags): number[] => {
  const powers: number[] = Object.keys(tags)
    .map((p) => {
      const power = parseInt(p, 10);
      if (Number.isNaN(power)) {
        return undefined;
      }
      return power;
    })
    .filter((power) => typeof power === 'number');

  return sortPowers(powers);
};

export const getUsedPowers = (powerLevels: IPowerLevels): Set<number> => {
  const powers: Set<number> = new Set();

  const findAndAddPower = (data: Record<string, unknown>) => {
    Object.keys(data).forEach((key) => {
      const powerOrAny: unknown = data[key];

      if (typeof powerOrAny === 'number') {
        powers.add(powerOrAny);
        return;
      }
      if (powerOrAny && typeof powerOrAny === 'object') {
        findAndAddPower(powerOrAny as Record<string, unknown>);
      }
    });
  };

  findAndAddPower(powerLevels);

  return powers;
};

const generateFallbackTag = (
  powerLevelTags: PowerLevelTags,
  power: number,
  t: any,
): MemberPowerTag => {
  const highToLow = sortPowers(getPowers(powerLevelTags));

  const tagPower = highToLow.find((p) => p < power);
  const tag = typeof tagPower === 'number' ? powerLevelTags[tagPower] : undefined;

  return {
    name: tag ? t.PowerLevelTags.customTag(tag.name, power) : t.PowerLevelTags.customPower(power),
  };
};

export const usePowerLevelTags = (room: Room, powerLevels: IPowerLevels): PowerLevelTags => {
  const [t] = useTranslation();
  const tagsEvent = useStateEvent(room, StateEvent.PowerLevelTags);

  const defaultTags: PowerLevelTags = useMemo(
    () => ({
      9001: {
        name: t.PowerLevelTags.goku,
        color: '#ff6a00',
      },
      150: {
        name: t.PowerLevelTags.manager,
        color: '#ff6a7f',
      },
      101: {
        name: t.PowerLevelTags.founder,
        color: '#0000ff',
      },
      100: {
        name: t.PowerLevelTags.admin,
        color: '#0088ff',
      },
      50: {
        name: t.PowerLevelTags.moderator,
        color: '#1fd81f',
      },
      0: {
        name: t.PowerLevelTags.member,
        color: '#91cfdf',
      },
      [-1]: {
        name: t.PowerLevelTags.muted,
        color: '#888888',
      },
    }),
    [t],
  );

  const powerLevelTags: PowerLevelTags = useMemo(() => {
    const content = tagsEvent?.getContent<PowerLevelTags>();
    const powerToTags: PowerLevelTags = { ...content };

    const powers = getUsedPowers(powerLevels);
    Array.from(powers).forEach((power) => {
      if (powerToTags[power]?.name === undefined) {
        powerToTags[power] = defaultTags[power] ?? generateFallbackTag(defaultTags, power, t);
      }
    });

    return powerToTags;
  }, [powerLevels, tagsEvent, defaultTags, t]);

  return powerLevelTags;
};

export const getPowerLevelTag = (
  powerLevelTags: PowerLevelTags,
  powerLevel: number,
  t: any,
): MemberPowerTag => {
  const tag: MemberPowerTag | undefined = powerLevelTags[powerLevel];
  return tag ?? generateFallbackTag(powerLevelTags, powerLevel, t);
};
