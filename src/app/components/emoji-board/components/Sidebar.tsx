import type { ReactNode } from 'react';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { IconSrc } from 'folds';
import {
  Box,
  Scroll,
  Line,
  as,
  TooltipProvider,
  Tooltip,
  Text,
  IconButton,
  Icon,
  Icons,
} from 'folds';
import classNames from 'classnames';
import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import type { Instruction } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import {
  attachInstruction,
  extractInstruction,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import * as css from './styles.css';

export function Sidebar({ children }: { children: ReactNode }) {
  return (
    <Box className={css.Sidebar} shrink="No">
      <Scroll size="0">
        <Box className={css.SidebarContent} direction="Column" alignItems="Center" gap="100">
          {children}
        </Box>
      </Scroll>
    </Box>
  );
}

export const SidebarStack = as<'div'>(({ className, children, ...props }, ref) => (
  <Box
    className={classNames(css.SidebarStack, className)}
    direction="Column"
    alignItems="Center"
    gap="100"
    {...props}
    ref={ref}
  >
    {children}
  </Box>
));
export function SidebarDivider() {
  return <Line className={css.SidebarDivider} size="300" variant="Surface" />;
}

function SidebarBtn<T extends string>({
  active,
  label,
  id,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  id: T;
  onClick: (id: T) => void;
  children: ReactNode;
}) {
  return (
    <TooltipProvider
      delay={500}
      position="Left"
      tooltip={
        <Tooltip id={`SidebarStackItem-${id}-label`}>
          <Text size="T300">{label}</Text>
        </Tooltip>
      }
    >
      {(ref) => (
        <IconButton
          aria-pressed={active}
          aria-labelledby={`SidebarStackItem-${id}-label`}
          ref={ref}
          onClick={() => onClick(id)}
          size="400"
          radii="300"
          variant="Surface"
        >
          {children}
        </IconButton>
      )}
    </TooltipProvider>
  );
}

type GroupIconProps<T extends string> = {
  active: boolean;
  id: T;
  label: string;
  icon: IconSrc;
  onClick: (id: T) => void;
};
export function GroupIcon<T extends string>({
  active,
  id,
  label,
  icon,
  onClick,
}: GroupIconProps<T>) {
  return (
    <SidebarBtn active={active} id={id} label={label} onClick={onClick}>
      <Icon src={icon} filled={active} />
    </SidebarBtn>
  );
}

type DraggableGroupIconProps = {
  active: boolean;
  id: string;
  label: string;
  icon: IconSrc;
  onClick: (id: string) => void;
};
export function DraggableGroupIcon({ active, id, label, icon, onClick }: DraggableGroupIconProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dropState, setDropState] = useState<Instruction>();

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    return combine(
      draggable({
        element: el,
        getInitialData: () => ({ packId: id }),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => source.data.packId !== id,
        getData: ({ input, element }) => {
          const insData = attachInstruction(
            {},
            {
              input,
              element,
              currentLevel: 0,
              indentPerLevel: 0,
              mode: 'standard',
              block: ['reparent', 'make-child'],
            }
          );
          const instruction: Instruction | null = extractInstruction(insData);
          setDropState(instruction ?? undefined);
          return {
            packId: id,
            instructionType: instruction?.type,
          };
        },
        onDragLeave: () => setDropState(undefined),
        onDrop: () => setDropState(undefined),
      })
    );
  }, [id]);

  return (
    <div
      ref={ref}
      className={css.SidebarDropTarget}
      data-drop-above={dropState?.type === 'reorder-above' || undefined}
      data-drop-below={dropState?.type === 'reorder-below' || undefined}
    >
      <GroupIcon active={active} id={id} label={label} icon={icon} onClick={onClick} />
    </div>
  );
}

type ImageGroupIconProps<T extends string> = {
  active: boolean;
  id: T;
  label: string;
  url?: string;
  onClick: (id: T) => void;
};
export function ImageGroupIcon<T extends string>({
  active,
  id,
  label,
  url,
  onClick,
}: ImageGroupIconProps<T>) {
  return (
    <SidebarBtn active={active} id={id} label={label} onClick={onClick}>
      {url ? (
        <img className={css.SidebarBtnImg} src={url} alt={label} draggable={false} />
      ) : (
        <Icon src={Icons.Photo} filled={active} />
      )}
    </SidebarBtn>
  );
}

