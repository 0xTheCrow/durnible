import React, {
  ChangeEventHandler,
  MouseEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import FocusTrap from 'focus-trap-react';
import { Box, Icon, Icons, Input, Menu, MenuItem, PopOut, RectCords, Scroll, Text, config, toRem } from 'folds';
import {
  GifItem,
  GifListResponse,
  fetchGifBlob,
  getFeaturedGifs,
  recordGifSelect,
  searchGifs,
} from '../../utils/gifServer';
import { EmojiBoardTab } from './types';
import { EmojiBoardTabs } from './components/Tabs';
import { EmojiBoardLayout, GroupIcon, Sidebar, SidebarStack } from './components';
import * as css from './components/styles.css';
import { useDebounce } from '../../hooks/useDebounce';
import { mobileOrTablet } from '../../utils/user-agent';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useFavoriteGifs } from '../../hooks/useFavoriteGif';
import { useRecentGifs } from '../../hooks/useRecentGif';
import { addFavoriteGif, isFavoriteGif, removeFavoriteGif } from '../../plugins/favorite-gif';
import { addRecentGif } from '../../plugins/recent-gif';
import { stopPropagation } from '../../utils/keyboard';

type GifSection = 'all' | 'favorites' | 'recents';

function GifGridItem({
  gif,
  onSelect,
  onContextMenu,
}: {
  gif: GifItem;
  onSelect: (gif: GifItem) => void;
  onContextMenu: (gif: GifItem, evt: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const [src, setSrc] = useState<string | undefined>(undefined);
  const thumbBlobRef = useRef<string | undefined>(undefined);
  const previewBlobRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetchGifBlob(gif.renditions.thumbnail.url)
      .then((blob) => {
        if (!mountedRef.current) return;
        const url = URL.createObjectURL(blob);
        thumbBlobRef.current = url;
        setSrc(url);
      })
      .catch(() => {});
    return () => {
      mountedRef.current = false;
      if (thumbBlobRef.current) URL.revokeObjectURL(thumbBlobRef.current);
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    };
  }, [gif.renditions.thumbnail.url]);

  const handleMouseEnter = useCallback(() => {
    if (previewBlobRef.current) {
      setSrc(previewBlobRef.current);
      return;
    }
    fetchGifBlob(gif.renditions.preview.url)
      .then((blob) => {
        if (!mountedRef.current) return;
        const url = URL.createObjectURL(blob);
        previewBlobRef.current = url;
        setSrc(url);
      })
      .catch(() => {});
  }, [gif.renditions.preview.url]);

  const handleMouseLeave = useCallback(() => {
    if (thumbBlobRef.current) setSrc(thumbBlobRef.current);
  }, []);

  const { width, height } = gif.renditions.thumbnail;

  return (
    <button
      type="button"
      className={css.GifItem}
      title={gif.tags.join(', ') || gif.filename}
      aria-label={gif.tags[0] || gif.filename}
      style={{ aspectRatio: `${width} / ${height}` }}
      onClick={() => onSelect(gif)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(evt) => onContextMenu(gif, evt)}
    >
      {src && (
        <img
          src={src}
          alt={gif.tags[0] || gif.filename}
          className={css.GifItemImg}
          draggable={false}
        />
      )}
    </button>
  );
}

function GifGrid({
  gifs,
  onSelect,
  onContextMenu,
  emptyMsg,
}: {
  gifs: GifItem[];
  onSelect: (gif: GifItem) => void;
  onContextMenu: (gif: GifItem, evt: React.MouseEvent<HTMLButtonElement>) => void;
  emptyMsg?: string;
}) {
  if (gifs.length === 0 && emptyMsg) {
    return (
      <Box justifyContent="Center" style={{ padding: config.space.S300 }}>
        <Text size="T300">{emptyMsg}</Text>
      </Box>
    );
  }
  return (
    <Box className={css.GifGrid}>
      {gifs.map((gif) => (
        <GifGridItem key={gif.id} gif={gif} onSelect={onSelect} onContextMenu={onContextMenu} />
      ))}
    </Box>
  );
}

type GifBoardProps = {
  tab: EmojiBoardTab;
  onTabChange?: (tab: EmojiBoardTab) => void;
  onGifSelect?: (gif: GifItem) => void;
  requestClose: () => void;
};

