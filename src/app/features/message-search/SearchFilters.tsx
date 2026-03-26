import React, {
  ChangeEventHandler,
  MouseEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Box,
  Chip,
  Text,
  Icon,
  Icons,
  Line,
  config,
  PopOut,
  Menu,
  MenuItem,
  Header,
  toRem,
  Scroll,
  Button,
  Input,
  Badge,
  RectCords,
} from 'folds';
import { SearchOrderBy } from 'matrix-js-sdk';
import FocusTrap from 'focus-trap-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getMemberDisplayName, joinRuleToIconSrc } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';
import { factoryRoomIdByAtoZ } from '../../utils/sort';
import {
  SearchItemStrGetter,
  UseAsyncSearchOptions,
  useAsyncSearch,
} from '../../hooks/useAsyncSearch';
import { DebounceOptions, useDebounce } from '../../hooks/useDebounce';
import { VirtualTile } from '../../components/virtualizer';
import { stopPropagation } from '../../utils/keyboard';

type OrderButtonProps = {
  order?: string;
  onChange: (order?: string) => void;
};
const orderLabel = (order?: string): string => {
  if (order === 'oldest') return 'Oldest';
  return 'Newest';
};

function OrderButton({ order, onChange }: OrderButtonProps) {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const setOrder = (o?: string) => {
    setMenuAnchor(undefined);
    onChange(o);
  };
  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  return (
    <PopOut
      anchor={menuAnchor}
      align="End"
      position="Bottom"
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: () => setMenuAnchor(undefined),
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu variant="Surface">
            <Header size="300" variant="Surface" style={{ padding: `0 ${config.space.S300}` }}>
              <Text size="L400">Sort by</Text>
            </Header>
            <Line variant="Surface" size="300" />
            <div style={{ padding: config.space.S100 }}>
              <MenuItem
                onClick={() => setOrder()}
                variant="Surface"
                size="300"
                radii="300"
                aria-pressed={!order || order === SearchOrderBy.Recent}
              >
                <Text size="T300">Newest</Text>
              </MenuItem>
              <MenuItem
                onClick={() => setOrder('oldest')}
                variant="Surface"
                size="300"
                radii="300"
                aria-pressed={order === 'oldest'}
              >
                <Text size="T300">Oldest</Text>
              </MenuItem>
            </div>
          </Menu>
        </FocusTrap>
      }
    >
      <Chip
        variant="SurfaceVariant"
        radii="Pill"
        after={<Icon size="50" src={Icons.Sort} />}
        onClick={handleOpenMenu}
        style={{ minWidth: toRem(100) }}
      >
        <Text size="T200">{orderLabel(order)}</Text>
      </Chip>
    </PopOut>
  );
}

const SEARCH_OPTS: UseAsyncSearchOptions = {
  limit: 20,
  matchOptions: {
    contain: true,
  },
};
const SEARCH_DEBOUNCE_OPTS: DebounceOptions = {
  wait: 200,
};

