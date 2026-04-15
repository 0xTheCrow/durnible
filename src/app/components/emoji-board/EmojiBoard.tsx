import type {
  ChangeEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
  RefObject,
} from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RectCords } from 'folds';
import {
  Box,
  config,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  Scroll,
  Text,
  toRem,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { isKeyHotkey } from 'is-hotkey';
import type { Room } from 'matrix-js-sdk';
import type { PrimitiveAtom } from 'jotai';
import { atom, useAtom, useSetAtom } from 'jotai';
import { useVirtualizer } from '@tanstack/react-virtual';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import type { Emoji } from '../../plugins/emoji';
import { emojiGroups, emojis } from '../../plugins/emoji';
import { useEmojiGroupLabels } from './useEmojiGroupLabels';
import { useEmojiGroupIcons } from './useEmojiGroupIcons';
import { preventScrollWithArrowKey, stopPropagation } from '../../utils/keyboard';
import { useRelevantImagePacks } from '../../hooks/useImagePacks';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRecentEmoji } from '../../hooks/useRecentEmoji';
import { isUserId, mxcUrlToHttp } from '../../utils/matrix';
import { editableActiveElement, targetFromEvent } from '../../utils/dom';
import type { UseAsyncSearchOptions } from '../../hooks/useAsyncSearch';
import { useAsyncSearch } from '../../hooks/useAsyncSearch';
import { useThrottle } from '../../hooks/useThrottle';
import { addRecentEmoji } from '../../plugins/recent-emoji';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import type { ImagePack, PackImageReader } from '../../plugins/custom-emoji';
import { ImageUsage } from '../../plugins/custom-emoji';
import { getEmoticonSearchStr } from '../../plugins/utils';
import { useStickerPackOrder } from '../../hooks/useStickerPackOrder';
import { useFavoriteEmoji, useFavoriteEntries } from '../../hooks/useFavoriteEmoji';
import {
  addFavoriteEmoji,
  removeFavoriteEmoji,
  isFavoriteEmoji,
} from '../../plugins/favorite-emoji';
import type { PreviewData } from './components';
import {
  SearchInput,
  EmojiBoardTabs,
  SidebarStack,
  SidebarDivider,
  Sidebar,
  NoStickerPacks,
  createPreviewDataAtom,
  Preview,
  EmojiItem,
  StickerItem,
  CustomEmojiItem,
  DraggableImageGroupIcon,
  GroupIcon,
  DraggableGroupIcon,
  MobileSortableGroupIcon,
  MobileSortableImageGroupIcon,
  getEmojiItemInfo,
  EmojiGroup,
  EmojiBoardLayout,
} from './components';
import { useScreenSize, ScreenSize } from '../../hooks/useScreenSize';
import type { EmojiItemInfo } from './types';
import { EmojiBoardTab, EmojiType } from './types';
import { VirtualTile } from '../virtualizer';

const RECENT_GROUP_ID = 'recent_group';
const FAVORITES_GROUP_ID = 'favorites_group';
const SEARCH_GROUP_ID = 'search_group';

type EmojiGroupItem = {
  id: string;
  name: string;
  items: Array<Emoji | PackImageReader>;
};
type StickerGroupItem = {
  id: string;
  name: string;
  items: Array<PackImageReader>;
};

