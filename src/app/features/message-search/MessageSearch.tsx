import React, { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RoomMember } from 'matrix-js-sdk';
import { Text, Box, Icon, Icons, config, Spinner, IconButton, Line, toRem } from 'folds';
import { useAtomValue } from 'jotai';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { SearchOrderBy } from 'matrix-js-sdk';
import { PageHero, PageHeroEmpty, PageHeroSection } from '../../components/page';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { _SearchPathSearchParams } from '../../pages/paths';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { SequenceCard } from '../../components/sequence-card';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { ScrollTopContainer } from '../../components/scroll-top-container';
import { ContainerColor } from '../../styles/ContainerColor.css';
import { decodeSearchParamValueArray, encodeSearchParamValueArray } from '../../pages/pathUtils';
import { useRooms } from '../../state/hooks/roomList';
import { allRoomsAtom } from '../../state/room-list/roomList';
import { mDirectAtom } from '../../state/mDirectList';
import { MessageSearchParams, useMessageSearch } from './useMessageSearch';
import { SearchResultGroup } from './SearchResultGroup';
import { SearchInput } from './SearchInput';
import { SearchFilters } from './SearchFilters';
import { VirtualTile } from '../../components/virtualizer';
import { FetchProgress, wasMessageCapExceeded } from '../../services/localSearch';

const useSearchPathSearchParams = (searchParams: URLSearchParams): _SearchPathSearchParams =>
  useMemo(
    () => ({
      global: searchParams.get('global') ?? undefined,
      term: searchParams.get('term') ?? undefined,
      order: searchParams.get('order') ?? undefined,
      rooms: searchParams.get('rooms') ?? undefined,
      senders: searchParams.get('senders') ?? undefined,
    }),
    [searchParams]
  );

const DEFAULT_RANGE_DAYS = 7;