type SelectRoomButtonProps = {
  roomList: string[];
  selectedRooms?: string[];
  onChange: (rooms?: string[]) => void;
};
function SelectRoomButton({ roomList, selectedRooms, onChange }: SelectRoomButtonProps) {
  const mx = useMatrixClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const [localSelected, setLocalSelected] = useState(selectedRooms);

  const getRoomNameStr: SearchItemStrGetter<string> = useCallback(
    (rId) => mx.getRoom(rId)?.name ?? rId,
    [mx]
  );

  const [searchResult, _searchRoom, resetSearch] = useAsyncSearch(
    roomList,
    getRoomNameStr,
    SEARCH_OPTS
  );
  const rooms = Array.from(searchResult?.items ?? roomList).sort(factoryRoomIdByAtoZ(mx));

  const virtualizer = useVirtualizer({
    count: rooms.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 5,
  });
  const vItems = virtualizer.getVirtualItems();

  const searchRoom = useDebounce(_searchRoom, SEARCH_DEBOUNCE_OPTS);
  const handleSearchChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    const value = evt.currentTarget.value.trim();
    if (!value) {
      resetSearch();
      return;
    }
    searchRoom(value);
  };

  const handleRoomClick: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const roomId = evt.currentTarget.getAttribute('data-room-id');
    if (!roomId) return;
    if (localSelected?.includes(roomId)) {
      setLocalSelected(localSelected?.filter((rId) => rId !== roomId));
      return;
    }
    const addedRooms = [...(localSelected ?? [])];
    addedRooms.push(roomId);
    setLocalSelected(addedRooms);
  };

  const handleSave = () => {
    setMenuAnchor(undefined);
    onChange(localSelected);
  };

  const handleDeselectAll = () => {
    setMenuAnchor(undefined);
    onChange(undefined);
  };

  useEffect(() => {
    setLocalSelected(selectedRooms);
    resetSearch();
  }, [menuAnchor, selectedRooms, resetSearch]);

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  return (
    <PopOut
      anchor={menuAnchor}
      align="Center"
      position="Bottom"
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: () => setMenuAnchor(undefined),
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu variant="Surface" style={{ width: toRem(250) }}>
            <Box direction="Column" style={{ maxHeight: toRem(450), maxWidth: toRem(300) }}>
              <Box
                shrink="No"
                direction="Column"
                gap="100"
                style={{ padding: config.space.S200, paddingBottom: 0 }}
              >
                <Text size="L400">Search</Text>
                <Input
                  onChange={handleSearchChange}
                  size="300"
                  radii="300"
                  after={
                    searchResult && searchResult.items.length > 0 ? (
                      <Badge variant="Secondary" size="400" radii="Pill">
                        <Text size="L400">{searchResult.items.length}</Text>
                      </Badge>
                    ) : null
                  }
                />
              </Box>
              <Scroll ref={scrollRef} size="300" hideTrack>
                <Box
                  direction="Column"
                  gap="100"
                  style={{
                    padding: config.space.S200,
                    paddingRight: 0,
                  }}
                >
                  {!searchResult && <Text size="L400">Rooms</Text>}
                  {searchResult && <Text size="L400">{`Rooms for "${searchResult.query}"`}</Text>}
                  {searchResult && searchResult.items.length === 0 && (
                    <Text style={{ padding: config.space.S400 }} size="T300" align="Center">
                      No match found!
                    </Text>
                  )}
                  <div
                    style={{
                      position: 'relative',
                      height: virtualizer.getTotalSize(),
                    }}
                  >
                    {vItems.map((vItem) => {
                      const roomId = rooms[vItem.index];
                      const room = mx.getRoom(roomId);
                      if (!room) return null;
                      const selected = localSelected?.includes(roomId);

                      return (
                        <VirtualTile
                          virtualItem={vItem}
                          style={{ paddingBottom: config.space.S100 }}
                          ref={virtualizer.measureElement}
                          key={vItem.index}
                        >
                          <MenuItem
                            data-room-id={roomId}
                            onClick={handleRoomClick}
                            variant={selected ? 'Primary' : 'Surface'}
                            size="300"
                            radii="300"
                            aria-pressed={selected}
                            before={
                              <Icon
                                size="50"
                                src={
                                  joinRuleToIconSrc(Icons, room.getJoinRule(), false) ?? Icons.Hash
                                }
                              />
                            }
                          >
                            <Text truncate size="T300">
                              {room.name}
                            </Text>
                          </MenuItem>
                        </VirtualTile>
                      );
                    })}
                  </div>
                </Box>
              </Scroll>
              <Line variant="Surface" size="300" />
              <Box shrink="No" direction="Column" gap="100" style={{ padding: config.space.S200 }}>
                <Button size="300" variant="Secondary" radii="300" onClick={handleSave}>
                  {localSelected && localSelected.length > 0 ? (
                    <Text size="B300">Save ({localSelected.length})</Text>
                  ) : (
                    <Text size="B300">Save</Text>
                  )}
                </Button>
                <Button
                  size="300"
                  radii="300"
                  variant="Secondary"
                  fill="Soft"
                  onClick={handleDeselectAll}
                  disabled={!localSelected || localSelected.length === 0}
                >
                  <Text size="B300">Deselect All</Text>
                </Button>
              </Box>
            </Box>
          </Menu>
        </FocusTrap>
      }
    >
      <Chip
        onClick={handleOpenMenu}
        variant="SurfaceVariant"
        radii="Pill"
        before={<Icon size="100" src={Icons.PlusCircle} />}
      >
        <Text size="T200">Select Rooms</Text>
      </Chip>
    </PopOut>
  );
}

const toDateInputValue = (ts: number): string => {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const RANGE_PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
] as const;

const getEndOfDay = (): number => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

const getStartOfDaysAgo = (days: number): number => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const matchesPreset = (startTs: number, endTs: number, days: number): boolean => {
  const expectedStart = getStartOfDaysAgo(days);
  const expectedEnd = getEndOfDay();
  return Math.abs(startTs - expectedStart) < 60000 && Math.abs(endTs - expectedEnd) < 60000;
};

