import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { ResultGroup, localResultsToGroups, useServerSearch } from './useMessageSearch';
import { SearchResultGroup } from './SearchResultGroup';
import { SearchInput } from './SearchInput';
import { SearchFilters } from './SearchFilters';
import { VirtualTile } from '../../components/virtualizer';
import { streamSearchEncryptedRoom, wasMessageCapExceeded } from '../../services/localSearch';

const hasItems = (arr?: unknown[]): boolean => arr != null && arr.length > 0;

const useSearchPathSearchParams = (searchParams: URLSearchParams): _SearchPathSearchParams =>
  useMemo(
    () => ({
      global: searchParams.get('global') ?? undefined,
      term: searchParams.get('term') ?? undefined,
      order: searchParams.get('order') ?? undefined,
      rooms: searchParams.get('rooms') ?? undefined,
      senders: searchParams.get('senders') ?? undefined,
      has: searchParams.get('has') ?? undefined,
    }),
    [searchParams]
  );

const DEFAULT_RANGE_DAYS = 7;

type StreamState = {
  groups: ResultGroup[];
  fetched: number;
  decrypted: number;
  isSearching: boolean;
};

const EMPTY_STREAM: StreamState = { groups: [], fetched: 0, decrypted: 0, isSearching: false };

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

  // Date range state — snapped to day boundaries for cache stability
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

  const searchParamRooms = useMemo(() => {
    if (searchPathSearchParams.rooms) {
      return decodeSearchParamValueArray(searchPathSearchParams.rooms).filter((rId) =>
        allRooms.includes(rId)
      );
    }
    return undefined;
  }, [allRooms, searchPathSearchParams.rooms]);

  const searchParamsSenders = useMemo(() => {
    if (searchPathSearchParams.senders) {
      return decodeSearchParamValueArray(searchPathSearchParams.senders);
    }
    return undefined;
  }, [searchPathSearchParams.senders]);

  const searchParamsHas = useMemo(() => {
    if (searchPathSearchParams.has) {
      return decodeSearchParamValueArray(searchPathSearchParams.has);
    }
    return undefined;
  }, [searchPathSearchParams.has]);

  const isGlobal = searchPathSearchParams.global === 'true';
  const effectiveRooms: string[] | undefined = searchParamRooms ?? (isGlobal ? undefined : rooms);
  const term = searchPathSearchParams.term;
  const order = searchPathSearchParams.order ?? SearchOrderBy.Recent;

  const hasActiveSearch =
    !!term || hasItems(searchParamsSenders) || hasItems(searchParamsHas);

  // Split effective rooms into encrypted / unencrypted
  const [encryptedRoomIds, unencryptedRoomIds] = useMemo(() => {
    if (!effectiveRooms) return [[], [] as string[]];
    const enc: string[] = [];
    const unenc: string[] = [];
    for (const roomId of effectiveRooms) {
      if (mx.getRoom(roomId)?.hasEncryptionStateEvent()) enc.push(roomId);
      else unenc.push(roomId);
    }
    return [enc, unenc];
  }, [mx, effectiveRooms]);

  // ── Streaming search for encrypted rooms ─────────────────────────────────

  const [streamState, setStreamState] = useState<StreamState>(EMPTY_STREAM);

  // Stable key that triggers a new stream when any search param changes
  const encryptedSearchKey = useMemo(
    () =>
      JSON.stringify({
        hasActiveSearch,
        term: term ?? '',
        rooms: encryptedRoomIds,
        senders: searchParamsSenders ?? [],
        hasTypes: searchParamsHas ?? [],
        startTs,
        endTs,
      }),
    [hasActiveSearch, term, encryptedRoomIds, searchParamsSenders, searchParamsHas, startTs, endTs]
  );

  useEffect(() => {
    if (!hasActiveSearch || encryptedRoomIds.length === 0) {
      setStreamState(EMPTY_STREAM);
      return undefined;
    }

    let cancelled = false;

    setStreamState({ groups: [], fetched: 0, decrypted: 0, isSearching: true });

    const run = async () => {
      const roomPromises = encryptedRoomIds.map(async (roomId) => {
        for await (const chunk of streamSearchEncryptedRoom(
          mx,
          roomId,
          term ?? '',
          startTs,
          endTs,
          searchParamsSenders,
          searchParamsHas ?? undefined
        )) {
          if (cancelled) break;
          setStreamState((prev) => {
            const otherGroups = prev.groups.filter((g) => g.roomId !== roomId);
            const newGroups =
              chunk.results.length > 0
                ? [...otherGroups, ...localResultsToGroups(chunk.results)]
                : otherGroups;
            return {
              groups: newGroups,
              fetched: prev.fetched + chunk.fetched,
              decrypted: prev.decrypted + chunk.decrypted,
              isSearching: true,
            };
          });
        }
      });

      await Promise.all(roomPromises);

      if (!cancelled) {
        setStreamState((prev) => ({ ...prev, isSearching: false }));
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encryptedSearchKey]);

  // ── Server search for unencrypted rooms (or global) ──────────────────────

  const serverSearchParams = useMemo(
    () => ({
      term,
      order,
      rooms: effectiveRooms ? unencryptedRoomIds : undefined,
      senders: searchParamsSenders,
    }),
    [term, order, effectiveRooms, unencryptedRoomIds, searchParamsSenders]
  );

  const serverSearch = useServerSearch(serverSearchParams);

  const runServerSearch = useCallback(
    async ({ pageParam }: { pageParam: string }) => serverSearch(pageParam),
    [serverSearch]
  );

  const serverEnabled =
    !!term && (unencryptedRoomIds.length > 0 || !effectiveRooms);

  const {
    status: serverStatus,
    data: serverData,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    enabled: serverEnabled,
    queryKey: ['server-search', serverSearchParams],
    queryFn: runServerSearch,
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextToken,
  });

  const serverHighlights = useMemo(() => {
    const mixed = serverData?.pages.flatMap((p) => p.highlights);
    return Array.from(new Set(mixed));
  }, [serverData]);

  // ── Combined results ──────────────────────────────────────────────────────

  const groups = useMemo(() => {
    const serverGroups = serverData?.pages.flatMap((p) => p.groups) ?? [];
    const combined = [
      ...streamState.groups.map((g) => ({ ...g, items: [...g.items] })),
      ...serverGroups,
    ];
    // Sort items within each group by timestamp
    for (const group of combined) {
      if (order === 'oldest') {
        group.items.sort((a, b) => a.event.origin_server_ts - b.event.origin_server_ts);
      } else {
        group.items.sort((a, b) => b.event.origin_server_ts - a.event.origin_server_ts);
      }
    }
    return combined;
  }, [streamState.groups, serverData, order]);

  const highlights = useMemo(() => {
    const h: string[] = [...serverHighlights];
    if (term) h.push(term);
    return Array.from(new Set(h));
  }, [serverHighlights, term]);

  // ── Virtualizer ───────────────────────────────────────────────────────────

  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 1,
  });
  const vItems = virtualizer.getVirtualItems();

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

  // ── UI event handlers ─────────────────────────────────────────────────────

  const handleSearch = (t: string) => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.delete('term');
      newParams.append('term', t);
      return newParams;
    });
  };

  const handleSearchClear = () => {
    if (searchInputRef.current) searchInputRef.current.value = '';
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
      if (global) newParams.append('global', 'true');
      return newParams;
    });
  };

  const handleOrderChange = (o?: string) => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.delete('order');
      if (o) newParams.append('order', o);
      return newParams;
    });
  };

  const handleSenderAdd = useCallback(
    (userId: string) => {
      setSearchParams((prevParams) => {
        const newParams = new URLSearchParams(prevParams);
        const current = newParams.get('senders');
        const list = current ? decodeSearchParamValueArray(current) : [];
        if (!list.includes(userId)) list.push(userId);
        newParams.set('senders', encodeSearchParamValueArray(list));
        if (!newParams.has('term')) newParams.set('term', '');
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
        if (filtered.length > 0) newParams.set('senders', encodeSearchParamValueArray(filtered));
        else newParams.delete('senders');
        return newParams;
      });
    },
    [setSearchParams]
  );

  const handleHasAdd = useCallback(
    (hasType: string) => {
      setSearchParams((prevParams) => {
        const newParams = new URLSearchParams(prevParams);
        const current = newParams.get('has');
        const list = current ? decodeSearchParamValueArray(current) : [];
        if (!list.includes(hasType)) list.push(hasType);
        newParams.set('has', encodeSearchParamValueArray(list));
        if (!newParams.has('term')) newParams.set('term', '');
        return newParams;
      });
    },
    [setSearchParams]
  );

  const handleHasRemove = useCallback(
    (hasType: string) => {
      setSearchParams((prevParams) => {
        const newParams = new URLSearchParams(prevParams);
        const current = newParams.get('has');
        const list = current ? decodeSearchParamValueArray(current) : [];
        const filtered = list.filter((h) => h !== hasType);
        if (filtered.length > 0) newParams.set('has', encodeSearchParamValueArray(filtered));
        else newParams.delete('has');
        return newParams;
      });
    },
    [setSearchParams]
  );

  const searchMembers = useMemo(() => {
    const roomIds = isGlobal ? allRooms : rooms;
    const memberMap = new Map<string, RoomMember>();
    for (const roomId of roomIds) {
      const room = mx.getRoom(roomId);
      if (!room) continue;
      for (const member of room.getJoinedMembers()) {
        if (!memberMap.has(member.userId)) memberMap.set(member.userId, member);
      }
    }
    return Array.from(memberMap.values());
  }, [mx, isGlobal, allRooms, rooms]);

  // Derived states
  const isStreaming = streamState.isSearching;
  const hasEncryptedRooms = encryptedRoomIds.length > 0;
  const isLoading =
    hasActiveSearch &&
    groups.length === 0 &&
    (isStreaming || (serverEnabled && serverStatus === 'pending'));

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
          active={!!term || hasItems(searchParamsSenders) || hasItems(searchParamsHas)}
          loading={serverEnabled && serverStatus === 'pending' && !serverData}
          searchInputRef={searchInputRef}
          onSearch={handleSearch}
          onReset={handleSearchClear}
          members={searchMembers}
          onSenderAdd={handleSenderAdd}
          onHasAdd={handleHasAdd}
          hasFilters={hasItems(searchParamsSenders) || hasItems(searchParamsHas)}
          selectedHasTypes={searchParamsHas}
        />
        <SearchFilters
          defaultRoomsFilterName={defaultRoomsFilterName}
          allowGlobal={allowGlobal}
          roomList={isGlobal ? allRooms : rooms}
          selectedRooms={searchParamRooms}
          onSelectedRoomsChange={handleSelectedRoomsChange}
          selectedSenders={searchParamsSenders}
          onSenderRemove={handleSenderRemove}
          selectedHasTypes={searchParamsHas}
          onHasRemove={handleHasRemove}
          global={isGlobal}
          onGlobalChange={handleGlobalChange}
          order={order}
          onOrderChange={handleOrderChange}
          hasEncryptedRooms={hasEncryptedRooms}
          startTs={startTs}
          endTs={endTs}
          onStartTsChange={setStartTs}
          onEndTsChange={setEndTs}
        />
      </Box>

      {/* Aggregate streaming progress */}
      {isStreaming && (
        <Box alignItems="Center" gap="200">
          <Spinner size="200" variant="Secondary" />
          <Text size="T300" priority="300">
            {streamState.fetched > 0
              ? `${streamState.fetched.toLocaleString()} events fetched · ${streamState.decrypted.toLocaleString()} messages decrypted`
              : 'Searching encrypted rooms…'}
          </Text>
        </Box>
      )}

      {!hasActiveSearch && (
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

      {hasEncryptedRooms && !isStreaming && wasMessageCapExceeded() && (
        <Box
          className={ContainerColor({ variant: 'Warning' })}
          style={{ padding: config.space.S300, borderRadius: config.radii.R400 }}
          alignItems="Center"
          gap="200"
        >
          <Icon size="200" src={Icons.Info} />
          <Text size="T300">
            The message limit was reached and older messages have been removed from the search. Try
            narrowing the date range for more complete results.
          </Text>
        </Box>
      )}

      {hasActiveSearch && groups.length === 0 && !isLoading && !isStreaming && (
        <Box
          className={ContainerColor({ variant: 'Warning' })}
          style={{ padding: config.space.S300, borderRadius: config.radii.R400 }}
          alignItems="Center"
          gap="200"
        >
          <Icon size="200" src={Icons.Info} />
          <Text>
            No results found{term ? <> for <b>{`"${term}"`}</b></> : null}
          </Text>
        </Box>
      )}

      {isLoading && (
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
              {term ? ` for "${term}"` : ''}
              {isStreaming ? ' so far…' : ''}
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
