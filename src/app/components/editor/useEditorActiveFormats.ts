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

const getHeadingIcon = (inputElement: HTMLElement): IconSrc | null => {
  if (isBlockFormatActive(inputElement, 'h1')) return Icons.Heading1;
  if (isBlockFormatActive(inputElement, 'h2')) return Icons.Heading2;
  if (isBlockFormatActive(inputElement, 'h3')) return Icons.Heading3;
  return null;
};

const getActiveEditorFormats = (inputElement: HTMLElement): ActiveEditorFormat[] => {
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
  const headingIcon = getHeadingIcon(inputElement);
  if (headingIcon) formats.push({ id: 'heading', icon: headingIcon });

  return formats;
};

export const useEditorActiveFormats = (
  inputRef: RefObject<HTMLDivElement | null>
): ActiveEditorFormat[] => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const inputElement = inputRef.current;
    if (!inputElement) return undefined;
    const sync = () => setTick((n) => n + 1);
    const syncOnSelection = () => {
      const selection = document.getSelection();
      if (
        selection &&
        selection.rangeCount > 0 &&
        inputElement.contains(selection.getRangeAt(0).startContainer)
      ) {
        sync();
      }
    };
    inputElement.addEventListener('input', sync);
    document.addEventListener('selectionchange', syncOnSelection);
    return () => {
      inputElement.removeEventListener('input', sync);
      document.removeEventListener('selectionchange', syncOnSelection);
    };
  }, [inputRef]);

  const inputElement = inputRef.current;
  return inputElement ? getActiveEditorFormats(inputElement) : [];
};
