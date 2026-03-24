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
import { searchEncryptedRoom, type LocalSearchResult, type OnProgress } from '../../services/localSearch';

export type ResultItem = {
  rank: number;
  event: IEventWithRoomId;
  context: IResultContext;
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

  const searchResult: SearchResult = {
    nextToken: roomEvents?.next_batch,
    highlights: roomEvents?.highlights ?? [],
    groups: groupSearchResult(roomEvents?.results ?? []),
  };

  return searchResult;
};

const localResultsToGroups = (results: LocalSearchResult[]): ResultGroup[] => {
  const groups: ResultGroup[] = [];

  for (const r of results) {
    const event: IEventWithRoomId = {
      event_id: r.event_id,
      room_id: r.room_id,
      sender: r.sender,
      origin_server_ts: r.origin_server_ts,
      type: 'm.room.message',
      content: {
        msgtype: r.type || 'm.text',
        body: r.body,
      },
    };

    const item: ResultItem = {
      rank: 1,
      event,
      context: {
        events_before: [],
        events_after: [],
        profile_info: {},
      },
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

export type MessageSearchParams = {
  term?: string;
  order?: string;
  rooms?: string[];
  senders?: string[];
  startTs?: number;
  endTs?: number;
  onProgress?: OnProgress;
};
export const useMessageSearch = (params: MessageSearchParams) => {
  const mx = useMatrixClient();
  const { term, order, rooms, senders, startTs, endTs, onProgress } = params;

  const searchMessages = useCallback(
    async (nextBatch?: string) => {
      if (!term)
        return {
          highlights: [],
          groups: [],
        };

      // Split rooms into encrypted and unencrypted
      const encryptedRoomIds: string[] = [];
      const unencryptedRoomIds: string[] = [];
      if (rooms) {
        for (const roomId of rooms) {
          const room = mx.getRoom(roomId);
          if (room?.hasEncryptionStateEvent()) {
            encryptedRoomIds.push(roomId);
          } else {
            unencryptedRoomIds.push(roomId);
          }
        }
      }
      const allGroups: ResultGroup[] = [];
      const allHighlights: string[] = [];
      let serverNextToken: string | undefined;

      // Local search for encrypted rooms
      if (encryptedRoomIds.length > 0) {
        const now = Date.now();
        const searchStartTs = startTs ?? now - 90 * 24 * 60 * 60 * 1000;
        const searchEndTs = endTs ?? now;

        const localResults = await Promise.all(
          encryptedRoomIds.map((roomId) =>
            searchEncryptedRoom(mx, roomId, term, searchStartTs, searchEndTs, onProgress)
          )
        );
        const merged = localResults.flat();
        allGroups.push(...localResultsToGroups(merged));
        allHighlights.push(term);
      }

      // Server-side search for unencrypted rooms (or all rooms if none specified)
      if (unencryptedRoomIds.length > 0 || !rooms) {
        const limit = 20;
        const requestBody: ISearchRequestBody = {
          search_categories: {
            room_events: {
              event_context: {
                before_limit: 0,
                after_limit: 0,
                include_profile: false,
              },
              filter: {
                limit,
                rooms: rooms ? unencryptedRoomIds : undefined,
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
        const parsed = parseSearchResult(r);
        allGroups.push(...parsed.groups);
        allHighlights.push(...parsed.highlights);
        serverNextToken = parsed.nextToken;
      }

      // Sort items within each group by timestamp
      for (const group of allGroups) {
        if (order === 'oldest') {
          group.items.sort((a, b) => a.event.origin_server_ts - b.event.origin_server_ts);
        } else {
          group.items.sort((a, b) => b.event.origin_server_ts - a.event.origin_server_ts);
        }
      }

      return {
        nextToken: serverNextToken,
        highlights: [...new Set(allHighlights)],
        groups: allGroups,
      };
    },
    [mx, term, order, rooms, senders, startTs, endTs, onProgress]
  );

  return searchMessages;
};
