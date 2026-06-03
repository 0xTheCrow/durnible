import type { ChangeEvent, ChangeEventHandler, MouseEventHandler } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import FileSaver from 'file-saver';
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
  Spinner,
  Switch,
  Text,
  color,
  config,
  toRem,
} from 'folds';
import type { GifItem, GifListResponse, GifMetaPatch, GifVisibility } from '../../utils/gifServer';
import {
  GIF_MAX_UPLOAD_SIZE_BYTES,
  GifAuthError,
  addFavorite,
  addHidden,
  deleteGif,
  fetchGifBlob,
  getFavoriteGifs,
  getFeaturedGifs,
  getHiddenGifs,
  getHistoryGifs,
  getMyGifs,
  patchGifMeta,
  recordGifSelect,
  removeFavorite,
  removeHidden,
  replaceGifFile,
  replaceGifTags,
  searchGifs,
  uploadGif,
} from '../../utils/gifServer';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import type { ItemRange } from '../../hooks/useVirtualPaginator';
import { useVirtualPaginator } from '../../hooks/useVirtualPaginator';
import { OverlayModal } from '../OverlayModal';
import type { EmojiBoardTab } from './types';
import {
  EmojiBoardHeaderRow,
  EmojiBoardLayout,
  GroupIcon,
  Sidebar,
  SidebarDivider,
  SidebarStack,
} from './components';
import * as css from './components/styles.css';
import { useDebounce } from '../../hooks/useDebounce';
import { mobileOrTablet } from '../../utils/user-agent';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { stopPropagation } from '../../utils/keyboard';
import { gifUploadFormAtom, gifUploadFormInitialState } from '../../state/gifUploadForm';
import { fileDropOverrideAtom } from '../../state/fileDropOverride';
import { FloppyIcon } from '../icons/FloppyIcon';
import { UploadIcon } from '../icons/UploadIcon';

type GifSection = 'all' | 'favorites' | 'recents' | 'mine' | 'upload';

const PAGE_SIZE = 20;
const LOADING_INDICATOR_DELAY = 250;
const COLUMNS = 2;
const ROW_PAGE_LIMIT = PAGE_SIZE / COLUMNS;
const INITIAL_ROWS = ROW_PAGE_LIMIT;
const FAVORITE_ID_PAGE = 50;
const FAVORITE_ID_MAX_PAGES = 10;

async function collectFavoriteIds(
  showNsfw: boolean,
  showHidden: boolean,
  acc: Set<string>,
  pos: string | undefined,
  depth: number
): Promise<Set<string>> {
  const res = await getFavoriteGifs(FAVORITE_ID_PAGE, pos, showNsfw, showHidden);
  res.results.forEach((g) => acc.add(g.id));
  if (res.next && depth + 1 < FAVORITE_ID_MAX_PAGES) {
    return collectFavoriteIds(showNsfw, showHidden, acc, res.next, depth + 1);
  }
  return acc;
}

async function collectHiddenIds(
  showNsfw: boolean,
  acc: Set<string>,
  pos: string | undefined,
  depth: number
): Promise<Set<string>> {
  const res = await getHiddenGifs(FAVORITE_ID_PAGE, pos, showNsfw);
  res.results.forEach((g) => acc.add(g.id));
  if (res.next && depth + 1 < FAVORITE_ID_MAX_PAGES) {
    return collectHiddenIds(showNsfw, acc, res.next, depth + 1);
  }
  return acc;
}

function loadSection(
  section: GifSection,
  query: string,
  showNsfw: boolean,
  showHidden: boolean,
  cursor?: string
): Promise<GifListResponse> {
  if (section === 'favorites') return getFavoriteGifs(PAGE_SIZE, cursor, showNsfw, showHidden);
  if (section === 'recents') return getHistoryGifs(PAGE_SIZE, cursor, showNsfw, showHidden);
  if (section === 'mine') return getMyGifs(PAGE_SIZE, cursor, showNsfw, showHidden);
  if (query) return searchGifs(query, PAGE_SIZE, cursor, showNsfw, showHidden);
  return getFeaturedGifs(PAGE_SIZE, cursor, showNsfw, showHidden);
}