const useGroups = (
  tab: EmojiBoardTab,
  imagePacks: ImagePack[],
  packOrder: string[],
  favoriteEmojis: Array<Emoji | PackImageReader>
): [EmojiGroupItem[], StickerGroupItem[]] => {
  const mx = useMatrixClient();

  const recentEmojis = useRecentEmoji(mx, 21);
  const labels = useEmojiGroupLabels();

  const emojiGroupItems = useMemo(() => {
    if (tab !== EmojiBoardTab.Emoji) return [];

    const recentGroup: EmojiGroupItem = {
      id: RECENT_GROUP_ID,
      name: 'Recent',
      items: recentEmojis,
    };

    const favoritesGroup: EmojiGroupItem = {
      id: FAVORITES_GROUP_ID,
      name: 'Favorites',
      items: favoriteEmojis,
    };

    const packGroups: EmojiGroupItem[] = imagePacks.map((pack) => {
      let label = pack.meta.name;
      if (!label) label = isUserId(pack.id) ? 'Personal Pack' : mx.getRoom(pack.id)?.name;
      return {
        id: pack.id,
        name: label ?? 'Unknown',
        items: pack
          .getImages(ImageUsage.Emoticon)
          .sort((a, b) => a.shortcode.localeCompare(b.shortcode)),
      };
    });

    const reorderableGroups = [
      recentGroup,
      ...(favoriteEmojis.length > 0 ? [favoritesGroup] : []),
      ...packGroups,
    ];
    if (packOrder.length > 0) {
      const orderMap = new Map(packOrder.map((id, i) => [id, i]));
      reorderableGroups.sort((a, b) => {
        const ai = orderMap.get(a.id) ?? Infinity;
        const bi = orderMap.get(b.id) ?? Infinity;
        return ai - bi;
      });
    }

    const g: EmojiGroupItem[] = [...reorderableGroups];

    emojiGroups.forEach((group) => {
      g.push({
        id: group.id,
        name: labels[group.id],
        items: group.emojis,
      });
    });

    return g;
  }, [mx, recentEmojis, favoriteEmojis, labels, imagePacks, tab, packOrder]);

  const stickerGroupItems = useMemo(() => {
    const g: StickerGroupItem[] = [];
    if (tab !== EmojiBoardTab.Sticker) return g;

    const stickerFavorites = favoriteEmojis.filter(
      (item): item is PackImageReader => !('unicode' in item)
    );
    if (stickerFavorites.length > 0) {
      g.push({
        id: FAVORITES_GROUP_ID,
        name: 'Favorites',
        items: stickerFavorites,
      });
    }

    imagePacks.forEach((pack) => {
      let label = pack.meta.name;
      if (!label) label = isUserId(pack.id) ? 'Personal Pack' : mx.getRoom(pack.id)?.name;

      g.push({
        id: pack.id,
        name: label ?? 'Unknown',
        items: pack
          .getImages(ImageUsage.Sticker)
          .sort((a, b) => a.shortcode.localeCompare(b.shortcode)),
      });
    });

    if (packOrder.length > 0) {
      const orderMap = new Map(packOrder.map((id, i) => [id, i]));
      g.sort((a, b) => {
        const ai = orderMap.get(a.id) ?? Infinity;
        const bi = orderMap.get(b.id) ?? Infinity;
        return ai - bi;
      });
    }

    return g;
  }, [mx, imagePacks, tab, favoriteEmojis, packOrder]);

  return [emojiGroupItems, stickerGroupItems];
};

const useItemRenderer = (tab: EmojiBoardTab) => {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const renderItem = (emoji: Emoji | PackImageReader, index: number) => {
    if ('unicode' in emoji) {
      return <EmojiItem key={emoji.unicode + index} emoji={emoji} />;
    }
    if (tab === EmojiBoardTab.Sticker) {
      return (
        <StickerItem
          key={emoji.shortcode + index}
          mx={mx}
          useAuthentication={useAuthentication}
          image={emoji}
        />
      );
    }
    return (
      <CustomEmojiItem
        key={emoji.shortcode + index}
        mx={mx}
        useAuthentication={useAuthentication}
        image={emoji}
      />
    );
  };

  return renderItem;
};

