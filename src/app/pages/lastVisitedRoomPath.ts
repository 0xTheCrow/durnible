import { matchPath } from 'react-router-dom';
import { DIRECT_ROOM_PATH, HOME_ROOM_PATH, SPACE_ROOM_PATH } from './paths';
import { getDirectRoomPath, getHomeRoomPath, getSpaceRoomPath } from './pathUtils';
import { isRoomAlias, isRoomId } from '../utils/matrix';
import { tryDecodeURIComponent } from '../utils/dom';

const LAST_VISITED_ROOM_PATH_KEY = 'durnible_last_visited_room_path';

const getRoomIdOrAliasParam = (param: string | undefined): string | undefined => {
  if (!param) return undefined;
  const idOrAlias = tryDecodeURIComponent(param);
  if (!isRoomId(idOrAlias) && !isRoomAlias(idOrAlias)) return undefined;
  return idOrAlias;
};

const matchRoomPath = (path: string, pathname: string) =>
  matchPath({ path, caseSensitive: true, end: true }, pathname);

export const getRoomPathWithoutEventId = (pathname: string): string | undefined => {
  const homeRoomIdOrAlias = getRoomIdOrAliasParam(
    matchRoomPath(HOME_ROOM_PATH, pathname)?.params.roomIdOrAlias
  );
  if (homeRoomIdOrAlias) return getHomeRoomPath(homeRoomIdOrAlias);

  const directRoomIdOrAlias = getRoomIdOrAliasParam(
    matchRoomPath(DIRECT_ROOM_PATH, pathname)?.params.roomIdOrAlias
  );
  if (directRoomIdOrAlias) return getDirectRoomPath(directRoomIdOrAlias);

  const spaceRoomParams = matchRoomPath(SPACE_ROOM_PATH, pathname)?.params;
  const spaceIdOrAlias = getRoomIdOrAliasParam(spaceRoomParams?.spaceIdOrAlias);
  const spaceRoomIdOrAlias = getRoomIdOrAliasParam(spaceRoomParams?.roomIdOrAlias);
  if (spaceIdOrAlias && spaceRoomIdOrAlias) {
    return getSpaceRoomPath(spaceIdOrAlias, spaceRoomIdOrAlias);
  }

  return undefined;
};

export const setLastVisitedRoomPath = (path: string): void => {
  localStorage.setItem(LAST_VISITED_ROOM_PATH_KEY, path);
};

export const getLastVisitedRoomPath = (): string | undefined =>
  localStorage.getItem(LAST_VISITED_ROOM_PATH_KEY) ?? undefined;