function GifGridItem({
  gif,
  editable,
  favorited,
  hidden,
  onSelect,
  onEdit,
  onToggleFavorite,
  onContextMenu,
}: {
  gif: GifItem;
  editable: boolean;
  favorited: boolean;
  hidden: boolean;
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
      {hidden && (
        <IconButton
          as="div"
          className={css.GifItemHiddenBadge}
          size="300"
          radii="300"
          variant="Secondary"
          aria-hidden
        >
          <Icon size="100" src={Icons.EyeBlind} />
        </IconButton>
      )}
    </Box>
  );
}

type ObserveAnchor = (element: HTMLElement | null) => void;

function GifGrid({
  rows,
  getItems,
  observeBackAnchor,
  observeFrontAnchor,
  myUserId,
  showEditButton,
  favoriteIds,
  hiddenIds,
  onSelect,
  onEdit,
  onToggleFavorite,
  onContextMenu,
  emptyMsg,
}: {
  rows: GifItem[][];
  getItems: () => number[];
  observeBackAnchor: ObserveAnchor;
  observeFrontAnchor: ObserveAnchor;
  myUserId: string | null;
  showEditButton: boolean;
  favoriteIds: Set<string>;
  hiddenIds: Set<string>;
  onSelect: (gif: GifItem) => void;
  onEdit: (gif: GifItem) => void;
  onToggleFavorite: (gif: GifItem) => void;
  onContextMenu: (gif: GifItem, evt: React.MouseEvent<HTMLButtonElement>) => void;
  emptyMsg?: string;
}) {
  if (rows.length === 0 && emptyMsg) {
    return (
      <Box justifyContent="Center" style={{ padding: config.space.S300 }}>
        <Text size="T300">{emptyMsg}</Text>
      </Box>
    );
  }
  return (
    <Box className={css.GifGrid} direction="Column">
      <div ref={observeBackAnchor} />
      {getItems().map((rowIndex) => {
        const row = rows[rowIndex];
        if (!row) return null;
        return (
          <Box key={rowIndex} className={css.GifRow} data-gif-row={rowIndex}>
            {row.map((gif) => (
              <GifGridItem
                key={gif.id}
                gif={gif}
                editable={showEditButton && !!myUserId && gif.uploader_id === myUserId}
                favorited={favoriteIds.has(gif.id)}
                hidden={hiddenIds.has(gif.id)}
                onSelect={onSelect}
                onEdit={onEdit}
                onToggleFavorite={onToggleFavorite}
                onContextMenu={onContextMenu}
              />
            ))}
          </Box>
        );
      })}
      <div ref={observeFrontAnchor} />
    </Box>
  );
}

const isGifFile = (file: File) =>
  file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

const formatMiB = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;

function GifUploadForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useAtom(gifUploadFormAtom);
  const setFileDropOverride = useSetAtom(fileDropOverrideAtom);
  const { file, tags, isPrivate, nsfw } = form;
  const setTags = (value: string) => setForm((s) => ({ ...s, tags: value }));
  const setIsPrivate = (value: boolean) => setForm((s) => ({ ...s, isPrivate: value }));
  const setNsfw = (value: boolean) => setForm((s) => ({ ...s, nsfw: value }));
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
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

  const stageFile = useCallback(
    (next: File | undefined) => {
      if (!next) return;
      if (!isGifFile(next)) {
        setError('Only GIF files can be uploaded.');
        return;
      }
      if (next.size > GIF_MAX_UPLOAD_SIZE_BYTES) {
        setError(
          `GIF is ${formatMiB(next.size)} — exceeds the ${formatMiB(
            GIF_MAX_UPLOAD_SIZE_BYTES
          )} upload limit.`
        );
        return;
      }
      setForm((s) => ({ ...s, file: next }));
      setError(undefined);
      setUploaded(undefined);
    },
    [setForm]
  );

  const handleDrop = useCallback(
    (files: File[]) => {
      stageFile(files.find(isGifFile) ?? files[0]);
    },
    [stageFile]
  );

  useEffect(() => {
    setFileDropOverride({
      title: 'Drop a GIF to upload',
      description: 'Drop a .gif here to add it to the upload form',
      onDrop: handleDrop,
    });
    return () => setFileDropOverride(undefined);
  }, [setFileDropOverride, handleDrop]);

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    stageFile(e.target.files?.[0]);
  };

  const handleClear = () => {
    setForm(gifUploadFormInitialState);
    setError(undefined);
    setUploaded(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      setForm((s) => ({ ...s, file: null, tags: '' }));
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box
      direction="Column"
      gap="300"
      style={{ padding: config.space.S400, paddingRight: config.space.S100 }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/gif"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <Box className={css.GifItemWrap}>
        <button
          type="button"
          className={css.GifUploadDropzone}
          onClick={() => fileInputRef.current?.click()}
          aria-label={file ? `Selected ${file.name}` : 'Choose a GIF'}
          disabled={uploading}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="GIF preview" className={css.GifUploadDropzoneImg} />
          ) : (
            <Box direction="Column" alignItems="Center" gap="100">
              <Icon size="400" src={Icons.Plus} />
              <Text size="B400">Choose a GIF</Text>
            </Box>
          )}
        </button>
        {file && (
          <Box className={css.GifItemActions} alignItems="Center">
            <IconButton
              className={css.GifItemActionBtn}
              size="300"
              radii="300"
              variant="Secondary"
              aria-label="Remove selected GIF"
              onClick={handleClear}
              disabled={uploading}
            >
              <Icon size="100" src={Icons.Cross} />
            </IconButton>
          </Box>
        )}
      </Box>

      <Box direction="Column" gap="100">
        <Text size="L400">Tags</Text>
        <Input
          variant="Surface"
          size="400"
          outlined
          placeholder="comma, separated, tags"
          maxLength={500}
          value={tags}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setTags(e.target.value)}
          disabled={uploading}
        />
      </Box>

      <Box alignItems="Center" gap="500">
        <Box alignItems="Center" gap="200">
          <Switch
            variant="Primary"
            value={isPrivate}
            onChange={setIsPrivate}
            disabled={uploading}
          />
          <Text size="T300">Private</Text>
        </Box>
        <Box alignItems="Center" gap="200">
          <Switch variant="Primary" value={nsfw} onChange={setNsfw} disabled={uploading} />
          <Text size="T300">NSFW</Text>
        </Box>
      </Box>

      <Button
        variant="Primary"
        size="400"
        radii="300"
        disabled={!file || uploading}
        onClick={handleUpload}
        before={
          uploading ? (
            <Spinner size="100" variant="Primary" fill="Solid" />
          ) : (
            <Icon size="100" src={UploadIcon} />
          )
        }
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
  const [previewSrc, setPreviewSrc] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    fetchGifBlob(gif.renditions.preview.url)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewSrc(objectUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [gif.renditions.preview.url]);

  const previewWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!confirmDelete) return undefined;
    const handlePointerDown = (evt: MouseEvent) => {
      if (previewWrapRef.current && !previewWrapRef.current.contains(evt.target as Node)) {
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [confirmDelete]);

  const nextTags = tags
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const nextVisibility: GifVisibility = isPrivate ? 'private' : 'shared';
  const tagsChanged =
    nextTags.length !== gif.tags.length || nextTags.some((t, i) => t !== gif.tags[i]);
  const visibilityChanged = nextVisibility !== gif.visibility;
  const nsfwChanged = nsfw !== gif.is_nsfw;
  const hasChanges = tagsChanged || visibilityChanged || nsfwChanged;

  const handleSave = async () => {
    if (busy || !hasChanges) return;
    setBusy(true);
    setError(undefined);
    try {
      if (tagsChanged) await replaceGifTags(gif.id, nextTags);

      const metaPatch: GifMetaPatch = {};
      if (visibilityChanged) metaPatch.visibility = nextVisibility;
      if (nsfwChanged) metaPatch.is_nsfw = nsfw;
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

  const handleReplaceFile = async (replacement: File) => {
    if (busy) return;
    if (!isGifFile(replacement)) {
      setError('Only GIF files can be used.');
      return;
    }
    if (replacement.size > GIF_MAX_UPLOAD_SIZE_BYTES) {
      setError(
        `GIF is ${formatMiB(replacement.size)} — exceeds the ${formatMiB(
          GIF_MAX_UPLOAD_SIZE_BYTES
        )} upload limit.`
      );
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const updated = await replaceGifFile(gif.id, replacement);
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Replace failed');
      setBusy(false);
    }
  };

  const handleReplaceChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const next = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (next) handleReplaceFile(next);
  };

  return (
    <OverlayModal open onClose={onClose}>
      <Dialog variant="Surface">
        <Box
          style={{ padding: config.space.S400, maxWidth: toRem(420) }}
          direction="Column"
          gap="300"
        >
          <Box alignItems="Center" justifyContent="SpaceBetween" gap="200">
            <Text size="H4">Edit GIF</Text>
            <IconButton
              className={css.GifEditBtnTransition}
              variant="Background"
              aria-label="Close"
              onClick={onClose}
            >
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>

          <Box ref={previewWrapRef} className={css.GifItemWrap}>
            <Box className={css.GifPreviewBox}>
              {previewSrc && (
                <img
                  src={previewSrc}
                  alt={gif.tags[0] || gif.filename}
                  className={css.GifUploadDropzoneImg}
                />
              )}
            </Box>
            {confirmDelete ? (
              <Box className={css.GifPreviewConfirm}>
                <Text size="H4" align="Center" style={{ color: color.Surface.OnContainer }}>
                  Delete this GIF?
                </Text>
                <Box gap="200" alignItems="Center" style={{ alignSelf: 'stretch' }}>
                  <Button
                    className={css.GifPreviewDeleteBtn}
                    variant="Critical"
                    size="400"
                    radii="300"
                    fill="Soft"
                    disabled={busy}
                    onClick={handleDelete}
                    style={{ flexGrow: 1, flexBasis: 0 }}
                  >
                    <Text size="B400">Yes</Text>
                  </Button>
                  <Button
                    className={css.GifEditBtnTransition}
                    variant="Secondary"
                    size="400"
                    radii="300"
                    fill="Soft"
                    disabled={busy}
                    onClick={() => setConfirmDelete(false)}
                    style={{ flexGrow: 1, flexBasis: 0 }}
                  >
                    <Text size="B400">No</Text>
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box className={css.GifPreviewActions} alignItems="Center">
                <IconButton
                  className={css.GifPreviewDeleteBtn}
                  size="400"
                  radii="300"
                  variant="Critical"
                  fill="Soft"
                  aria-label="Delete GIF"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Icon size="200" src={Icons.Delete} />
                </IconButton>
              </Box>
            )}
          </Box>

          <Box direction="Column" gap="100">
            <Text size="L400">Tags</Text>
            <Input
              variant="Surface"
              size="400"
              outlined
              placeholder="comma, separated, tags"
              maxLength={500}
              value={tags}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTags(e.target.value)}
            />
          </Box>

          <Box alignItems="Center" gap="500">
            <Box alignItems="Center" gap="200">
              <Switch variant="Primary" value={isPrivate} onChange={setIsPrivate} />
              <Text size="T300">Private</Text>
            </Box>
            <Box alignItems="Center" gap="200">
              <Switch variant="Primary" value={nsfw} onChange={setNsfw} />
              <Text size="T300">NSFW</Text>
            </Box>
          </Box>

          <Button
            className={css.GifEditBtnTransition}
            variant="Secondary"
            size="400"
            radii="300"
            fill="Soft"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            before={<Icon size="100" src={UploadIcon} />}
          >
            <Text size="B400">Replace GIF file</Text>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/gif"
            style={{ display: 'none' }}
            onChange={handleReplaceChange}
          />

          {error && (
            <Text size="T300" style={{ color: color.Critical.Main }}>
              {error}
            </Text>
          )}

          <Box gap="200" style={{ alignSelf: 'stretch' }}>
            <Button
              className={css.GifEditBtnTransition}
              variant="Primary"
              size="400"
              radii="300"
              fill="Solid"
              disabled={busy || !hasChanges}
              onClick={handleSave}
              before={<Icon size="100" src={FloppyIcon} />}
              style={{ flexGrow: 1, flexBasis: 0 }}
            >
              <Text size="B400">Save</Text>
            </Button>
            <Button
              className={css.GifEditBtnTransition}
              variant="Secondary"
              size="400"
              radii="300"
              fill="Soft"
              disabled={busy}
              onClick={onClose}
              style={{ flexGrow: 1, flexBasis: 0 }}
            >
              <Text size="B400">Cancel</Text>
            </Button>
          </Box>
        </Box>
      </Dialog>
    </OverlayModal>
  );
}