type EmojiSidebarProps = {
  activeGroupAtom: PrimitiveAtom<string | undefined>;
  packs: ImagePack[];
  packOrder: string[];
  hasFavorites: boolean;
  onScrollToGroup: (groupId: string) => void;
  setPackOrder: (ids: string[]) => void;
};
function EmojiSidebar({
  activeGroupAtom,
  packs,
  packOrder,
  hasFavorites,
  onScrollToGroup,
  setPackOrder,
}: EmojiSidebarProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const [activeGroupId, setActiveGroupId] = useAtom(activeGroupAtom);
  const usage = ImageUsage.Emoticon;
  const labels = useEmojiGroupLabels();
  const icons = useEmojiGroupIcons();
  const isMobile = useScreenSize() !== ScreenSize.Desktop;
  const [reorderMode, setReorderMode] = useState(false);

  const handleScrollToGroup = (groupId: string) => {
    setActiveGroupId(groupId);
    onScrollToGroup(groupId);
  };

  const reorderableIds = useMemo(() => {
    const packIds = packs.map((p) => p.id);
    const specialIds = hasFavorites ? [RECENT_GROUP_ID, FAVORITES_GROUP_ID] : [RECENT_GROUP_ID];
    // Insert each special ID at its correct position per packOrder
    for (const specialId of specialIds) {
      const idx = packOrder.indexOf(specialId);
      if (idx < 0) {
        // Not in packOrder, prepend (recent first, then favorites)
        packIds.splice(
          specialId === RECENT_GROUP_ID ? 0 : Math.min(1, packIds.length),
          0,
          specialId
        );
      } else {
        const packIdSet = new Set(packIds);
        const insertAt = packOrder.slice(0, idx).filter((id) => packIdSet.has(id)).length;
        packIds.splice(insertAt, 0, specialId);
      }
    }
    return packIds;
  }, [packs, packOrder, hasFavorites]);

  const handleMoveUp = useCallback(
    (id: string) => {
      const idx = reorderableIds.indexOf(id);
      if (idx <= 0) return;
      const newIds = [...reorderableIds];
      [newIds[idx - 1], newIds[idx]] = [newIds[idx], newIds[idx - 1]];
      setPackOrder(newIds);
    },
    [reorderableIds, setPackOrder]
  );

  const handleMoveDown = useCallback(
    (id: string) => {
      const idx = reorderableIds.indexOf(id);
      if (idx < 0 || idx >= reorderableIds.length - 1) return;
      const newIds = [...reorderableIds];
      [newIds[idx + 1], newIds[idx]] = [newIds[idx], newIds[idx + 1]];
      setPackOrder(newIds);
    },
    [reorderableIds, setPackOrder]
  );

  useEffect(
    () =>
      monitorForElements({
        onDrop: ({ source, location }) => {
          const { dropTargets } = location.current;
          if (dropTargets.length === 0) return;
          const draggedId = source.data.packId as string;
          const targetId = dropTargets[0].data.packId as string;
          const instructionType = dropTargets[0].data.instructionType as string | undefined;
          if (!instructionType || !draggedId || !targetId) return;

          const currentIds = [...reorderableIds];
          const fromIndex = currentIds.indexOf(draggedId);
          if (fromIndex < 0) return;

          const without = currentIds.filter((id) => id !== draggedId);
          const targetIndex = without.indexOf(targetId);
          if (targetIndex < 0) return;

          const insertIndex = instructionType === 'reorder-above' ? targetIndex : targetIndex + 1;
          without.splice(insertIndex, 0, draggedId);
          setPackOrder(without);
        },
      }),
    [reorderableIds, setPackOrder]
  );

  const sortedItems = useMemo(() => {
    type SidebarItem =
      | { type: 'recent' }
      | { type: 'favorites' }
      | { type: 'pack'; pack: ImagePack };
    const items: SidebarItem[] = [
      { type: 'recent' },
      ...(hasFavorites ? [{ type: 'favorites' as const }] : []),
      ...packs.map((pack) => ({ type: 'pack' as const, pack })),
    ];
    if (packOrder.length > 0) {
      const orderMap = new Map(packOrder.map((id, i) => [id, i]));
      items.sort((a, b) => {
        const aId =
          a.type === 'recent'
            ? RECENT_GROUP_ID
            : a.type === 'favorites'
            ? FAVORITES_GROUP_ID
            : a.pack.id;
        const bId =
          b.type === 'recent'
            ? RECENT_GROUP_ID
            : b.type === 'favorites'
            ? FAVORITES_GROUP_ID
            : b.pack.id;
        const ai = orderMap.get(aId) ?? Infinity;
        const bi = orderMap.get(bId) ?? Infinity;
        return ai - bi;
      });
    }
    return items;
  }, [packs, packOrder, hasFavorites]);

  return (
    <Sidebar>
      <SidebarStack>
        {isMobile && reorderMode && (
          <IconButton
            size="300"
            radii="300"
            variant="Primary"
            onClick={() => setReorderMode(false)}
            aria-label="Done reordering"
          >
            <Icon size="100" src={Icons.Check} />
          </IconButton>
        )}
        {sortedItems.map((item) => {
          const id =
            item.type === 'recent'
              ? RECENT_GROUP_ID
              : item.type === 'favorites'
              ? FAVORITES_GROUP_ID
              : item.pack.id;
          const idx = reorderableIds.indexOf(id);

          if (item.type === 'recent') {
            if (isMobile) {
              return (
                <MobileSortableGroupIcon
                  key={RECENT_GROUP_ID}
                  active={activeGroupId === RECENT_GROUP_ID}
                  id={RECENT_GROUP_ID}
                  label="Recent"
                  icon={Icons.RecentClock}
                  reorderMode={reorderMode}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < reorderableIds.length - 1}
                  onClick={handleScrollToGroup}
                  onLongPress={() => setReorderMode(true)}
                  onMoveUp={() => handleMoveUp(RECENT_GROUP_ID)}
                  onMoveDown={() => handleMoveDown(RECENT_GROUP_ID)}
                />
              );
            }
            return (
              <DraggableGroupIcon
                key={RECENT_GROUP_ID}
                active={activeGroupId === RECENT_GROUP_ID}
                id={RECENT_GROUP_ID}
                label="Recent"
                icon={Icons.RecentClock}
                onClick={handleScrollToGroup}
              />
            );
          }
          if (item.type === 'favorites') {
            if (isMobile) {
              return (
                <MobileSortableGroupIcon
                  key={FAVORITES_GROUP_ID}
                  active={activeGroupId === FAVORITES_GROUP_ID}
                  id={FAVORITES_GROUP_ID}
                  label="Favorites"
                  icon={Icons.Star}
                  reorderMode={reorderMode}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < reorderableIds.length - 1}
                  onClick={handleScrollToGroup}
                  onLongPress={() => setReorderMode(true)}
                  onMoveUp={() => handleMoveUp(FAVORITES_GROUP_ID)}
                  onMoveDown={() => handleMoveDown(FAVORITES_GROUP_ID)}
                />
              );
            }
            return (
              <DraggableGroupIcon
                key={FAVORITES_GROUP_ID}
                active={activeGroupId === FAVORITES_GROUP_ID}
                id={FAVORITES_GROUP_ID}
                label="Favorites"
                icon={Icons.Star}
                onClick={handleScrollToGroup}
              />
            );
          }
          const { pack } = item;
          let label = pack.meta.name;
          if (!label) label = isUserId(pack.id) ? 'Personal Pack' : mx.getRoom(pack.id)?.name;

          const url =
            mxcUrlToHttp(mx, pack.getAvatarUrl(usage) ?? '', useAuthentication) || pack.meta.avatar;

          if (isMobile) {
            return (
              <MobileSortableImageGroupIcon
                key={pack.id}
                active={activeGroupId === pack.id}
                id={pack.id}
                label={label ?? 'Unknown Pack'}
                url={url}
                reorderMode={reorderMode}
                canMoveUp={idx > 0}
                canMoveDown={idx < reorderableIds.length - 1}
                onClick={handleScrollToGroup}
                onLongPress={() => setReorderMode(true)}
                onMoveUp={() => handleMoveUp(pack.id)}
                onMoveDown={() => handleMoveDown(pack.id)}
              />
            );
          }
          return (
            <DraggableImageGroupIcon
              key={pack.id}
              active={activeGroupId === pack.id}
              id={pack.id}
              label={label ?? 'Unknown Pack'}
              url={url}
              onClick={handleScrollToGroup}
            />
          );
        })}
      </SidebarStack>
      <SidebarStack
        style={{
          position: 'sticky',
          bottom: '-67%',
          zIndex: 1,
        }}
      >
        <SidebarDivider />
        {emojiGroups.map((group) => (
          <GroupIcon
            key={group.id}
            active={activeGroupId === group.id}
            id={group.id}
            label={labels[group.id]}
            icon={icons[group.id]}
            onClick={handleScrollToGroup}
          />
        ))}
      </SidebarStack>
    </Sidebar>
  );
}

