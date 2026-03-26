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
import { Box, Text, Input, Icon, Icons, IconSrc, Spinner, Chip, config, Menu, MenuItem, toRem } from 'folds';
import { RoomMember } from 'matrix-js-sdk';
import { getMxIdLocalPart } from '../../utils/matrix';

type TokenType = 'from' | 'has';

type PrefixToken = {
  type: TokenType;
  start: number;
  end: number;
  query: string;
};

const getPrefixToken = (value: string, cursorPos: number): PrefixToken | null => {
  const beforeCursor = value.substring(0, cursorPos);
  const match = beforeCursor.match(/(from|has):(\S*)$/i);
  if (!match || match.index === undefined) return null;
  const type = match[1].toLowerCase() as TokenType;
  const start = match.index;
  const query = match[2];
  const afterCursor = value.substring(cursorPos);
  const spaceMatch = afterCursor.match(/^\S*/);
  const end = cursorPos + (spaceMatch ? spaceMatch[0].length : 0);
  return { type, start, end, query };
};

type HasOption = { value: string; label: string; icon: string };
const HAS_OPTIONS: HasOption[] = [
  { value: 'image', label: 'Image', icon: 'Photo' },
  { value: 'video', label: 'Video', icon: 'Play' },
  { value: 'file', label: 'File', icon: 'File' },
];

type SearchProps = {
  active?: boolean;
  loading?: boolean;
  searchInputRef: RefObject<HTMLInputElement>;
  onSearch: (term: string) => void;
  onReset: () => void;
  members?: RoomMember[];
  onSenderAdd?: (userId: string) => void;
  onHasAdd?: (hasType: string) => void;
  hasFilters?: boolean;
  selectedHasTypes?: string[];
};

export function SearchInput({
  active,
  loading,
  searchInputRef,
  onSearch,
  onReset,
  members,
  onSenderAdd,
  onHasAdd,
  hasFilters,
  selectedHasTypes,
}: SearchProps) {
  const [token, setToken] = useState<PrefixToken | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevQueryRef = useRef('');

  const memberSuggestions = useMemo(() => {
    if (!token || token.type !== 'from' || !members || members.length === 0) return [];
    const q = token.query.toLowerCase();
    if (!q) return members.slice(0, 8);
    return members
      .filter((m) => {
        const displayName = (m.rawDisplayName ?? '').toLowerCase();
        const userId = m.userId.toLowerCase();
        const localPart = (getMxIdLocalPart(m.userId) ?? '').toLowerCase();
        return displayName.includes(q) || userId.includes(q) || localPart.includes(q);
      })
      .slice(0, 8);
  }, [token, members]);

  const hasSuggestions = useMemo(() => {
    if (!token || token.type !== 'has') return [];
    const q = token.query.toLowerCase();
    const alreadySelected = new Set(selectedHasTypes ?? []);
    return HAS_OPTIONS.filter(
      (opt) => !alreadySelected.has(opt.value) && (!q || opt.value.includes(q) || opt.label.toLowerCase().includes(q))
    );
  }, [token, selectedHasTypes]);

  const suggestions = token?.type === 'from' ? memberSuggestions : hasSuggestions;
  const suggestionCount = suggestions.length;

  const updateToken = useCallback(() => {
    const input = searchInputRef.current;
    if (!input) return;
    const cursorPos = input.selectionStart ?? input.value.length;
    const newToken = getPrefixToken(input.value, cursorPos);
    setToken(newToken);
    const newQuery = `${newToken?.type ?? ''}:${newToken?.query ?? ''}`;
    if (newQuery !== prevQueryRef.current) {
      prevQueryRef.current = newQuery;
      setHighlightedIndex(0);
    }
  }, [searchInputRef]);

  const removeTokenFromInput = useCallback(
    (tok: PrefixToken) => {
      const input = searchInputRef.current;
      if (!input) return;
      const before = input.value.substring(0, tok.start);
      const after = input.value.substring(tok.end);
      input.value = (before + after).replace(/\s{2,}/g, ' ').trim();
      setToken(null);
      input.focus();
    },
    [searchInputRef]
  );

  const selectMember = useCallback(
    (member: RoomMember) => {
      if (!token || !onSenderAdd) return;
      removeTokenFromInput(token);
      onSenderAdd(member.userId);
    },
    [token, onSenderAdd, removeTokenFromInput]
  );

  const selectHasOption = useCallback(
    (opt: HasOption) => {
      if (!token || !onHasAdd) return;
      removeTokenFromInput(token);
      onHasAdd(opt.value);
    },
    [token, onHasAdd, removeTokenFromInput]
  );

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = useCallback(
    (evt) => {
      if (!token || suggestionCount === 0) return;

      if (evt.key === 'ArrowDown') {
        evt.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, suggestionCount - 1));
      } else if (evt.key === 'ArrowUp') {
        evt.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
      } else if (evt.key === 'Enter') {
        evt.preventDefault();
        if (token.type === 'from' && memberSuggestions[highlightedIndex]) {
          selectMember(memberSuggestions[highlightedIndex]);
        } else if (token.type === 'has' && hasSuggestions[highlightedIndex]) {
          selectHasOption(hasSuggestions[highlightedIndex]);
        }
      } else if (evt.key === 'Escape') {
        setToken(null);
      } else if (evt.key === 'Tab') {
        if (token.type === 'from' && memberSuggestions[highlightedIndex]) {
          evt.preventDefault();
          selectMember(memberSuggestions[highlightedIndex]);
        } else if (token.type === 'has' && hasSuggestions[highlightedIndex]) {
          evt.preventDefault();
          selectHasOption(hasSuggestions[highlightedIndex]);
        }
      }
    },
    [token, suggestionCount, highlightedIndex, memberSuggestions, hasSuggestions, selectMember, selectHasOption]
  );

  useEffect(() => {
    if (!token || suggestionCount === 0) return undefined;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(target)
      ) {
        setToken(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [token, suggestionCount, searchInputRef]);

  const handleSearchSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (token && suggestionCount > 0) return;

    const { searchInput } = evt.target as HTMLFormElement & {
      searchInput: HTMLInputElement;
    };

    const searchTerm = searchInput.value.trim();
    if (searchTerm || hasFilters) {
      onSearch(searchTerm);
    }
  };

  const hasIconSrc = (icon: string): IconSrc => {
    const map: Record<string, IconSrc> = {
      Photo: Icons.Photo,
      Play: Icons.Play,
      File: Icons.File,
    };
    return map[icon] ?? Icons.File;
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
        placeholder="Search messages (from: sender, has: image/video/file)"
        autoComplete="off"
        onChange={updateToken}
        onClick={updateToken}
        onKeyUp={updateToken}
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
      {token && suggestionCount > 0 && (
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
              {token.type === 'from' &&
                memberSuggestions.map((member, index) => (
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
              {token.type === 'has' &&
                hasSuggestions.map((opt, index) => (
                  <MenuItem
                    key={opt.value}
                    variant={index === highlightedIndex ? 'Primary' : 'Surface'}
                    size="300"
                    radii="300"
                    onClick={() => selectHasOption(opt)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    before={<Icon size="100" src={hasIconSrc(opt.icon)} />}
                  >
                    <Text size="T300">{opt.label}</Text>
                  </MenuItem>
                ))}
            </Box>
          </Menu>
        </div>
      )}
    </Box>
  );
}
