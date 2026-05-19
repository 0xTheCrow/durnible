import type { ChangeEvent, ChangeEventHandler, MouseEventHandler } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import type { RectCords } from 'folds';
import {
  Box,
  Button,
  Dialog,
  Icon,
  IconButton,
  Icons,
  Input,
  Menu,
  MenuItem,
  PopOut,
  Scroll,
  Switch,
  Text,
  color,
  config,
  toRem,
} from 'folds';
import type { GifItem, GifListResponse, GifMetaPatch, GifVisibility } from '../../utils/gifServer';
import {
  GifAuthError,
  addFavorite,
  deleteGif,
  fetchGifBlob,
  getFavoriteGifs,
  getFeaturedGifs,
  getHistoryGifs,
  getMyGifs,
  patchGifMeta,
  recordGifSelect,
  removeFavorite,
  replaceGifTags,
  searchGifs,
  uploadGif,
} from '../../utils/gifServer';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { OverlayModal } from '../OverlayModal';
import type { EmojiBoardTab } from './types';
import { EmojiBoardTabs } from './components/Tabs';
import { EmojiBoardLayout, GroupIcon, Sidebar, SidebarDivider, SidebarStack } from './components';
import * as css from './components/styles.css';
import { useDebounce } from '../../hooks/useDebounce';
import { mobileOrTablet } from '../../utils/user-agent';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { stopPropagation } from '../../utils/keyboard';

type GifSection = 'all' | 'favorites' | 'recents' | 'mine' | 'upload';

const PAGE_SIZE = 20;
const LOADING_INDICATOR_DELAY = 250;
const FAVORITE_ID_PAGE = 50;
const FAVORITE_ID_MAX_PAGES = 10;

async function collectFavoriteIds(
  nsfw: boolean,
  acc: Set<string>,
  pos: string | undefined,
  depth: number
): Promise<Set<string>> {
  const res = await getFavoriteGifs(FAVORITE_ID_PAGE, pos, nsfw);
  res.results.forEach((g) => acc.add(g.id));
  if (res.next && depth + 1 < FAVORITE_ID_MAX_PAGES) {
    return collectFavoriteIds(nsfw, acc, res.next, depth + 1);
  }
  return acc;
}

function loadSection(
  section: GifSection,
  query: string,
  nsfw: boolean,
  cursor?: string
): Promise<GifListResponse> {
  if (section === 'favorites') return getFavoriteGifs(PAGE_SIZE, cursor, nsfw);
  if (section === 'recents') return getHistoryGifs(PAGE_SIZE, cursor, nsfw);
  if (section === 'mine') return getMyGifs(PAGE_SIZE, cursor, nsfw);
  if (query) return searchGifs(query, PAGE_SIZE, cursor, nsfw);
  return getFeaturedGifs(PAGE_SIZE, cursor, nsfw);
}

function GifGridItem({
  gif,
  editable,
  favorited,
  onSelect,
  onEdit,
  onToggleFavorite,
  onContextMenu,
}: {
  gif: GifItem;
  editable: boolean;
  favorited: boolean;
  onSelect: (gif: GifItem) => void;
  onEdit: (gif: GifItem) => void;
  onToggleFavorite: (gif: GifItem) => void;
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
    <Box className={css.GifItemWrap}>
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
      <Box className={css.GifItemActions} alignItems="Center">
        {editable && (
          <IconButton
            className={css.GifItemActionBtn}
            size="300"
            radii="300"
            variant="Secondary"
            aria-label="Edit GIF"
            onClick={(evt) => {
              evt.stopPropagation();
              onEdit(gif);
            }}
          >
            <Icon size="100" src={Icons.Pencil} />
          </IconButton>
        )}
        <IconButton
          className={css.GifItemActionBtn}
          size="300"
          radii="300"
          variant="Secondary"
          aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={favorited}
          onClick={(evt) => {
            evt.stopPropagation();
            onToggleFavorite(gif);
          }}
        >
          <Icon size="100" src={Icons.Star} filled={favorited} />
        </IconButton>
      </Box>
    </Box>
  );
}