type StickerSidebarProps = {
  activeGroupAtom: PrimitiveAtom<string | undefined>;
  packs: ImagePack[];
  packOrder: string[];
  hasFavorites: boolean;
  onScrollToGroup: (groupId: string) => void;
  setPackOrder: (ids: string[]) => void;
};
function StickerSidebar({
  activeGroupAtom,
  packs,
  packOrder,
  hasFavorites,
  onScrollToGroup,
  setPackOrder,
}: StickerSidebarProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const [activeGroupId, setActiveGroupId] = useAtom(activeGroupAtom);
  const usage = ImageUsage.Sticker;
  const isMobile = useScreenSize() !== ScreenSize.Desktop;
  const [reorderMode, setReorderMode] = useState(false);

  const handleScrollToGroup = (groupId: string) => {
    setActiveGroupId(groupId);
    onScrollToGroup(groupId);
  };

  const reorderableIds = useMemo(() => {
    const ids = packs.map((p) => p.id);
    if (hasFavorites) {
      const favIdx = packOrder.indexOf(FAVORITES_GROUP_ID);
      if (favIdx < 0) {
        ids.unshift(FAVORITES_GROUP_ID);
      } else {
        const idSet = new Set(ids);
        const insertAt = packOrder.slice(0, favIdx).filter((id) => idSet.has(id)).length;
        ids.splice(insertAt, 0, FAVORITES_GROUP_ID);
      }
    }
    return ids;
  }, [packs, packOrder, hasFavorites]);

  const handleMoveUp = useCallback(
    (id: string) => {
      const idx = reorderableIds.indexOf(id);
      if (idx <= 0) return;
      const newIds = [...reorderableIds];
      [newIds[idx - 1], newIds[idx]] = [newIds[idx], newIds[idx - 1]];
      setPackOrder(newIds);
    },
    [reorderableIds, setPackOrder]
  );

  const handleMoveDown = useCallback(
    (id: string) => {
      const idx = reorderableIds.indexOf(id);
      if (idx < 0 || idx >= reorderableIds.length - 1) return;
      const newIds = [...reorderableIds];
      [newIds[idx + 1], newIds[idx]] = [newIds[idx], newIds[idx + 1]];
      setPackOrder(newIds);
    },
    [reorderableIds, setPackOrder]
  );

  useEffect(
    () =>
      monitorForElements({
        onDrop: ({ source, location }) => {
          const { dropTargets } = location.current;
          if (dropTargets.length === 0) return;
          const draggedId = source.data.packId as string;
          const targetId = dropTargets[0].data.packId as string;
          const instructionType = dropTargets[0].data.instructionType as string | undefined;
          if (!instructionType || !draggedId || !targetId) return;

          const currentIds = [...reorderableIds];
          const fromIndex = currentIds.indexOf(draggedId);
          if (fromIndex < 0) return;

          const without = currentIds.filter((id) => id !== draggedId);
          const targetIndex = without.indexOf(targetId);
          if (targetIndex < 0) return;

          const insertIndex = instructionType === 'reorder-above' ? targetIndex : targetIndex + 1;
          without.splice(insertIndex, 0, draggedId);
          setPackOrder(without);
        },
      }),
    [reorderableIds, setPackOrder]
  );

  const sortedItems = useMemo(() => {
    type SidebarItem = { type: 'favorites' } | { type: 'pack'; pack: ImagePack };
    const items: SidebarItem[] = [
      ...(hasFavorites ? [{ type: 'favorites' as const }] : []),
      ...packs.map((pack) => ({ type: 'pack' as const, pack })),
    ];
    if (packOrder.length > 0) {
      const orderMap = new Map(packOrder.map((id, i) => [id, i]));
      items.sort((a, b) => {
        const aId = a.type === 'favorites' ? FAVORITES_GROUP_ID : a.pack.id;
        const bId = b.type === 'favorites' ? FAVORITES_GROUP_ID : b.pack.id;
        const ai = orderMap.get(aId) ?? Infinity;
        const bi = orderMap.get(bId) ?? Infinity;
        return ai - bi;
      });
    }
    return items;
  }, [packs, packOrder, hasFavorites]);

  return (
    <Sidebar>
      <SidebarStack>
        {isMobile && reorderMode && (
          <IconButton
            size="300"
            radii="300"
            variant="Primary"
            onClick={() => setReorderMode(false)}
            aria-label="Done reordering"
          >
            <Icon size="100" src={Icons.Check} />
          </IconButton>
        )}
        {sortedItems.map((item) => {
          const id = item.type === 'favorites' ? FAVORITES_GROUP_ID : item.pack.id;
          const idx = reorderableIds.indexOf(id);

          if (item.type === 'favorites') {
            if (isMobile) {
              return (
                <MobileSortableGroupIcon
                  key={FAVORITES_GROUP_ID}
                  active={activeGroupId === FAVORITES_GROUP_ID}
                  id={FAVORITES_GROUP_ID}
                  label="Favorites"
                  icon={Icons.Star}
                  reorderMode={reorderMode}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < reorderableIds.length - 1}
                  onClick={handleScrollToGroup}
                  onLongPress={() => setReorderMode(true)}
                  onMoveUp={() => handleMoveUp(FAVORITES_GROUP_ID)}
                  onMoveDown={() => handleMoveDown(FAVORITES_GROUP_ID)}
                />
              );
            }
            return (
              <DraggableGroupIcon
                key={FAVORITES_GROUP_ID}
                active={activeGroupId === FAVORITES_GROUP_ID}
                id={FAVORITES_GROUP_ID}
                label="Favorites"
                icon={Icons.Star}
                onClick={handleScrollToGroup}
              />
            );
          }
          const { pack } = item;
          let label = pack.meta.name;
          if (!label) label = isUserId(pack.id) ? 'Personal Pack' : mx.getRoom(pack.id)?.name;

          const url =
            mxcUrlToHttp(mx, pack.getAvatarUrl(usage) ?? '', useAuthentication) || pack.meta.avatar;

          if (isMobile) {
            return (
              <MobileSortableImageGroupIcon
                key={pack.id}
                active={activeGroupId === pack.id}
                id={pack.id}
                label={label ?? 'Unknown Pack'}
                url={url}
                reorderMode={reorderMode}
                canMoveUp={idx > 0}
                canMoveDown={idx < reorderableIds.length - 1}
                onClick={handleScrollToGroup}
                onLongPress={() => setReorderMode(true)}
                onMoveUp={() => handleMoveUp(pack.id)}
                onMoveDown={() => handleMoveDown(pack.id)}
              />
            );
          }
          return (
            <DraggableImageGroupIcon
              key={pack.id}
              active={activeGroupId === pack.id}
              id={pack.id}
              label={label ?? 'Unknown Pack'}
              url={url}
              onClick={handleScrollToGroup}
            />
          );
        })}
      </SidebarStack>
    </Sidebar>
  );
}

