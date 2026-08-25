import type { IconSrc } from 'folds';
import { Icons } from 'folds';
import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import {
  isBlockFormatActive,
  isCodeActive,
  isInlineMarkActive,
  isSpoilerActive,
} from './editorFormatting';

export type ActiveEditorFormat = {
  id: string;
  icon: IconSrc;
};

export type ActiveEditorFormatState = {
  formats: ActiveEditorFormat[];
  headingLevel: number;
};

const HEADING_ICONS: Record<number, IconSrc> = {
  1: Icons.Heading1,
  2: Icons.Heading2,
  3: Icons.Heading3,
};

const getHeadingLevel = (inputElement: HTMLElement): number => {
  if (isBlockFormatActive(inputElement, 'h1')) return 1;
  if (isBlockFormatActive(inputElement, 'h2')) return 2;
  if (isBlockFormatActive(inputElement, 'h3')) return 3;
  return 0;
};

const EMPTY_FORMAT_STATE: ActiveEditorFormatState = { formats: [], headingLevel: 0 };

const getActiveEditorFormatState = (inputElement: HTMLElement): ActiveEditorFormatState => {
  const formats: ActiveEditorFormat[] = [];
  const isInsideCodeBlock = isBlockFormatActive(inputElement, 'pre');

  if (!isInsideCodeBlock) {
    if (isInlineMarkActive(inputElement, 'bold')) formats.push({ id: 'bold', icon: Icons.Bold });
    if (isInlineMarkActive(inputElement, 'italic')) {
      formats.push({ id: 'italic', icon: Icons.Italic });
    }
    if (isInlineMarkActive(inputElement, 'underline')) {
      formats.push({ id: 'underline', icon: Icons.Underline });
    }
    if (isInlineMarkActive(inputElement, 'strikeThrough')) {
      formats.push({ id: 'strikeThrough', icon: Icons.Strike });
    }
    if (isCodeActive(inputElement)) formats.push({ id: 'inlineCode', icon: Icons.Code });
    if (isSpoilerActive(inputElement)) formats.push({ id: 'spoiler', icon: Icons.EyeBlind });
  }

  if (isBlockFormatActive(inputElement, 'blockquote')) {
    formats.push({ id: 'blockquote', icon: Icons.BlockQuote });
  }
  if (isInsideCodeBlock) formats.push({ id: 'codeBlock', icon: Icons.BlockCode });
  if (isBlockFormatActive(inputElement, 'ol')) {
    formats.push({ id: 'orderedList', icon: Icons.OrderList });
  }
  if (isBlockFormatActive(inputElement, 'ul')) {
    formats.push({ id: 'unorderedList', icon: Icons.UnorderList });
  }

  const headingLevel = getHeadingLevel(inputElement);
  if (headingLevel > 0) formats.push({ id: 'heading', icon: HEADING_ICONS[headingLevel] });

  return { formats, headingLevel };
};

const checkIsSameFormatState = (
  current: ActiveEditorFormatState,
  next: ActiveEditorFormatState
): boolean =>
  current.headingLevel === next.headingLevel &&
  current.formats.length === next.formats.length &&
  current.formats.every((format, index) => format.id === next.formats[index].id);

export const useEditorActiveFormats = (
  inputRef: RefObject<HTMLDivElement | null>
): ActiveEditorFormatState => {
  const [formatState, setFormatState] = useState<ActiveEditorFormatState>(EMPTY_FORMAT_STATE);

  useEffect(() => {
    const sync = () => {
      const inputElement = inputRef.current;
      if (!inputElement) return;
      const next = getActiveEditorFormatState(inputElement);
      setFormatState((current) => (checkIsSameFormatState(current, next) ? current : next));
    };
    const syncOnInput = (event: Event) => {
      const inputElement = inputRef.current;
      if (inputElement && inputElement.contains(event.target as Node)) sync();
    };
    const syncOnSelection = () => {
      const inputElement = inputRef.current;
      const selection = document.getSelection();
      if (
        inputElement &&
        selection &&
        selection.rangeCount > 0 &&
        inputElement.contains(selection.getRangeAt(0).startContainer)
      ) {
        sync();
      }
    };

    sync();
    document.addEventListener('input', syncOnInput, true);
    document.addEventListener('selectionchange', syncOnSelection);
    return () => {
      document.removeEventListener('input', syncOnInput, true);
      document.removeEventListener('selectionchange', syncOnSelection);
    };
  }, [inputRef]);

  return formatState;
};