type GifBoardProps = {
  tab: EmojiBoardTab;
  onTabChange?: (tab: EmojiBoardTab) => void;
  onBackClick?: () => void;
  onGifSelect?: (gif: GifItem) => void;
  requestClose: () => void;
};

export function GifBoard({
  tab,
  onTabChange,
  onBackClick,
  onGifSelect,
  requestClose,
}: GifBoardProps) {
  const mx = useMatrixClient();
  const myUserId = mx.getUserId();
  const [showNsfw, setShowNsfw] = useSetting(settingsAtom, 'gifShowNsfw');
  const [showHidden, setShowHidden] = useSetting(settingsAtom, 'gifShowHidden');
  const [editingGif, setEditingGif] = useState<GifItem | undefined>(undefined);

  const [activeSection, setActiveSection] = useState<GifSection>('all');
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  const sectionRef = useRef(activeSection);
  sectionRef.current = activeSection;
  const queryRef = useRef(query);
  queryRef.current = query;
  const nsfwRef = useRef(showNsfw);
  nsfwRef.current = showNsfw;
  const hiddenRef = useRef(showHidden);
  hiddenRef.current = showHidden;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const nextCursorRef = useRef(nextCursor);
  nextCursorRef.current = nextCursor;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<ItemRange>({ start: 0, end: INITIAL_ROWS });

  const rows = useMemo(() => {
    const grouped: GifItem[][] = [];
    for (let i = 0; i < gifs.length; i += COLUMNS) {
      grouped.push(gifs.slice(i, i + COLUMNS));
    }
    return grouped;
  }, [gifs]);

  const [prevRowCount, setPrevRowCount] = useState(rows.length);
  if (rows.length !== prevRowCount) {
    setPrevRowCount(rows.length);
    if (range.end > rows.length) {
      setRange({ start: Math.min(range.start, rows.length), end: rows.length });
    }
  }

  const getScrollElement = useCallback(() => scrollRef.current, []);
  const getItemElement = useCallback(
    (index: number) =>
      (scrollRef.current?.querySelector(`[data-gif-row="${index}"]`) as HTMLElement) ?? undefined,
    []
  );

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
    async (
      section: GifSection,
      q: string,
      nextShowNsfw: boolean,
      nextShowHidden: boolean,
      cursor?: string
    ) => {
      setLoading(true);
      try {
        const res = await loadSection(section, q, nextShowNsfw, nextShowHidden, cursor);
        setAuthError(false);
        if (cursor) {
          setGifs((prev) => [...prev, ...res.results]);
          // Re-trigger the paginator's fill-view effect (keyed on range identity)
          // so the window grows into the newly appended rows; the front anchor is
          // still intersecting, so IntersectionObserver alone won't re-fire.
          // TODO: this identity-only state write is a workaround for useVirtualPaginator
          // not re-evaluating on `count` change. Fix in the hook so consumers don't
          // need to poke `range`. Same pattern in timelineState.ts recalibratePagination.
          setRange((prev) => ({ ...prev }));
        } else {
          setGifs(res.results);
          setRange({ start: 0, end: INITIAL_ROWS });
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

  const handlePaginatorEnd = useCallback(
    (back: boolean) => {
      if (back || loadingRef.current || !nextCursorRef.current) return;
      loadGifs(
        sectionRef.current,
        queryRef.current,
        nsfwRef.current,
        hiddenRef.current,
        nextCursorRef.current
      );
    },
    [loadGifs]
  );

  const { getItems, observeBackAnchor, observeFrontAnchor } = useVirtualPaginator({
    count: rows.length,
    limit: ROW_PAGE_LIMIT,
    range,
    onRangeChange: setRange,
    getScrollElement,
    getItemElement,
    onEnd: handlePaginatorEnd,
  });

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
    loadGifs(activeSection, query, showNsfw, showHidden);
  }, [activeSection, query, showNsfw, showHidden, loadGifs]);

  useEffect(() => {
    let cancelled = false;
    collectFavoriteIds(showNsfw, showHidden, new Set<string>(), undefined, 0)
      .then((ids) => {
        if (!cancelled) setFavoriteIds(ids);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showNsfw, showHidden]);

  useEffect(() => {
    let cancelled = false;
    collectHiddenIds(showNsfw, new Set<string>(), undefined, 0)
      .then((ids) => {
        if (!cancelled) setHiddenIds(ids);
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

  const toggleHidden = useCallback(
    (gif: GifItem) => {
      const { id } = gif;
      const wasHidden = hiddenIds.has(id);
      setHiddenIds((prev) => {
        const next = new Set(prev);
        if (wasHidden) next.delete(id);
        else next.add(id);
        return next;
      });
      const action = wasHidden ? removeHidden(id) : addHidden(id);
      action.catch((e) => {
        console.error('GIF hide toggle failed', e);
        setHiddenIds((prev) => {
          const next = new Set(prev);
          if (wasHidden) next.add(id);
          else next.delete(id);
          return next;
        });
      });
      if (!wasHidden && !hiddenRef.current) {
        setGifs((prev) => prev.filter((g) => g.id !== id));
      }
    },
    [hiddenIds]
  );

  const handleToggleHidden: MouseEventHandler = useCallback(() => {
    if (contextMenuGif) toggleHidden(contextMenuGif);
    setContextMenuAnchor(undefined);
    setContextMenuGif(undefined);
  }, [contextMenuGif, toggleHidden]);

  const handleDownloadFromMenu: MouseEventHandler = useCallback(() => {
    const gif = contextMenuGif;
    setContextMenuAnchor(undefined);
    setContextMenuGif(undefined);
    if (!gif) return;
    fetchGifBlob(gif.renditions.original.url)
      .then((blob) => FileSaver.saveAs(blob, gif.filename))
      .catch((e) => console.error('GIF download failed', e));
  }, [contextMenuGif]);

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
    setHiddenIds((prev) => {
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
          rows={rows}
          getItems={getItems}
          observeBackAnchor={observeBackAnchor}
          observeFrontAnchor={observeFrontAnchor}
          myUserId={myUserId}
          showEditButton={activeSection === 'mine'}
          favoriteIds={favoriteIds}
          hiddenIds={hiddenIds}
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
      </>
    );
  };

  return (
    <>
      <EmojiBoardLayout
        header={
          <Box direction="Column" gap="200">
            <EmojiBoardHeaderRow tab={tab} onTabChange={onTabChange} onBack={onBackClick} />
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
                  aria-pressed={showNsfw || showHidden}
                  onClick={handleOpenFilter}
                >
                  <Icon src={Icons.Filter} size="100" filled={showNsfw || showHidden} />
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
          <Scroll ref={scrollRef} size="300" hideTrack>
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
                <Box direction="Column">
                  <Box
                    alignItems="Center"
                    justifyContent="SpaceBetween"
                    gap="200"
                    style={{ padding: config.space.S200 }}
                  >
                    <Text size="T300">Show NSFW</Text>
                    <Switch variant="Primary" value={showNsfw} onChange={setShowNsfw} />
                  </Box>
                  <Box
                    alignItems="Center"
                    justifyContent="SpaceBetween"
                    gap="200"
                    style={{ padding: config.space.S200 }}
                  >
                    <Text size="T300">Show hidden</Text>
                    <Switch variant="Primary" value={showHidden} onChange={setShowHidden} />
                  </Box>
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
                  <MenuItem
                    onClick={handleDownloadFromMenu}
                    size="300"
                    radii="300"
                    before={<Icon size="100" src={Icons.Download} />}
                  >
                    <Text size="T300">Download</Text>
                  </MenuItem>
                  <MenuItem
                    onClick={handleToggleHidden}
                    size="300"
                    radii="300"
                    before={
                      <Icon
                        size="100"
                        src={
                          contextMenuGif && hiddenIds.has(contextMenuGif.id)
                            ? Icons.Eye
                            : Icons.EyeBlind
                        }
                      />
                    }
                  >
                    <Text size="T300">
                      {contextMenuGif && hiddenIds.has(contextMenuGif.id) ? 'Unhide' : 'Hide'}
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