type DateRangeButtonProps = {
  startTs: number;
  endTs: number;
  onStartTsChange: (ts: number) => void;
  onEndTsChange: (ts: number) => void;
};
function DateRangeButton({ startTs, endTs, onStartTsChange, onEndTsChange }: DateRangeButtonProps) {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const [localStart, setLocalStart] = useState(startTs);
  const [localEnd, setLocalEnd] = useState(endTs);

  const activePreset = RANGE_PRESETS.find((p) => matchesPreset(startTs, endTs, p.days));

  const handlePreset = (days: number) => {
    onStartTsChange(getStartOfDaysAgo(days));
    onEndTsChange(getEndOfDay());
  };

  const handleOpenCustom: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setLocalStart(startTs);
    setLocalEnd(endTs);
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  const handleDone = () => {
    onStartTsChange(localStart);
    onEndTsChange(localEnd);
    setMenuAnchor(undefined);
  };

  return (
    <>
      {RANGE_PRESETS.map((preset) => {
        const active = activePreset?.days === preset.days;
        return (
          <Chip
            key={preset.days}
            variant={active ? 'Primary' : 'Surface'}
            aria-pressed={active}
            before={active && <Icon size="100" src={Icons.Check} />}
            outlined
            onClick={() => handlePreset(preset.days)}
          >
            <Text size="T200">{preset.label}</Text>
          </Chip>
        );
      })}
      <PopOut
        anchor={menuAnchor}
        align="End"
        position="Bottom"
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setMenuAnchor(undefined),
              clickOutsideDeactivates: true,
              escapeDeactivates: stopPropagation,
            }}
          >
            <Menu variant="Surface">
              <Box direction="Column" gap="200" style={{ padding: config.space.S300 }}>
                <Text size="L400">Custom Range</Text>
                <Box gap="200" alignItems="Center">
                  <Box direction="Column" gap="100">
                    <Text size="T200">From</Text>
                    <Input
                      type="date"
                      size="300"
                      radii="300"
                      max={toDateInputValue(localEnd)}
                      value={toDateInputValue(localStart)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const [y, m, d] = e.target.value.split('-').map(Number);
                        const ts = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
                        if (!Number.isNaN(ts)) setLocalStart(ts);
                      }}
                      style={{ width: toRem(150) }}
                    />
                  </Box>
                  <Box direction="Column" gap="100">
                    <Text size="T200">To</Text>
                    <Input
                      type="date"
                      size="300"
                      radii="300"
                      min={toDateInputValue(localStart)}
                      max={toDateInputValue(Date.now())}
                      value={toDateInputValue(localEnd)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const [y, m, dy] = e.target.value.split('-').map(Number);
                        const ts = new Date(y, m - 1, dy, 23, 59, 59, 999).getTime();
                        if (!Number.isNaN(ts)) setLocalEnd(ts);
                      }}
                      style={{ width: toRem(150) }}
                    />
                  </Box>
                </Box>
                <Button
                  size="300"
                  variant="Secondary"
                  radii="300"
                  onClick={handleDone}
                >
                  <Text size="B300">Done</Text>
                </Button>
              </Box>
            </Menu>
          </FocusTrap>
        }
      >
        <Chip
          variant={!activePreset ? 'Primary' : 'Surface'}
          aria-pressed={!activePreset}
          before={!activePreset && <Icon size="100" src={Icons.Check} />}
          outlined
          onClick={handleOpenCustom}
        >
          <Text size="T200">
            {!activePreset
              ? `${new Date(startTs).toLocaleDateString()} to ${new Date(endTs).toLocaleDateString()}`
              : 'Custom'}
          </Text>
        </Chip>
      </PopOut>
    </>
  );
}

type SearchFiltersProps = {
  defaultRoomsFilterName: string;
  allowGlobal?: boolean;
  roomList: string[];
  selectedRooms?: string[];
  onSelectedRoomsChange: (selectedRooms?: string[]) => void;
  selectedSenders?: string[];
  onSenderRemove?: (userId: string) => void;
  selectedHasTypes?: string[];
  onHasRemove?: (hasType: string) => void;
  global?: boolean;
  onGlobalChange: (global?: boolean) => void;
  order?: string;
  onOrderChange: (order?: string) => void;
  hasEncryptedRooms?: boolean;
  startTs?: number;
  endTs?: number;
  onStartTsChange?: (ts: number) => void;
  onEndTsChange?: (ts: number) => void;
};