function GifGrid({
  gifs,
  myUserId,
  showEditButton,
  favoriteIds,
  onSelect,
  onEdit,
  onToggleFavorite,
  onContextMenu,
  emptyMsg,
}: {
  gifs: GifItem[];
  myUserId: string | null;
  showEditButton: boolean;
  favoriteIds: Set<string>;
  onSelect: (gif: GifItem) => void;
  onEdit: (gif: GifItem) => void;
  onToggleFavorite: (gif: GifItem) => void;
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
        <GifGridItem
          key={gif.id}
          gif={gif}
          editable={showEditButton && !!myUserId && gif.uploader_id === myUserId}
          favorited={favoriteIds.has(gif.id)}
          onSelect={onSelect}
          onEdit={onEdit}
          onToggleFavorite={onToggleFavorite}
          onContextMenu={onContextMenu}
        />
      ))}
    </Box>
  );
}

function GifUploadForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [tags, setTags] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [nsfw, setNsfw] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [uploaded, setUploaded] = useState<GifItem | undefined>(undefined);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(undefined);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setFile(e.target.files?.[0] ?? null);
    setError(undefined);
    setUploaded(undefined);
  };

  const handleUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError(undefined);
    try {
      const gif = await uploadGif(file, {
        tags: tags.trim() || undefined,
        visibility: isPrivate ? 'private' : 'shared',
        nsfw,
      });
      setUploaded(gif);
      setFile(null);
      setTags('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box direction="Column" gap="300" style={{ padding: config.space.S400, maxWidth: toRem(420) }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/gif"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <Button
        variant="Secondary"
        fill="Soft"
        size="400"
        radii="300"
        onClick={() => fileInputRef.current?.click()}
        before={<Icon size="100" src={Icons.Plus} />}
      >
        <Text size="B400">{file ? file.name : 'Choose a GIF'}</Text>
      </Button>

      {previewUrl && (
        <Box justifyContent="Center">
          <img
            src={previewUrl}
            alt="GIF preview"
            style={{ maxHeight: toRem(160), maxWidth: '100%', borderRadius: config.radii.R300 }}
          />
        </Box>
      )}

      <Box direction="Column" gap="100">
        <Text size="L400">Tags</Text>
        <Input
          variant="Surface"
          size="400"
          placeholder="comma, separated, tags"
          maxLength={500}
          value={tags}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setTags(e.target.value)}
        />
      </Box>

      <Box alignItems="Center" justifyContent="SpaceBetween">
        <Text size="T300">Private (only you can see it)</Text>
        <Switch variant="Primary" value={isPrivate} onChange={setIsPrivate} />
      </Box>
      <Box alignItems="Center" justifyContent="SpaceBetween">
        <Text size="T300">Mark as NSFW</Text>
        <Switch variant="Primary" value={nsfw} onChange={setNsfw} />
      </Box>

      <Button
        variant="Primary"
        size="400"
        radii="300"
        disabled={!file || uploading}
        onClick={handleUpload}
      >
        <Text size="B400">{uploading ? 'Uploading...' : 'Upload GIF'}</Text>
      </Button>

      {error && (
        <Text size="T300" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      )}
      {uploaded && (
        <Text size="T300" style={{ color: color.Success.Main }}>
          Uploaded — it&apos;s now in the GIF library.
        </Text>
      )}
    </Box>
  );
}