type DraggableImageGroupIconProps = {
  active: boolean;
  id: string;
  label: string;
  url?: string;
  onClick: (id: string) => void;
};
export function DraggableImageGroupIcon({
  active,
  id,
  label,
  url,
  onClick,
}: DraggableImageGroupIconProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dropState, setDropState] = useState<Instruction>();

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    return combine(
      draggable({
        element: el,
        getInitialData: () => ({ packId: id }),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => source.data.packId !== id,
        getData: ({ input, element }) => {
          const insData = attachInstruction(
            {},
            {
              input,
              element,
              currentLevel: 0,
              indentPerLevel: 0,
              mode: 'standard',
              block: ['reparent', 'make-child'],
            }
          );
          const instruction: Instruction | null = extractInstruction(insData);
          setDropState(instruction ?? undefined);
          return {
            packId: id,
            instructionType: instruction?.type,
          };
        },
        onDragLeave: () => setDropState(undefined),
        onDrop: () => setDropState(undefined),
      })
    );
  }, [id]);

  return (
    <div
      ref={ref}
      className={css.SidebarDropTarget}
      data-drop-above={dropState?.type === 'reorder-above' || undefined}
      data-drop-below={dropState?.type === 'reorder-below' || undefined}
    >
      <ImageGroupIcon active={active} id={id} label={label} url={url} onClick={onClick} />
    </div>
  );
}

function LongPressWrapper({
  onLongPress,
  children,
}: {
  onLongPress: () => void;
  children: ReactNode;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const suppressRef = useRef(false);

  const start = useCallback(() => {
    suppressRef.current = false;
    timerRef.current = setTimeout(() => {
      suppressRef.current = true;
      onLongPress();
    }, 500);
  }, [onLongPress]);

  const cancel = useCallback(() => clearTimeout(timerRef.current), []);

  return (
    <div
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onClickCapture={(e) => {
        if (suppressRef.current) {
          suppressRef.current = false;
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {children}
    </div>
  );
}

type MobileSortableGroupIconProps = {
  active: boolean;
  id: string;
  label: string;
  icon: IconSrc;
  reorderMode: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onClick: (id: string) => void;
  onLongPress: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};
export function MobileSortableGroupIcon({
  active,
  id,
  label,
  icon,
  reorderMode,
  canMoveUp,
  canMoveDown,
  onClick,
  onLongPress,
  onMoveUp,
  onMoveDown,
}: MobileSortableGroupIconProps) {
  return (
    <Box direction="Column" alignItems="Center">
      {reorderMode && (
        <IconButton
          size="300"
          radii="300"
          variant="Surface"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          aria-label="Move up"
        >
          <Icon size="100" src={Icons.ChevronTop} />
        </IconButton>
      )}
      <LongPressWrapper onLongPress={onLongPress}>
        <GroupIcon active={active} id={id} label={label} icon={icon} onClick={onClick} />
      </LongPressWrapper>
      {reorderMode && (
        <IconButton
          size="300"
          radii="300"
          variant="Surface"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          aria-label="Move down"
        >
          <Icon size="100" src={Icons.ChevronBottom} />
        </IconButton>
      )}
    </Box>
  );
}

type MobileSortableImageGroupIconProps = {
  active: boolean;
  id: string;
  label: string;
  url?: string;
  reorderMode: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onClick: (id: string) => void;
  onLongPress: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};
export function MobileSortableImageGroupIcon({
  active,
  id,
  label,
  url,
  reorderMode,
  canMoveUp,
  canMoveDown,
  onClick,
  onLongPress,
  onMoveUp,
  onMoveDown,
}: MobileSortableImageGroupIconProps) {
  return (
    <Box direction="Column" alignItems="Center">
      {reorderMode && (
        <IconButton
          size="300"
          radii="300"
          variant="Surface"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          aria-label="Move up"
        >
          <Icon size="100" src={Icons.ChevronTop} />
        </IconButton>
      )}
      <LongPressWrapper onLongPress={onLongPress}>
        <ImageGroupIcon active={active} id={id} label={label} url={url} onClick={onClick} />
      </LongPressWrapper>
      {reorderMode && (
        <IconButton
          size="300"
          radii="300"
          variant="Surface"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          aria-label="Move down"
        >
          <Icon size="100" src={Icons.ChevronBottom} />
        </IconButton>
      )}
    </Box>
  );
}