type EmojiGroupHolderProps = {
  contentScrollRef: RefObject<HTMLDivElement>;
  previewAtom: PrimitiveAtom<PreviewData | undefined>;
  children?: ReactNode;
  onGroupItemClick: MouseEventHandler;
  onGroupItemContextMenu?: MouseEventHandler;
};
function EmojiGroupHolder({
  contentScrollRef,
  previewAtom,
  onGroupItemClick,
  onGroupItemContextMenu,
  children,
}: EmojiGroupHolderProps) {
  const setPreviewData = useSetAtom(previewAtom);

  const handleEmojiPreview = useCallback(
    (element: HTMLButtonElement) => {
      const emojiInfo = getEmojiItemInfo(element);
      if (!emojiInfo) return;

      setPreviewData({
        key: emojiInfo.data,
        shortcode: emojiInfo.shortcode,
      });
    },
    [setPreviewData]
  );

  const throttleEmojiHover = useThrottle(handleEmojiPreview, {
    wait: 200,
    immediate: true,
  });

  const handleEmojiHover: MouseEventHandler = (evt) => {
    const targetEl = targetFromEvent(evt.nativeEvent, 'button') as HTMLButtonElement | undefined;
    if (!targetEl) return;
    throttleEmojiHover(targetEl);
  };

  const handleEmojiFocus: FocusEventHandler = (evt) => {
    const targetEl = evt.target as HTMLButtonElement;
    handleEmojiPreview(targetEl);
  };

  return (
    <Scroll ref={contentScrollRef} size="400" onKeyDown={preventScrollWithArrowKey} hideTrack>
      <Box
        onClick={onGroupItemClick}
        onContextMenu={onGroupItemContextMenu}
        onMouseMove={handleEmojiHover}
        onFocus={handleEmojiFocus}
        direction="Column"
      >
        {children}
      </Box>
    </Scroll>
  );
}