export function GifBoard({
  tab,
  onTabChange,
  onGifSelect,
  requestClose,
}: GifBoardProps) {
  const mx = useMatrixClient();
  const favoriteGifs = useFavoriteGifs(mx);
  const recentGifs = useRecentGifs(mx, 50);

  const [activeSection, setActiveSection] = useState<GifSection>('all');
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const queryRef = useRef(query);
  queryRef.current = query;

  const [contextMenuAnchor, setContextMenuAnchor] = useState<RectCords | undefined>(undefined);
  const [contextMenuGif, setContextMenuGif] = useState<GifItem | undefined>(undefined);

  const loadGifs = useCallback(async (q: string, cursor?: string) => {
    setLoading(true);
    try {
      const res: GifListResponse = q
        ? await searchGifs(q, 20, cursor)
        : await getFeaturedGifs(20, cursor);
      if (cursor) {
        setGifs((prev) => [...prev, ...res.results]);
      } else {
        setGifs(res.results);
      }
      setNextCursor(res.next);
    } catch (e) {
      console.error('GIF load failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection !== 'all') return;
    loadGifs(query);
  }, [query, loadGifs, activeSection]);

  const handleSearchChange: ChangeEventHandler<HTMLInputElement> = useDebounce(
    useCallback((e) => {
      setActiveSection('all');
      setQuery(e.target.value);
    }, []),
    { wait: 300 }
  );

  const handleSelect = useCallback(
    (gif: GifItem) => {
      addRecentGif(mx, gif);
      recordGifSelect(gif.id).catch(() => {});
      onGifSelect?.(gif);
      requestClose();
    },
    [mx, onGifSelect, requestClose]
  );

  const handleLoadMore = useCallback(() => {
    if (nextCursor) loadGifs(queryRef.current, nextCursor);
  }, [nextCursor, loadGifs]);

  const handleContextMenu = useCallback(
    (gif: GifItem, evt: React.MouseEvent<HTMLButtonElement>) => {
      evt.preventDefault();
      const rect = evt.currentTarget.getBoundingClientRect();
      setContextMenuAnchor({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
      setContextMenuGif(gif);
    },
    []
  );

  const handleToggleFavorite: MouseEventHandler = useCallback(() => {
    if (!contextMenuGif) return;
    if (isFavoriteGif(favoriteGifs, contextMenuGif.id)) {
      removeFavoriteGif(mx, contextMenuGif.id);
    } else {
      addFavoriteGif(mx, contextMenuGif);
    }
    setContextMenuAnchor(undefined);
    setContextMenuGif(undefined);
  }, [mx, contextMenuGif, favoriteGifs]);

  const handleSectionClick = useCallback((section: GifSection) => {
    setActiveSection(section);
    setQuery('');
  }, []);

  const renderContent = () => {
    if (activeSection === 'all') {
      return (
        <>
          <GifGrid gifs={gifs} onSelect={handleSelect} onContextMenu={handleContextMenu} />
          {loading && (
            <Box justifyContent="Center" style={{ padding: config.space.S300 }}>
              <Text size="T300">Loading...</Text>
            </Box>
          )}
          {!loading && gifs.length === 0 && query && (
            <Box justifyContent="Center" style={{ padding: config.space.S300 }}>
              <Text size="T300">No GIFs found</Text>
            </Box>
          )}
          {nextCursor && !loading && (
            <Box justifyContent="Center" style={{ padding: config.space.S200 }}>
              <button type="button" onClick={handleLoadMore} style={{ cursor: 'pointer' }}>
                <Text size="T300">Load more</Text>
              </button>
            </Box>
          )}
        </>
      );
    }
    if (activeSection === 'favorites') {
      return (
        <GifGrid
          gifs={favoriteGifs}
          onSelect={handleSelect}
          onContextMenu={handleContextMenu}
          emptyMsg="No favorites yet — right-click any GIF to add one"
        />
      );
    }
    if (activeSection === 'recents') {
      return (
        <GifGrid
          gifs={recentGifs}
          onSelect={handleSelect}
          onContextMenu={handleContextMenu}
          emptyMsg="No recent GIFs yet"
        />
      );
    }
    return null;
  };

  return (
    <>
      <EmojiBoardLayout
        header={
          <Box direction="Column" gap="200">
            {onTabChange && <EmojiBoardTabs tab={tab} onTabChange={onTabChange} />}
            <Input
              variant="SurfaceVariant"
              size="400"
              placeholder="Search GIFs"
              maxLength={100}
              after={<Icon src={Icons.Search} size="50" />}
              onChange={handleSearchChange}
              autoFocus={!mobileOrTablet()}
            />
          </Box>
        }
        sidebar={
          <Sidebar>
            <SidebarStack>
              <GroupIcon
                id="all"
                label="Search / Featured"
                icon={Icons.Search}
                active={activeSection === 'all'}
                onClick={handleSectionClick}
              />
              <GroupIcon
                id="favorites"
                label="Favorites"
                icon={Icons.Star}
                active={activeSection === 'favorites'}
                onClick={handleSectionClick}
              />
              <GroupIcon
                id="recents"
                label="Recent"
                icon={Icons.RecentClock}
                active={activeSection === 'recents'}
                onClick={handleSectionClick}
              />
            </SidebarStack>
          </Sidebar>
        }
      >
        <Box grow="Yes" style={{ overflow: 'hidden' }}>
          <Scroll size="400" hideTrack>
            {renderContent()}
          </Scroll>
        </Box>
      </EmojiBoardLayout>
      {contextMenuAnchor && (
        <PopOut
          anchor={contextMenuAnchor}
          position="Right"
          align="Start"
          content={
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                returnFocusOnDeactivate: false,
                onDeactivate: () => {
                  setContextMenuAnchor(undefined);
                  setContextMenuGif(undefined);
                },
                clickOutsideDeactivates: true,
                isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                escapeDeactivates: stopPropagation,
              }}
            >
              <Menu style={{ maxWidth: toRem(250), width: '100vw' }}>
                <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                  <MenuItem
                    onClick={handleToggleFavorite}
                    size="300"
                    radii="300"
                    before={<Icon size="100" src={Icons.Star} />}
                  >
                    <Text size="T300">
                      {contextMenuGif && isFavoriteGif(favoriteGifs, contextMenuGif.id)
                        ? 'Remove from Favorites'
                        : 'Add to Favorites'}
                    </Text>
                  </MenuItem>
                </Box>
              </Menu>
            </FocusTrap>
          }
        />
      )}
    </>
  );
}
