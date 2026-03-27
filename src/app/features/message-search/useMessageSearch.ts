import {
  IEventWithRoomId,
  IResultContext,
  ISearchRequestBody,
  ISearchResponse,
  ISearchResult,
  SearchOrderBy,
} from 'matrix-js-sdk';
import { useCallback } from 'react';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import type { LocalSearchResult, AttachedImage } from '../../services/localSearch';

export type ResultItem = {
  rank: number;
  event: IEventWithRoomId;
  context: IResultContext;
  attachedImages?: AttachedImage[];
};

export type ResultGroup = {
  roomId: string;
  items: ResultItem[];
};

export type SearchResult = {
  nextToken?: string;
  highlights: string[];
  groups: ResultGroup[];
};

const groupSearchResult = (results: ISearchResult[]): ResultGroup[] => {
  const groups: ResultGroup[] = [];

  results.forEach((item) => {
    const roomId = item.result.room_id;
    const resultItem: ResultItem = {
      rank: item.rank,
      event: item.result,
      context: item.context,
    };

    const lastAddedGroup: ResultGroup | undefined = groups[groups.length - 1];
    if (lastAddedGroup && roomId === lastAddedGroup.roomId) {
      lastAddedGroup.items.push(resultItem);
      return;
    }
    groups.push({
      roomId,
      items: [resultItem],
    });
  });

  return groups;
};

const parseSearchResult = (result: ISearchResponse): SearchResult => {
  const roomEvents = result.search_categories.room_events;

  return {
    nextToken: roomEvents?.next_batch,
    highlights: roomEvents?.highlights ?? [],
    groups: groupSearchResult(roomEvents?.results ?? []),
  };
};

export const localResultsToGroups = (results: LocalSearchResult[]): ResultGroup[] => {
  const groups: ResultGroup[] = [];

  for (const r of results) {
    const event: IEventWithRoomId = {
      event_id: r.event_id,
      room_id: r.room_id,
      sender: r.sender,
      origin_server_ts: r.origin_server_ts,
      type: 'm.room.message',
      content: r.content
        ? { ...r.content, msgtype: r.type || 'm.text', body: r.body }
        : { msgtype: r.type || 'm.text', body: r.body },
    };

    const item: ResultItem = {
      rank: 1,
      event,
      context: {
        events_before: [],
        events_after: [],
        profile_info: {},
      },
      attachedImages: r.attachedImages,
    };

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.roomId === r.room_id) {
      lastGroup.items.push(item);
    } else {
      groups.push({ roomId: r.room_id, items: [item] });
    }
  }

  return groups;
};

export type ServerSearchParams = {
  term?: string;
  order?: string;
  rooms?: string[]; // unencrypted rooms only (or undefined for global)
  senders?: string[];
};

/**
 * Returns a callback for server-side (unencrypted room) search with pagination.
 * Encrypted rooms are handled separately via streamSearchEncryptedRoom.
 */
export const useServerSearch = (params: ServerSearchParams) => {
  const mx = useMatrixClient();
  const { term, order, rooms, senders } = params;

  return useCallback(
    async (nextBatch?: string): Promise<SearchResult> => {
      if (!term) return { highlights: [], groups: [] };

      const requestBody: ISearchRequestBody = {
        search_categories: {
          room_events: {
            event_context: {
              before_limit: 0,
              after_limit: 0,
              include_profile: false,
            },
            filter: {
              limit: 20,
              rooms: rooms,
              senders,
            },
            include_state: false,
            order_by: order as SearchOrderBy.Recent,
            search_term: term,
          },
        },
      };

      const r = await mx.search({
        body: requestBody,
        next_batch: nextBatch === '' ? undefined : nextBatch,
      });
      return parseSearchResult(r);
    },
    [mx, term, order, rooms, senders]
  );
};