type MessageSearchProps = {
  defaultRoomsFilterName: string;
  allowGlobal?: boolean;
  rooms: string[];
  senders?: string[];
  scrollRef: RefObject<HTMLDivElement>;
};
export function MessageSearch({
  defaultRoomsFilterName,
  allowGlobal,
  rooms,
  senders,
  scrollRef,
}: MessageSearchProps) {
  const mx = useMatrixClient();
  const mDirects = useAtomValue(mDirectAtom);
  const allRooms = useRooms(mx, allRoomsAtom, mDirects);
  const [mediaAutoLoad] = useSetting(settingsAtom, 'mediaAutoLoad');
  const [legacyUsernameColor] = useSetting(settingsAtom, 'legacyUsernameColor');

  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [dateFormatString] = useSetting(settingsAtom, 'dateFormatString');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollTopAnchorRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchPathSearchParams = useSearchPathSearchParams(searchParams);
  const { navigateRoom } = useRoomNavigate();

  // Date range state for encrypted room search
  // Snap to day boundaries so timestamps are stable across remounts (cache-friendly)
  const [defaultStartTs, defaultEndTs] = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - DEFAULT_RANGE_DAYS);
    start.setHours(0, 0, 0, 0);
    return [start.getTime(), end.getTime()];
  }, []);
  const [startTs, setStartTs] = useState<number>(defaultStartTs);
  const [endTs, setEndTs] = useState<number>(defaultEndTs);
  const [fetchProgress, setFetchProgress] = useState<FetchProgress | null>(null);

  const onProgress = useCallback((progress: FetchProgress) => {
    setFetchProgress(progress);
  }, []);

  const searchParamRooms = useMemo(() => {
    if (searchPathSearchParams.rooms) {
      const joinedRoomIds = decodeSearchParamValueArray(searchPathSearchParams.rooms).filter(
        (rId) => allRooms.includes(rId)
      );
      return joinedRoomIds;
    }
    return undefined;
  }, [allRooms, searchPathSearchParams.rooms]);
  const searchParamsSenders = useMemo(() => {
    if (searchPathSearchParams.senders) {
      return decodeSearchParamValueArray(searchPathSearchParams.senders);
    }
    return undefined;
  }, [searchPathSearchParams.senders]);

  const msgSearchParams: MessageSearchParams = useMemo(() => {
    const isGlobal = searchPathSearchParams.global === 'true';
    const defaultRooms = isGlobal ? undefined : rooms;
    const effectiveRooms = searchParamRooms ?? defaultRooms;

    return {
      term: searchPathSearchParams.term,
      order: searchPathSearchParams.order ?? SearchOrderBy.Recent,
      rooms: effectiveRooms,
      senders: searchParamsSenders ?? senders,
      startTs,
      endTs,
      onProgress,
    };
  }, [searchPathSearchParams, searchParamRooms, searchParamsSenders, rooms, senders, startTs, endTs, onProgress]);

  // Detect if any rooms in the current search set are encrypted
  const hasEncryptedRooms = useMemo(() => {
    const roomIds = msgSearchParams.rooms;
    if (!roomIds) return false;
    return roomIds.some((roomId) => {
      const room = mx.getRoom(roomId);
      return room?.hasEncryptionStateEvent();
    });
  }, [mx, msgSearchParams.rooms]);

  const searchMembers = useMemo(() => {
    const roomIds = searchPathSearchParams.global === 'true' ? allRooms : rooms;
    const memberMap = new Map<string, RoomMember>();
    for (const roomId of roomIds) {
      const room = mx.getRoom(roomId);
      if (!room) continue;
      for (const member of room.getJoinedMembers()) {
        if (!memberMap.has(member.userId)) {
          memberMap.set(member.userId, member);
        }
      }
    }
    return Array.from(memberMap.values());
  }, [mx, searchPathSearchParams.global, allRooms, rooms]);

  const handleSenderAdd = useCallback(
    (userId: string) => {
      setSearchParams((prevParams) => {
        const newParams = new URLSearchParams(prevParams);
        const current = newParams.get('senders');
        const list = current ? decodeSearchParamValueArray(current) : [];
        if (!list.includes(userId)) {
          list.push(userId);
        }
        newParams.set('senders', encodeSearchParamValueArray(list));
        if (!newParams.has('term')) {
          newParams.set('term', '');
        }
        return newParams;
      });
    },
    [setSearchParams]
  );

  const handleSenderRemove = useCallback(
    (userId: string) => {
      setSearchParams((prevParams) => {
        const newParams = new URLSearchParams(prevParams);
        const current = newParams.get('senders');
        const list = current ? decodeSearchParamValueArray(current) : [];
        const filtered = list.filter((s) => s !== userId);
        if (filtered.length > 0) {
          newParams.set('senders', encodeSearchParamValueArray(filtered));
        } else {
          newParams.delete('senders');
        }
        return newParams;
      });
    },
    [setSearchParams]
  );

  const searchMessages = useMessageSearch(msgSearchParams);

  const { status, data, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    enabled: !!msgSearchParams.term || !!(msgSearchParams.senders && msgSearchParams.senders.length > 0),
    queryKey: [
      'search',
      msgSearchParams.term,
      msgSearchParams.order,
      msgSearchParams.rooms,
      msgSearchParams.senders,
      hasEncryptedRooms ? startTs : undefined,
      hasEncryptedRooms ? endTs : undefined,
    ],
    queryFn: async ({ pageParam }) => {
      setFetchProgress(null);
      const result = await searchMessages(pageParam);
      setFetchProgress(null);
      return result;
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextToken,
  });

  const groups = useMemo(() => data?.pages.flatMap((result) => result.groups) ?? [], [data]);
  const highlights = useMemo(() => {
    const mixed = data?.pages.flatMap((result) => result.highlights);
    return Array.from(new Set(mixed));
  }, [data]);

  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 1,
  });
  const vItems = virtualizer.getVirtualItems();

  const handleSearch = (term: string) => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.delete('term');
      newParams.append('term', term);
      return newParams;
    });
  };
  const handleSearchClear = () => {
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.delete('term');
      return newParams;
    });
  };

  const handleSelectedRoomsChange = (selectedRooms?: string[]) => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.delete('rooms');
      if (selectedRooms && selectedRooms.length > 0) {
        newParams.append('rooms', encodeSearchParamValueArray(selectedRooms));
      }
      return newParams;
    });
  };
  const handleGlobalChange = (global?: boolean) => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.delete('global');
      if (global) {
        newParams.append('global', 'true');
      }
      return newParams;
    });
  };

  const handleOrderChange = (order?: string) => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.delete('order');
      if (order) {
        newParams.append('order', order);
      }
      return newParams;
    });
  };

  const lastVItem = vItems[vItems.length - 1];
  const lastVItemIndex: number | undefined = lastVItem?.index;
  const lastGroupIndex = groups.length - 1;
  useEffect(() => {
    if (
      lastGroupIndex > -1 &&
      lastGroupIndex === lastVItemIndex &&
      !isFetchingNextPage &&
      hasNextPage
    ) {
      fetchNextPage();
    }
  }, [lastVItemIndex, lastGroupIndex, fetchNextPage, isFetchingNextPage, hasNextPage]);

  return (
    <Box direction="Column" gap="700">
      <ScrollTopContainer scrollRef={scrollRef} anchorRef={scrollTopAnchorRef}>
        <IconButton
          onClick={() => virtualizer.scrollToOffset(0)}
          variant="SurfaceVariant"
          radii="Pill"
          outlined
          size="300"
          aria-label="Scroll to Top"
        >
          <Icon src={Icons.ChevronTop} size="300" />
        </IconButton>
      </ScrollTopContainer>
      <Box ref={scrollTopAnchorRef} direction="Column" gap="300">
        <SearchInput
          active={!!msgSearchParams.term || !!(searchParamsSenders && searchParamsSenders.length > 0)}
          loading={status === 'pending'}
          searchInputRef={searchInputRef}
          onSearch={handleSearch}
          onReset={handleSearchClear}
          members={searchMembers}
          onSenderAdd={handleSenderAdd}
          hasSenders={!!searchParamsSenders && searchParamsSenders.length > 0}
        />
        <SearchFilters
          defaultRoomsFilterName={defaultRoomsFilterName}
          allowGlobal={allowGlobal}
          roomList={searchPathSearchParams.global === 'true' ? allRooms : rooms}
          selectedRooms={searchParamRooms}
          onSelectedRoomsChange={handleSelectedRoomsChange}
          selectedSenders={searchParamsSenders}
          onSenderRemove={handleSenderRemove}
          global={searchPathSearchParams.global === 'true'}
          onGlobalChange={handleGlobalChange}
          order={msgSearchParams.order}
          onOrderChange={handleOrderChange}
          hasEncryptedRooms={hasEncryptedRooms}
          startTs={startTs}
          endTs={endTs}
          onStartTsChange={setStartTs}
          onEndTsChange={setEndTs}
        />
      </Box>

      {fetchProgress && (
        <Box
          className={ContainerColor({ variant: 'SurfaceVariant' })}
          style={{ padding: config.space.S300, borderRadius: config.radii.R400 }}
          alignItems="Center"
          gap="200"
        >
          <Spinner size="200" variant="Secondary" />
          <Text size="T300">
            {fetchProgress.decrypting
              ? `Decrypting ${fetchProgress.fetched} messages...`
              : `Fetching messages... (${fetchProgress.fetched} so far)`}
          </Text>
        </Box>
      )}

      {!msgSearchParams.term && !(msgSearchParams.senders && msgSearchParams.senders.length > 0) && status === 'pending' && (
        <PageHeroEmpty>
          <PageHeroSection>
            <PageHero
              icon={<Icon size="600" src={Icons.Message} />}
              title="Search Messages"
              subTitle="Find helpful messages in your community by searching with related keywords."
            />
          </PageHeroSection>
        </PageHeroEmpty>
      )}

      {hasEncryptedRooms && status === 'success' && wasMessageCapExceeded() && (
        <Box
          className={ContainerColor({ variant: 'Warning' })}
          style={{ padding: config.space.S300, borderRadius: config.radii.R400 }}
          alignItems="Center"
          gap="200"
        >
          <Icon size="200" src={Icons.Info} />
          <Text size="T300">
            The message limit was reached and older messages have been removed from the search. Try narrowing the date range for more complete results.
          </Text>
        </Box>
      )}

      {(msgSearchParams.term || (msgSearchParams.senders && msgSearchParams.senders.length > 0)) && groups.length === 0 && status === 'success' && (
        <Box
          className={ContainerColor({ variant: 'Warning' })}
          style={{ padding: config.space.S300, borderRadius: config.radii.R400 }}
          alignItems="Center"
          gap="200"
        >
          <Icon size="200" src={Icons.Info} />
          <Text>
            No results found{msgSearchParams.term ? <> for <b>{`"${msgSearchParams.term}"`}</b></> : null}
          </Text>
        </Box>
      )}

      {(((msgSearchParams.term || (msgSearchParams.senders && msgSearchParams.senders.length > 0)) && status === 'pending') ||
        (groups.length > 0 && vItems.length === 0)) && (
        <Box direction="Column" gap="100">
          {[...Array(8).keys()].map((key) => (
            <SequenceCard variant="SurfaceVariant" key={key} style={{ minHeight: toRem(80) }} />
          ))}
        </Box>
      )}

      {vItems.length > 0 && (
        <Box direction="Column" gap="300">
          <Box direction="Column" gap="200">
            <Text size="H5">
              {`${groups.reduce((n, g) => n + g.items.length, 0)} results`}
              {msgSearchParams.term ? ` for "${msgSearchParams.term}"` : ''}
            </Text>
            <Line size="300" variant="Surface" />
          </Box>
          <div
            style={{
              position: 'relative',
              height: virtualizer.getTotalSize(),
            }}
          >
            {vItems.map((vItem) => {
              const group = groups[vItem.index];
              if (!group) return null;
              const groupRoom = mx.getRoom(group.roomId);
              if (!groupRoom) return null;

              return (
                <VirtualTile
                  virtualItem={vItem}
                  style={{ paddingBottom: config.space.S500 }}
                  ref={virtualizer.measureElement}
                  key={vItem.index}
                >
                  <SearchResultGroup
                    room={groupRoom}
                    highlights={highlights}
                    items={group.items}
                    mediaAutoLoad={mediaAutoLoad}
                    onOpen={navigateRoom}
                    legacyUsernameColor={legacyUsernameColor || mDirects.has(groupRoom.roomId)}
                    hour24Clock={hour24Clock}
                    dateFormatString={dateFormatString}
                  />
                </VirtualTile>
              );
            })}
          </div>
          {isFetchingNextPage && (
            <Box justifyContent="Center" alignItems="Center">
              <Spinner size="600" variant="Secondary" />
            </Box>
          )}
        </Box>
      )}

      {error && (
        <Box
          className={ContainerColor({ variant: 'Critical' })}
          style={{
            padding: config.space.S300,
            borderRadius: config.radii.R400,
          }}
          direction="Column"
          gap="200"
        >
          <Text size="L400">{error.name}</Text>
          <Text size="T300">{error.message}</Text>
        </Box>
      )}
    </Box>
  );
}