export function SearchFilters({
  defaultRoomsFilterName,
  allowGlobal,
  roomList,
  selectedRooms,
  onSelectedRoomsChange,
  selectedSenders,
  onSenderRemove,
  selectedHasTypes,
  onHasRemove,
  global,
  order,
  onGlobalChange,
  onOrderChange,
  hasEncryptedRooms,
  startTs,
  endTs,
  onStartTsChange,
  onEndTsChange,
}: SearchFiltersProps) {
  const mx = useMatrixClient();

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Filter</Text>
      <Box gap="200" wrap="Wrap" alignItems="Center">
        <Chip
          variant={!global ? 'Primary' : 'Surface'}
          aria-pressed={!global}
          before={!global && <Icon size="100" src={Icons.Check} />}
          outlined
          onClick={() => onGlobalChange()}
        >
          <Text size="T200">{defaultRoomsFilterName}</Text>
        </Chip>
        {/*allowGlobal && (
          <Chip
            variant={global ? 'Primary' : 'Surface'}
            aria-pressed={global}
            before={global && <Icon size="100" src={Icons.Check} />}
            outlined
            onClick={() => onGlobalChange(true)}
          >
            <Text size="T200">Global</Text>
          </Chip>
        )*/}
        <Line
          style={{ margin: `${config.space.S100} 0` }}
          direction="Vertical"
          variant="Surface"
          size="300"
        />
        {selectedRooms?.map((roomId) => {
          const room = mx.getRoom(roomId);
          if (!room) return null;

          return (
            <Chip
              key={roomId}
              variant="Primary"
              onClick={() => onSelectedRoomsChange(selectedRooms.filter((rId) => rId !== roomId))}
              radii="Pill"
              before={
                <Icon
                  size="50"
                  src={joinRuleToIconSrc(Icons, room.getJoinRule(), false) ?? Icons.Hash}
                />
              }
              after={<Icon size="50" src={Icons.Cross} />}
            >
              <Text size="T200">{room.name}</Text>
            </Chip>
          );
        })}
        <SelectRoomButton
          roomList={roomList}
          selectedRooms={selectedRooms}
          onChange={onSelectedRoomsChange}
        />
        <Box grow="Yes" data-spacing-node />
        {hasEncryptedRooms && startTs !== undefined && endTs !== undefined && onStartTsChange && onEndTsChange && (
          <>
            <DateRangeButton
              startTs={startTs}
              endTs={endTs}
              onStartTsChange={onStartTsChange}
              onEndTsChange={onEndTsChange}
            />
            <Line
              style={{ margin: `${config.space.S100} 0` }}
              direction="Vertical"
              variant="Surface"
              size="300"
            />
          </>
        )}
        <OrderButton order={order} onChange={onOrderChange} />
      </Box>
      {selectedSenders && selectedSenders.length > 0 && (
        <Box gap="200" wrap="Wrap" alignItems="Center">
          <Text size="T200" priority="300">From:</Text>
          {selectedSenders.map((userId) => {
            let displayName: string | undefined;
            for (const roomId of roomList) {
              const room = mx.getRoom(roomId);
              if (room) {
                displayName = getMemberDisplayName(room, userId);
                if (displayName) break;
              }
            }
            return (
              <Chip
                key={userId}
                variant="Primary"
                onClick={() => onSenderRemove?.(userId)}
                radii="Pill"
                before={<Icon size="50" src={Icons.User} />}
                after={<Icon size="50" src={Icons.Cross} />}
              >
                <Text size="T200">{displayName ?? getMxIdLocalPart(userId) ?? userId}</Text>
              </Chip>
            );
          })}
        </Box>
      )}
      {selectedHasTypes && selectedHasTypes.length > 0 && (
        <Box gap="200" wrap="Wrap" alignItems="Center">
          <Text size="T200" priority="300">Has:</Text>
          {selectedHasTypes.map((hasType) => {
            const iconMap: Record<string, string> = {
              image: Icons.Photo,
              video: Icons.Play,
              file: Icons.File,
            };
            const labelMap: Record<string, string> = {
              image: 'Image',
              video: 'Video',
              file: 'File',
            };
            return (
              <Chip
                key={hasType}
                variant="Primary"
                onClick={() => onHasRemove?.(hasType)}
                radii="Pill"
                before={<Icon size="50" src={iconMap[hasType] ?? Icons.File} />}
                after={<Icon size="50" src={Icons.Cross} />}
              >
                <Text size="T200">{labelMap[hasType] ?? hasType}</Text>
              </Chip>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
