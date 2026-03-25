import React, {
  FormEventHandler,
  KeyboardEventHandler,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box, Text, Input, Icon, Icons, Spinner, Chip, config, Menu, MenuItem, toRem } from 'folds';
import { RoomMember } from 'matrix-js-sdk';
import { getMxIdLocalPart } from '../../utils/matrix';

type FromToken = {
  start: number;
  end: number;
  query: string;
};

const getFromToken = (value: string, cursorPos: number): FromToken | null => {
  const beforeCursor = value.substring(0, cursorPos);
  const match = beforeCursor.match(/from:(\S*)$/i);
  if (!match || match.index === undefined) return null;
  const start = match.index;
  const query = match[1];
  const afterCursor = value.substring(cursorPos);
  const spaceMatch = afterCursor.match(/^\S*/);
  const end = cursorPos + (spaceMatch ? spaceMatch[0].length : 0);
  return { start, end, query };
};

type SearchProps = {
  active?: boolean;
  loading?: boolean;
  searchInputRef: RefObject<HTMLInputElement>;
  onSearch: (term: string) => void;
  onReset: () => void;
  members?: RoomMember[];
  onSenderAdd?: (userId: string) => void;
  hasSenders?: boolean;
};

export function SearchInput({
  active,
  loading,
  searchInputRef,
  onSearch,
  onReset,
  members,
  onSenderAdd,
  hasSenders,
}: SearchProps) {
  const [fromToken, setFromToken] = useState<FromToken | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevQueryRef = useRef('');

  const suggestions = useMemo(() => {
    if (!fromToken || !members || members.length === 0) return [];
    const q = fromToken.query.toLowerCase();
    if (!q) return members.slice(0, 8);
    return members
      .filter((m) => {
        const displayName = (m.rawDisplayName ?? '').toLowerCase();
        const userId = m.userId.toLowerCase();
        const localPart = (getMxIdLocalPart(m.userId) ?? '').toLowerCase();
        return displayName.includes(q) || userId.includes(q) || localPart.includes(q);
      })
      .slice(0, 8);
  }, [fromToken, members]);

  const updateFromToken = useCallback(() => {
    const input = searchInputRef.current;
    if (!input) return;
    const cursorPos = input.selectionStart ?? input.value.length;
    const token = getFromToken(input.value, cursorPos);
    setFromToken(token);
    const newQuery = token?.query ?? '';
    if (newQuery !== prevQueryRef.current) {
      prevQueryRef.current = newQuery;
      setHighlightedIndex(0);
    }
  }, [searchInputRef]);

  const selectMember = useCallback(
    (member: RoomMember) => {
      const input = searchInputRef.current;
      if (!input || !fromToken || !onSenderAdd) return;

      const before = input.value.substring(0, fromToken.start);
      const after = input.value.substring(fromToken.end);
      input.value = (before + after).replace(/\s{2,}/g, ' ').trim();

      onSenderAdd(member.userId);
      setFromToken(null);
      input.focus();
    },
    [searchInputRef, fromToken, onSenderAdd]
  );

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = useCallback(
    (evt) => {
      if (!fromToken || suggestions.length === 0) return;

      if (evt.key === 'ArrowDown') {
        evt.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (evt.key === 'ArrowUp') {
        evt.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
      } else if (evt.key === 'Enter') {
        evt.preventDefault();
        if (suggestions[highlightedIndex]) {
          selectMember(suggestions[highlightedIndex]);
        }
      } else if (evt.key === 'Escape') {
        setFromToken(null);
      } else if (evt.key === 'Tab' && suggestions[highlightedIndex]) {
        evt.preventDefault();
        selectMember(suggestions[highlightedIndex]);
      }
    },
    [fromToken, suggestions, highlightedIndex, selectMember]
  );

  useEffect(() => {
    if (!fromToken || suggestions.length === 0) return undefined;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(target)
      ) {
        setFromToken(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [fromToken, suggestions.length, searchInputRef]);

  const handleSearchSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (fromToken && suggestions.length > 0) return;

    const { searchInput } = evt.target as HTMLFormElement & {
      searchInput: HTMLInputElement;
    };

    const searchTerm = searchInput.value.trim();
    if (searchTerm || hasSenders) {
      onSearch(searchTerm);
    }
  };

  return (
    <Box
      as="form"
      direction="Column"
      gap="100"
      onSubmit={handleSearchSubmit}
      style={{ position: 'relative' }}
    >
      <span data-spacing-node />
      <Text size="L400">Search</Text>
      <Input
        ref={searchInputRef}
        style={{ paddingRight: config.space.S300 }}
        name="searchInput"
        autoFocus
        size="500"
        variant="Background"
        placeholder="Search messages (type from: to filter by sender)"
        autoComplete="off"
        onChange={updateFromToken}
        onClick={updateFromToken}
        onKeyUp={updateFromToken}
        onKeyDown={handleKeyDown}
        before={
          active && loading ? (
            <Spinner variant="Secondary" size="200" />
          ) : (
            <Icon size="200" src={Icons.Search} />
          )
        }
        after={
          active ? (
            <Chip
              key="resetButton"
              type="reset"
              variant="Secondary"
              size="400"
              radii="Pill"
              outlined
              after={<Icon size="50" src={Icons.Cross} />}
              onClick={onReset}
            >
              <Text size="B300">Clear</Text>
            </Chip>
          ) : (
            <Chip type="submit" variant="Primary" size="400" radii="Pill" outlined>
              <Text size="B300">Enter</Text>
            </Chip>
          )
        }
      />
      {fromToken && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
          }}
        >
          <Menu variant="Surface" style={{ maxHeight: toRem(300), overflow: 'auto' }}>
            <Box direction="Column" style={{ padding: config.space.S100 }}>
              {suggestions.map((member, index) => (
                <MenuItem
                  key={member.userId}
                  variant={index === highlightedIndex ? 'Primary' : 'Surface'}
                  size="300"
                  radii="300"
                  onClick={() => selectMember(member)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  before={<Icon size="100" src={Icons.User} />}
                >
                  <Box gap="200" alignItems="Center" style={{ minWidth: 0 }}>
                    <Text size="T300" truncate>
                      <b>{member.rawDisplayName ?? getMxIdLocalPart(member.userId)}</b>
                    </Text>
                    <Text size="T200" priority="300" truncate>
                      {getMxIdLocalPart(member.userId)}
                    </Text>
                  </Box>
                </MenuItem>
              ))}
            </Box>
          </Menu>
        </div>
      )}
    </Box>
  );
}
