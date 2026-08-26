import type { Align, Position, RectCords } from 'folds';
import { PopOut } from 'folds';
import type { CSSProperties, ReactNode, Ref } from 'react';
import React, {
  forwardRef,
  lazy,
  Suspense,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { Room } from 'matrix-js-sdk';
import { EmojiBoardTab } from './types';
import type { GifItem } from '../../utils/gifServer';
import { useVisualViewportHeight } from '../../hooks/useVisualViewportHeight';
import { OverlayModal } from '../OverlayModal';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { EMOJI_BOARD_WIDTH_PX, EMOJI_BOARD_HEIGHT_PX } from './components/styles.css';

const EmojiBoard = lazy(() =>
  import('./EmojiBoard').then((module) => ({ default: module.EmojiBoard }))
);

const DEFAULT_OFFSET = 10;
const BREATHING_ROOM = 16;

const getRootFontSizePx = () =>
  parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

export type OpenAtRectOptions = {
  position?: Position;
  align?: Align;
  offset?: number;
  alignOffset?: number;
};

export type EmojiBoardWrapperHandle = {
  openAtRect: (rect: RectCords, options?: OpenAtRectOptions) => void;
};

export type EmojiBoardWrapperRenderProps = {
  triggerRef: Ref<HTMLButtonElement>;
  open: () => void;
  isOpen: boolean;
  tab: EmojiBoardTab | undefined;
};

export type EmojiBoardWrapperProps = {
  position?: Position;
  align?: Align;
  offset?: number;
  alignOffset?: number;

  imagePackRooms?: Room[];
  allowTextCustomEmoji?: boolean;
  returnFocusOnDeactivate?: boolean;
  addToRecentEmoji?: boolean;

  onEmojiSelect?: (unicode: string, shortcode: string) => void;
  onCustomEmojiSelect?: (mxc: string, shortcode: string) => void;
  onStickerSelect?: (mxc: string, shortcode: string, label: string) => void;
  onGifSelect?: (gif: GifItem) => void;

  onClose?: () => void;
  onOpenChange?: (isOpen: boolean) => void;

  children: (props: EmojiBoardWrapperRenderProps) => ReactNode;
};

export const EmojiBoardWrapper = forwardRef<EmojiBoardWrapperHandle, EmojiBoardWrapperProps>(
  (
    {
      position,
      align,
      offset,
      alignOffset,
      imagePackRooms,
      allowTextCustomEmoji,
      returnFocusOnDeactivate,
      addToRecentEmoji,
      onEmojiSelect,
      onCustomEmojiSelect,
      onStickerSelect,
      onGifSelect,
      onClose,
      onOpenChange,
      children,
    },
    ref
  ) => {
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const [tab, setTab] = useState<EmojiBoardTab | undefined>(undefined);
    const [fallbackRect, setFallbackRect] = useState<RectCords | undefined>();
    const [overrides, setOverrides] = useState<OpenAtRectOptions | undefined>();
    const viewportHeight = useVisualViewportHeight();

    const isOpen = tab !== undefined;

    const open = useCallback(() => {
      setFallbackRect(undefined);
      setOverrides(undefined);
      setTab(EmojiBoardTab.Emoji);
      onOpenChange?.(true);
    }, [onOpenChange]);

    const close = useCallback(() => {
      setTab(undefined);
      setFallbackRect(undefined);
      setOverrides(undefined);
      onOpenChange?.(false);
      onClose?.();
    }, [onClose, onOpenChange]);

    useImperativeHandle(
      ref,
      () => ({
        openAtRect: (rect, options) => {
          setFallbackRect(rect);
          setOverrides(options);
          setTab(EmojiBoardTab.Emoji);
          onOpenChange?.(true);
        },
      }),
      [onOpenChange]
    );

    const isMobile = useScreenSizeContext() === ScreenSize.Mobile;

    const tabsEnabled = !!onStickerSelect || !!onGifSelect;

    const renderEmojiBoard = (inModal: boolean) => (
      <EmojiBoard
        tab={tab}
        onTabChange={tabsEnabled ? setTab : undefined}
        imagePackRooms={imagePackRooms ?? []}
        returnFocusOnDeactivate={returnFocusOnDeactivate}
        allowTextCustomEmoji={allowTextCustomEmoji}
        addToRecentEmoji={addToRecentEmoji}
        onEmojiSelect={onEmojiSelect}
        onCustomEmojiSelect={onCustomEmojiSelect}
        onStickerSelect={onStickerSelect}
        onGifSelect={onGifSelect}
        onClose={close}
        onBackClick={inModal ? close : undefined}
        handleOutsideClick={!inModal}
      />
    );

    if (isMobile) {
      return (
        <>
          {children({ triggerRef, open, isOpen, tab })}
          <Suspense fallback={null}>
            <OverlayModal
              open={isOpen}
              onClose={close}
              overlayProps={{ onContextMenu: (evt) => evt.stopPropagation() }}
            >
              {renderEmojiBoard(true)}
            </OverlayModal>
          </Suspense>
        </>
      );
    }

    const anchor = isOpen
      ? fallbackRect ?? triggerRef.current?.getBoundingClientRect() ?? undefined
      : undefined;

    const requestedPosition = overrides?.position ?? position;
    const effectiveOffset = overrides?.offset ?? offset ?? DEFAULT_OFFSET;
    const rootFontSizePx = getRootFontSizePx();
    const zoomScale = rootFontSizePx / 16;
    const emojiBoardWidth = EMOJI_BOARD_WIDTH_PX * zoomScale;
    const minUsableHeight = EMOJI_BOARD_HEIGHT_PX * zoomScale;

    let finalPosition = requestedPosition;
    let availableHeight: number | undefined;

    if (anchor && (requestedPosition === 'Top' || requestedPosition === 'Bottom')) {
      const spaceBelow =
        viewportHeight - (anchor.y + anchor.height) - effectiveOffset - BREATHING_ROOM;
      const spaceAbove = anchor.y - effectiveOffset - BREATHING_ROOM;

      if (requestedPosition === 'Bottom') {
        if (spaceBelow >= minUsableHeight || spaceBelow >= spaceAbove) {
          availableHeight = spaceBelow;
        } else {
          finalPosition = 'Top';
          availableHeight = spaceAbove;
        }
      } else if (spaceAbove >= minUsableHeight || spaceAbove >= spaceBelow) {
        availableHeight = spaceAbove;
      } else {
        finalPosition = 'Bottom';
        availableHeight = spaceBelow;
      }
    }

    const contentStyle: CSSProperties | undefined =
      availableHeight != null
        ? ({ '--emoji-board-max-height': `${Math.max(0, availableHeight)}px` } as CSSProperties)
        : undefined;

    const requestedAlign = overrides?.align ?? align ?? 'Center';
    const requestedAlignOffset = overrides?.alignOffset ?? alignOffset ?? 0;

    let finalAlign = requestedAlign;
    let finalAlignOffset = requestedAlignOffset;

    if (anchor) {
      const viewportWidth = document.documentElement.clientWidth;
      let idealLeft: number;
      if (requestedAlign === 'Start') {
        idealLeft = anchor.x + requestedAlignOffset;
      } else if (requestedAlign === 'End') {
        idealLeft = anchor.x + anchor.width - emojiBoardWidth - requestedAlignOffset;
      } else {
        idealLeft = anchor.x + anchor.width / 2 - emojiBoardWidth / 2 + requestedAlignOffset;
      }

      const minLeft = BREATHING_ROOM;
      const maxLeft = viewportWidth - emojiBoardWidth - BREATHING_ROOM;

      if (idealLeft < minLeft || idealLeft > maxLeft) {
        const clampedLeft = Math.min(Math.max(idealLeft, minLeft), Math.max(minLeft, maxLeft));
        finalAlign = 'Start';
        finalAlignOffset = clampedLeft - anchor.x;
      }
    }

    return (
      <PopOut
        position={finalPosition}
        align={finalAlign}
        offset={effectiveOffset}
        alignOffset={finalAlignOffset}
        anchor={anchor}
        content={
          <Suspense fallback={null}>
            <div style={contentStyle} onContextMenu={(evt) => evt.stopPropagation()}>
              {renderEmojiBoard(false)}
            </div>
          </Suspense>
        }
      >
        {children({ triggerRef, open, isOpen, tab })}
      </PopOut>
    );
  }
);
