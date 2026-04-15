import type { Align, Position, RectCords } from 'folds';
import { PopOut } from 'folds';
import type { ReactNode, Ref } from 'react';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import type { Room } from 'matrix-js-sdk';
import { EmojiBoard } from './EmojiBoard';
import { EmojiBoardTab } from './types';
import { useVisualViewportHeight } from '../../hooks/useVisualViewportHeight';

export type OpenAtRectOptions = {
  position?: Position;
  align?: Align;
  offset?: number;
  alignOffset?: number;
};

export type EmojiBoardPopOutHandle = {
  openAtRect: (rect: RectCords, options?: OpenAtRectOptions) => void;
};

export type EmojiBoardPopOutRenderProps = {
  triggerRef: Ref<HTMLButtonElement>;
  open: () => void;
  isOpen: boolean;
  tab: EmojiBoardTab | undefined;
};

export type EmojiBoardPopOutProps = {
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

  children: (props: EmojiBoardPopOutRenderProps) => ReactNode;
};

export const EmojiBoardPopOut = forwardRef<EmojiBoardPopOutHandle, EmojiBoardPopOutProps>(
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
    useVisualViewportHeight();

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

    const anchor = isOpen
      ? fallbackRect ?? triggerRef.current?.getBoundingClientRect() ?? undefined
      : undefined;

    return (
      <PopOut
        position={overrides?.position ?? position}
        align={overrides?.align ?? align}
        offset={overrides?.offset ?? offset}
        alignOffset={overrides?.alignOffset ?? alignOffset}
        anchor={anchor}
        content={
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
            requestClose={close}
          />
        }
      >
        {children({ triggerRef, open, isOpen, tab })}
      </PopOut>
    );
  }
);