function GifEditModal({
  gif,
  onClose,
  onSaved,
  onDeleted,
}: {
  gif: GifItem;
  onClose: () => void;
  onSaved: (gif: GifItem) => void;
  onDeleted: (id: string) => void;
}) {
  const [tags, setTags] = useState(gif.tags.join(', '));
  const [isPrivate, setIsPrivate] = useState(gif.visibility === 'private');
  const [nsfw, setNsfw] = useState(gif.is_nsfw);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    const nextTags = tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const nextVisibility: GifVisibility = isPrivate ? 'private' : 'shared';
    try {
      const tagsChanged =
        nextTags.length !== gif.tags.length || nextTags.some((t, i) => t !== gif.tags[i]);
      if (tagsChanged) await replaceGifTags(gif.id, nextTags);

      const metaPatch: GifMetaPatch = {};
      if (nextVisibility !== gif.visibility) metaPatch.visibility = nextVisibility;
      if (nsfw !== gif.is_nsfw) metaPatch.is_nsfw = nsfw;
      if (metaPatch.visibility !== undefined || metaPatch.is_nsfw !== undefined) {
        await patchGifMeta(gif.id, metaPatch);
      }

      onSaved({ ...gif, tags: nextTags, visibility: nextVisibility, is_nsfw: nsfw });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await deleteGif(gif.id);
      onDeleted(gif.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
      setBusy(false);
    }
  };

  return (
    <OverlayModal open onClose={onClose}>
      <Dialog variant="Surface">
        <Box
          style={{ padding: config.space.S400, maxWidth: toRem(420) }}
          direction="Column"
          gap="400"
        >
          <Text size="H4">Edit GIF</Text>

          <Box direction="Column" gap="100">
            <Text size="L400">Tags</Text>
            <Input
              variant="Surface"
              size="400"
              placeholder="comma, separated, tags"
              maxLength={500}
              value={tags}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTags(e.target.value)}
            />
          </Box>

          <Box alignItems="Center" justifyContent="SpaceBetween">
            <Text size="T300">Private (only you can see it)</Text>
            <Switch variant="Primary" value={isPrivate} onChange={setIsPrivate} />
          </Box>
          <Box alignItems="Center" justifyContent="SpaceBetween">
            <Text size="T300">Mark as NSFW</Text>
            <Switch variant="Primary" value={nsfw} onChange={setNsfw} />
          </Box>

          {error && (
            <Text size="T300" style={{ color: color.Critical.Main }}>
              {error}
            </Text>
          )}

          <Box gap="200">
            <Button
              variant="Primary"
              size="400"
              radii="300"
              fill="Solid"
              disabled={busy}
              onClick={handleSave}
            >
              <Text size="B400">Save</Text>
            </Button>
            <Button
              variant="Secondary"
              size="400"
              radii="300"
              fill="Soft"
              disabled={busy}
              onClick={onClose}
            >
              <Text size="B400">Cancel</Text>
            </Button>
          </Box>

          <Box gap="200" alignItems="Center">
            {confirmDelete ? (
              <>
                <Button
                  variant="Critical"
                  size="400"
                  radii="300"
                  fill="Solid"
                  disabled={busy}
                  onClick={handleDelete}
                >
                  <Text size="B400">Confirm delete</Text>
                </Button>
                <Button
                  variant="Secondary"
                  size="400"
                  radii="300"
                  fill="None"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  <Text size="B400">Keep</Text>
                </Button>
              </>
            ) : (
              <Button
                variant="Critical"
                size="400"
                radii="300"
                fill="Soft"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
                before={<Icon size="100" src={Icons.Delete} />}
              >
                <Text size="B400">Delete GIF</Text>
              </Button>
            )}
          </Box>
        </Box>
      </Dialog>
    </OverlayModal>
  );
}

type GifBoardProps = {
  tab: EmojiBoardTab;
  onTabChange?: (tab: EmojiBoardTab) => void;
  onGifSelect?: (gif: GifItem) => void;
  requestClose: () => void;
};

