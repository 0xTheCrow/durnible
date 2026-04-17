import type { Align, Position, RectCords } from 'folds';
import { PopOut } from 'folds';
import type { CSSProperties, ReactNode, Ref } from 'react';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import type { Room } from 'matrix-js-sdk';
import { EmojiBoard } from './EmojiBoard';
import { EmojiBoardTab } from './types';
import { useVisualViewportHeight } from '../../hooks/useVisualViewportHeight';
import { OverlayModal } from '../OverlayModal';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';

const DEFAULT_OFFSET = 10;
const BREATHING_ROOM = 16;
const MIN_USABLE_HEIGHT = 450;

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

    const renderEmojiBoard = (inModal: boolean) => (
      <EmojiBoard
        tab={tab}
        onTabChange={setTab}
        imagePackRooms={imagePackRooms ?? []}
        returnFocusOnDeactivate={returnFocusOnDeactivate}
        allowTextCustomEmoji={allowTextCustomEmoji}
        addToRecentEmoji={addToRecentEmoji}
        onEmojiSelect={onEmojiSelect}
        onCustomEmojiSelect={onCustomEmojiSelect}
        onStickerSelect={onStickerSelect}
        onClose={close}
        onBackClick={inModal ? close : undefined}
        handleOutsideClick={!inModal}
      />
    );

    if (isMobile) {
      return (
        <>
          {children({ triggerRef, open, isOpen, tab })}
          <OverlayModal open={isOpen} onClose={close}>
            {renderEmojiBoard(true)}
          </OverlayModal>
        </>
      );
    }

    const anchor = isOpen
      ? fallbackRect ?? triggerRef.current?.getBoundingClientRect() ?? undefined
      : undefined;

    const requestedPosition = overrides?.position ?? position;
    const effectiveOffset = overrides?.offset ?? offset ?? DEFAULT_OFFSET;

    let finalPosition = requestedPosition;
    let availableHeight: number | undefined;

    if (anchor && (requestedPosition === 'Top' || requestedPosition === 'Bottom')) {
      const spaceBelow =
        viewportHeight - (anchor.y + anchor.height) - effectiveOffset - BREATHING_ROOM;
      const spaceAbove = anchor.y - effectiveOffset - BREATHING_ROOM;

      if (requestedPosition === 'Bottom') {
        if (spaceBelow >= MIN_USABLE_HEIGHT || spaceBelow >= spaceAbove) {
          availableHeight = spaceBelow;
        } else {
          finalPosition = 'Top';
          availableHeight = spaceAbove;
        }
      } else if (spaceAbove >= MIN_USABLE_HEIGHT || spaceAbove >= spaceBelow) {
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

    return (
      <PopOut
        position={finalPosition}
        align={overrides?.align ?? align}
        offset={effectiveOffset}
        alignOffset={overrides?.alignOffset ?? alignOffset}
        anchor={anchor}
        content={<div style={contentStyle}>{renderEmojiBoard(false)}</div>}
      >
        {children({ triggerRef, open, isOpen, tab })}
      </PopOut>
    );
  }
);