const DefaultEmojiPreview: PreviewData = { key: '🙂', shortcode: 'slight_smile' };

const SEARCH_OPTIONS: UseAsyncSearchOptions = {
  limit: 1000,
  matchOptions: {
    contain: true,
  },
};

const VIRTUAL_OVER_SCAN = 2;

type EmojiBoardProps = {
  tab?: EmojiBoardTab;
  onTabChange?: (tab: EmojiBoardTab) => void;
  imagePackRooms: Room[];
  requestClose: () => void;
  returnFocusOnDeactivate?: boolean;
  onEmojiSelect?: (unicode: string, shortcode: string) => void;
  onCustomEmojiSelect?: (mxc: string, shortcode: string) => void;
  onStickerSelect?: (mxc: string, shortcode: string, label: string) => void;
  allowTextCustomEmoji?: boolean;
  addToRecentEmoji?: boolean;
};

export function EmojiBoard({
  tab = EmojiBoardTab.Emoji,
  onTabChange,
  imagePackRooms,
  requestClose,
  returnFocusOnDeactivate,
  onEmojiSelect,
  onCustomEmojiSelect,
  onStickerSelect,
  allowTextCustomEmoji,
  addToRecentEmoji = true,
}: EmojiBoardProps) {
  const mx = useMatrixClient();

  const emojiTab = tab === EmojiBoardTab.Emoji;
  const usage = emojiTab ? ImageUsage.Emoticon : ImageUsage.Sticker;

  const previewAtom = useMemo(
    () => createPreviewDataAtom(emojiTab ? DefaultEmojiPreview : undefined),
    [emojiTab]
  );
  const activeGroupIdAtom = useMemo(() => atom<string | undefined>(undefined), []);
  const setActiveGroupId = useSetAtom(activeGroupIdAtom);
  const rawImagePacks = useRelevantImagePacks(usage, imagePackRooms);
  const [packOrder, setPackOrder] = useStickerPackOrder();

  const favoriteEmojis = useFavoriteEmoji(mx);
  const favoriteEntries = useFavoriteEntries(mx);

  const imagePacks = useMemo(() => {
    if (packOrder.length === 0) return rawImagePacks;
    const orderMap = new Map(packOrder.map((id, i) => [id, i]));
    return [...rawImagePacks].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? Infinity;
      const bi = orderMap.get(b.id) ?? Infinity;
      return ai - bi;
    });
  }, [rawImagePacks, packOrder]);

  const [emojiGroupItems, stickerGroupItems] = useGroups(
    tab,
    imagePacks,
    packOrder,
    favoriteEmojis
  );
  const groups = emojiTab ? emojiGroupItems : stickerGroupItems;
  const renderItem = useItemRenderer(tab);

  const searchList = useMemo(() => {
    let list: Array<PackImageReader | Emoji> = [];
    list = list.concat(imagePacks.flatMap((pack) => pack.getImages(usage)));
    if (emojiTab) list = list.concat(emojis);
    return list;
  }, [emojiTab, usage, imagePacks]);

  const [result, search, resetSearch] = useAsyncSearch(
    searchList,
    getEmoticonSearchStr,
    SEARCH_OPTIONS
  );

  const searchedItems = result?.items.slice(0, 100);

  const handleOnChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (evt) => {
      const term = evt.target.value;
      if (term) search(term);
      else resetSearch();
    },
    [search, resetSearch]
  );

  const contentScrollRef = useRef<HTMLDivElement>(null);
  const virtualBaseRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => contentScrollRef.current,
    estimateSize: () => 40,
    overscan: VIRTUAL_OVER_SCAN,
  });
  const vItems = virtualizer.getVirtualItems();

  const [contextMenuAnchor, setContextMenuAnchor] = useState<RectCords>();
  const [contextMenuEmojiInfo, setContextMenuEmojiInfo] = useState<EmojiItemInfo>();

  const handleGroupItemContextMenu: MouseEventHandler = (evt) => {
    evt.preventDefault();
    const targetEl = targetFromEvent(evt.nativeEvent, 'button');
    const emojiInfo = targetEl && getEmojiItemInfo(targetEl);
    if (!emojiInfo) return;
    const rect = (targetEl as HTMLElement).getBoundingClientRect();
    setContextMenuAnchor({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
    setContextMenuEmojiInfo(emojiInfo);
  };

  const handleToggleFavorite = () => {
    if (!contextMenuEmojiInfo) return;
    const { type, data, shortcode, label } = contextMenuEmojiInfo;
    if (isFavoriteEmoji(favoriteEntries, type, data)) {
      removeFavoriteEmoji(mx, type, data);
    } else {
      addFavoriteEmoji(mx, {
        type: type as 'emoji' | 'customEmoji' | 'sticker',
        data,
        shortcode,
        label,
      });
    }
    setContextMenuAnchor(undefined);
    setContextMenuEmojiInfo(undefined);
  };

  const selectEmojiInfo = (emojiInfo: EmojiItemInfo, altKey: boolean, shiftKey: boolean) => {
    if (emojiInfo.type === EmojiType.Emoji) {
      onEmojiSelect?.(emojiInfo.data, emojiInfo.shortcode);
      if (!altKey && !shiftKey && addToRecentEmoji) {
        addRecentEmoji(mx, emojiInfo.data);
      }
    }
    if (emojiInfo.type === EmojiType.CustomEmoji) {
      onCustomEmojiSelect?.(emojiInfo.data, emojiInfo.shortcode);
    }
    if (emojiInfo.type === EmojiType.Sticker) {
      onStickerSelect?.(emojiInfo.data, emojiInfo.shortcode, emojiInfo.label);
    }
    if (!altKey && !shiftKey) requestClose();
  };

  const handleGroupItemClick: MouseEventHandler = (evt) => {
    const targetEl = targetFromEvent(evt.nativeEvent, 'button');
    const emojiInfo = targetEl && getEmojiItemInfo(targetEl);
    if (!emojiInfo) return;
    selectEmojiInfo(emojiInfo, evt.altKey, evt.shiftKey);
  };

  const handleSearchKeyDown: KeyboardEventHandler<HTMLInputElement> = (evt) => {
    if (evt.nativeEvent.isComposing) return;
    if (!isKeyHotkey('enter', evt)) return;
    const firstItem = searchedItems?.[0];
    if (!firstItem) return;
    evt.preventDefault();
    const emojiInfo: EmojiItemInfo =
      'unicode' in firstItem
        ? {
            type: EmojiType.Emoji,
            data: firstItem.unicode,
            shortcode: firstItem.shortcode,
            label: firstItem.label,
          }
        : {
            type: tab === EmojiBoardTab.Sticker ? EmojiType.Sticker : EmojiType.CustomEmoji,
            data: firstItem.url,
            shortcode: firstItem.shortcode,
            label: firstItem.body || firstItem.shortcode,
          };
    selectEmojiInfo(emojiInfo, evt.altKey, evt.shiftKey);
  };

  const handleTextCustomEmojiSelect = (textEmoji: string) => {
    onCustomEmojiSelect?.(textEmoji, textEmoji);
    requestClose();
  };

  const handleScrollToGroup = (groupId: string) => {
    const groupIndex = groups.findIndex((group) => group.id === groupId);
    virtualizer.scrollToIndex(groupIndex, { align: 'start' });
  };

  // sync active sidebar tab with scroll
  useEffect(() => {
    const scrollElement = contentScrollRef.current;
    if (scrollElement) {
      const scrollTop = scrollElement.offsetTop + scrollElement.scrollTop;
      const offsetTop = virtualBaseRef.current?.offsetTop ?? 0;
      const inViewVItem = vItems.find((vItem) => scrollTop < offsetTop + vItem.end);

      const group = inViewVItem ? groups[inViewVItem?.index] : undefined;
      setActiveGroupId(group?.id);
    }
  }, [vItems, groups, setActiveGroupId, result?.query]);

  // reset scroll position on search
  useEffect(() => {
    const scrollElement = contentScrollRef.current;
    if (scrollElement) {
      scrollElement.scrollTo({ top: 0 });
    }
  }, [result?.query]);

  // reset scroll position on tab change
  useEffect(() => {
    if (groups.length > 0) {
      virtualizer.scrollToIndex(0, { align: 'start' });
    }
  }, [tab, virtualizer, groups]);

  return (
    <>
      <FocusTrap
        focusTrapOptions={{
          returnFocusOnDeactivate,
          initialFocus: false,
          onDeactivate: requestClose,
          clickOutsideDeactivates: true,
          allowOutsideClick: true,
          isKeyForward: (evt: KeyboardEvent) =>
            !editableActiveElement() && isKeyHotkey(['arrowdown', 'arrowright'], evt),
          isKeyBackward: (evt: KeyboardEvent) =>
            !editableActiveElement() && isKeyHotkey(['arrowup', 'arrowleft'], evt),
          escapeDeactivates: (evt: KeyboardEvent) => {
            evt.stopPropagation();
            return true;
          },
        }}
      >
        <EmojiBoardLayout
          header={
            <Box direction="Column" gap="200">
              {onTabChange && <EmojiBoardTabs tab={tab} onTabChange={onTabChange} />}
              <SearchInput
                key={tab}
                query={result?.query}
                onChange={handleOnChange}
                onKeyDown={handleSearchKeyDown}
                allowTextCustomEmoji={allowTextCustomEmoji}
                onTextCustomEmojiSelect={handleTextCustomEmojiSelect}
              />
            </Box>
          }
          sidebar={
            emojiTab ? (
              <EmojiSidebar
                activeGroupAtom={activeGroupIdAtom}
                packs={imagePacks}
                packOrder={packOrder}
                hasFavorites={emojiGroupItems.some((g) => g.id === FAVORITES_GROUP_ID)}
                onScrollToGroup={handleScrollToGroup}
                setPackOrder={setPackOrder}
              />
            ) : (
              <StickerSidebar
                activeGroupAtom={activeGroupIdAtom}
                packs={imagePacks}
                packOrder={packOrder}
                hasFavorites={stickerGroupItems.some((g) => g.id === FAVORITES_GROUP_ID)}
                onScrollToGroup={handleScrollToGroup}
                setPackOrder={setPackOrder}
              />
            )
          }
        >
          <Box grow="Yes">
            <EmojiGroupHolder
              key={tab}
              contentScrollRef={contentScrollRef}
              previewAtom={previewAtom}
              onGroupItemClick={handleGroupItemClick}
              onGroupItemContextMenu={handleGroupItemContextMenu}
            >
              {searchedItems && (
                <EmojiGroup
                  id={SEARCH_GROUP_ID}
                  label={searchedItems.length ? 'Search Results' : 'No Results found'}
                >
                  {searchedItems.map(renderItem)}
                </EmojiGroup>
              )}
              <div
                ref={virtualBaseRef}
                style={{
                  position: 'relative',
                  height: virtualizer.getTotalSize(),
                }}
              >
                {vItems.map((vItem) => {
                  const group = groups[vItem.index];

                  return (
                    <VirtualTile
                      virtualItem={vItem}
                      style={{ paddingTop: config.space.S200 }}
                      ref={virtualizer.measureElement}
                      key={vItem.index}
                    >
                      <EmojiGroup key={group.id} id={group.id} label={group.name}>
                        {group.items.map(renderItem)}
                      </EmojiGroup>
                    </VirtualTile>
                  );
                })}
              </div>
              {tab === EmojiBoardTab.Sticker && groups.length === 0 && <NoStickerPacks />}
            </EmojiGroupHolder>
          </Box>
          <Preview previewAtom={previewAtom} />
        </EmojiBoardLayout>
      </FocusTrap>
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
                  setContextMenuEmojiInfo(undefined);
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
                      {contextMenuEmojiInfo &&
                      isFavoriteEmoji(
                        favoriteEntries,
                        contextMenuEmojiInfo.type,
                        contextMenuEmojiInfo.data
                      )
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