export function GifBoard({ tab, onTabChange, onGifSelect, requestClose }: GifBoardProps) {
  const mx = useMatrixClient();
  const myUserId = mx.getUserId();
  const [showNsfw, setShowNsfw] = useSetting(settingsAtom, 'gifShowNsfw');
  const [editingGif, setEditingGif] = useState<GifItem | undefined>(undefined);

  const [activeSection, setActiveSection] = useState<GifSection>('all');
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());

  const sectionRef = useRef(activeSection);
  sectionRef.current = activeSection;
  const queryRef = useRef(query);
  queryRef.current = query;
  const nsfwRef = useRef(showNsfw);
  nsfwRef.current = showNsfw;

  const [contextMenuAnchor, setContextMenuAnchor] = useState<RectCords | undefined>(undefined);
  const [contextMenuGif, setContextMenuGif] = useState<GifItem | undefined>(undefined);
  const [filterAnchor, setFilterAnchor] = useState<RectCords | undefined>(undefined);

  const handleOpenFilter: MouseEventHandler<HTMLButtonElement> = useCallback((evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    setFilterAnchor((prev) =>
      prev ? undefined : { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    );
  }, []);

  const loadGifs = useCallback(
    async (section: GifSection, q: string, nsfw: boolean, cursor?: string) => {
      setLoading(true);
      try {
        const res = await loadSection(section, q, nsfw, cursor);
        setAuthError(false);
        if (cursor) {
          setGifs((prev) => [...prev, ...res.results]);
        } else {
          setGifs(res.results);
        }
        setNextCursor(res.next);
      } catch (e) {
        if (e instanceof GifAuthError) setAuthError(true);
        console.error('GIF load failed', e);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!loading) {
      setShowLoading(false);
      return undefined;
    }
    const timer = setTimeout(() => setShowLoading(true), LOADING_INDICATOR_DELAY);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (activeSection === 'upload') return;
    loadGifs(activeSection, query, showNsfw);
  }, [activeSection, query, showNsfw, loadGifs]);

  useEffect(() => {
    let cancelled = false;
    collectFavoriteIds(showNsfw, new Set<string>(), undefined, 0)
      .then((ids) => {
        if (!cancelled) setFavoriteIds(ids);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showNsfw]);

  const handleSearchChange: ChangeEventHandler<HTMLInputElement> = useDebounce(
    useCallback((e) => {
      setActiveSection('all');
      setQuery(e.target.value);
    }, []),
    { wait: 300 }
  );

  const handleSelect = useCallback(
    (gif: GifItem) => {
      recordGifSelect(gif.id).catch(() => {});
      onGifSelect?.(gif);
      requestClose();
    },
    [onGifSelect, requestClose]
  );

  const handleLoadMore = useCallback(() => {
    if (nextCursor) {
      loadGifs(sectionRef.current, queryRef.current, nsfwRef.current, nextCursor);
    }
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

  const toggleFavorite = useCallback(
    (gif: GifItem) => {
      const { id } = gif;
      const wasFavorite = favoriteIds.has(id);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(id);
        else next.add(id);
        return next;
      });
      const action = wasFavorite ? removeFavorite(id) : addFavorite(id);
      action.catch((e) => {
        console.error('GIF favorite toggle failed', e);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(id);
          else next.delete(id);
          return next;
        });
      });
      if (wasFavorite && sectionRef.current === 'favorites') {
        setGifs((prev) => prev.filter((g) => g.id !== id));
      }
    },
    [favoriteIds]
  );

  const handleToggleFavorite: MouseEventHandler = useCallback(() => {
    if (contextMenuGif) toggleFavorite(contextMenuGif);
    setContextMenuAnchor(undefined);
    setContextMenuGif(undefined);
  }, [contextMenuGif, toggleFavorite]);

  const handleEditFromMenu: MouseEventHandler = useCallback(() => {
    if (contextMenuGif) setEditingGif(contextMenuGif);
    setContextMenuAnchor(undefined);
    setContextMenuGif(undefined);
  }, [contextMenuGif]);

  const contextMenuEditable =
    !!myUserId && !!contextMenuGif && contextMenuGif.uploader_id === myUserId;

  const handleSectionClick = useCallback((section: GifSection) => {
    setActiveSection(section);
    setQuery('');
  }, []);

  const handleEditSaved = useCallback((updated: GifItem) => {
    setGifs((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  }, []);

  const handleEditDeleted = useCallback((id: string) => {
    setGifs((prev) => prev.filter((g) => g.id !== id));
    setFavoriteIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const renderContent = () => {
    if (activeSection === 'upload') {
      return <GifUploadForm />;
    }
    if (authError) {
      return (
        <Box justifyContent="Center" style={{ padding: config.space.S300 }}>
          <Text size="T300">Could not authenticate with the GIF server</Text>
        </Box>
      );
    }
    const emptyMsg = (() => {
      if (activeSection === 'favorites') return 'No favorites yet — right-click any GIF to add one';
      if (activeSection === 'recents') return 'No recent GIFs yet';
      if (activeSection === 'mine') return "You haven't uploaded any GIFs yet";
      return undefined;
    })();
    return (
      <>
        <GifGrid
          gifs={gifs}
          myUserId={myUserId}
          showEditButton={activeSection === 'mine'}
          favoriteIds={favoriteIds}
          onSelect={handleSelect}
          onEdit={setEditingGif}
          onToggleFavorite={toggleFavorite}
          onContextMenu={handleContextMenu}
          emptyMsg={!loading ? emptyMsg : undefined}
        />
        {showLoading && (
          <Box justifyContent="Center" style={{ padding: config.space.S300 }}>
            <Text size="T300">Loading...</Text>
          </Box>
        )}
        {!loading && gifs.length === 0 && activeSection === 'all' && query && (
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
  };

  return (
    <>
      <EmojiBoardLayout
        header={
          <Box direction="Column" gap="200">
            {onTabChange && <EmojiBoardTabs tab={tab} onTabChange={onTabChange} />}
            {activeSection !== 'upload' && (
              <Box gap="200" alignItems="Center">
                <Box grow="Yes">
                  <Input
                    variant="SurfaceVariant"
                    size="400"
                    placeholder="Search GIFs"
                    maxLength={100}
                    after={<Icon src={Icons.Search} size="50" />}
                    onChange={handleSearchChange}
                    autoFocus={!mobileOrTablet()}
                    style={{ width: '100%' }}
                  />
                </Box>
                <IconButton
                  variant="SurfaceVariant"
                  size="500"
                  radii="400"
                  aria-label="Filters"
                  aria-pressed={showNsfw}
                  onClick={handleOpenFilter}
                >
                  <Icon src={Icons.Filter} size="100" filled={showNsfw} />
                </IconButton>
              </Box>
            )}
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
            <SidebarStack style={{ marginTop: 'auto' }}>
              <SidebarDivider />
              <GroupIcon
                id="upload"
                label="Upload GIF"
                icon={Icons.PlusCircle}
                active={activeSection === 'upload'}
                onClick={handleSectionClick}
              />
              <GroupIcon
                id="mine"
                label="My GIFs"
                icon={Icons.User}
                active={activeSection === 'mine'}
                onClick={handleSectionClick}
              />
            </SidebarStack>
          </Sidebar>
        }
      >
        <Box grow="Yes" style={{ overflow: 'hidden' }}>
          <Scroll size="300" hideTrack>
            {renderContent()}
          </Scroll>
        </Box>
      </EmojiBoardLayout>
      {editingGif && (
        <GifEditModal
          gif={editingGif}
          onClose={() => setEditingGif(undefined)}
          onSaved={handleEditSaved}
          onDeleted={handleEditDeleted}
        />
      )}
      {filterAnchor && (
        <PopOut
          anchor={filterAnchor}
          position="Bottom"
          align="End"
          content={
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                returnFocusOnDeactivate: false,
                onDeactivate: () => setFilterAnchor(undefined),
                clickOutsideDeactivates: true,
                escapeDeactivates: stopPropagation,
              }}
            >
              <Menu style={{ maxWidth: toRem(250), width: '100vw' }}>
                <Box
                  alignItems="Center"
                  justifyContent="SpaceBetween"
                  gap="200"
                  style={{ padding: config.space.S200 }}
                >
                  <Text size="T300">Show NSFW</Text>
                  <Switch variant="Primary" value={showNsfw} onChange={setShowNsfw} />
                </Box>
              </Menu>
            </FocusTrap>
          }
        />
      )}
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
                      {contextMenuGif && favoriteIds.has(contextMenuGif.id)
                        ? 'Remove from Favorites'
                        : 'Add to Favorites'}
                    </Text>
                  </MenuItem>
                  {contextMenuEditable && (
                    <MenuItem
                      onClick={handleEditFromMenu}
                      size="300"
                      radii="300"
                      before={<Icon size="100" src={Icons.Pencil} />}
                    >
                      <Text size="T300">Edit</Text>
                    </MenuItem>
                  )}
                </Box>
              </Menu>
            </FocusTrap>
          }
        />
      )}
    </>
  );
}
