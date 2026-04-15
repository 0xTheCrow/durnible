/* eslint-disable no-param-reassign */
import type {
  ClipboardEventHandler,
  FormEventHandler,
  KeyboardEventHandler,
  ReactNode,
} from 'react';
import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { Box, Scroll, Text } from 'folds';
import type { Descendant } from 'slate';
import { Editor, Transforms, createEditor } from 'slate';
import type { RenderLeafProps, RenderElementProps, RenderPlaceholderProps } from 'slate-react';
import { Slate, Editable, ReactEditor, withReact } from 'slate-react';
import { withHistory } from 'slate-history';
import { BlockType } from './types';
import { RenderElement, RenderLeaf } from './Elements';
import type { CustomElement } from './slate';
import {
  handleAltInputBackspace,
  htmlToAltInputDom,
  insertNodeAtRange,
  isAltInputEmpty,
  serializeAltInput,
} from './altInput';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import * as css from './Editor.css';
import { toggleKeyboardShortcut } from './keyboard';
import { getImageUrlBlob } from '../../utils/dom';
import { mobileOrTablet } from '../../utils/user-agent';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';

const initialValue: CustomElement[] = [
  {
    type: BlockType.Paragraph,
    children: [{ text: '' }],
  },
];

const withInline = (editor: Editor): Editor => {
  const { isInline } = editor;

  editor.isInline = (element) =>
    [BlockType.Mention, BlockType.Emoticon, BlockType.Link, BlockType.Command].includes(
      element.type
    ) || isInline(element);

  return editor;
};

const withVoid = (editor: Editor): Editor => {
  const { isVoid } = editor;

  editor.isVoid = (element) =>
    [BlockType.Mention, BlockType.Emoticon, BlockType.Command].includes(element.type) ||
    isVoid(element);

  return editor;
};

export const useEditor = (): Editor => {
  const [editor] = useState(() => withInline(withVoid(withReact(withHistory(createEditor())))));
  return editor;
};

const isSlateChildrenEmpty = (children: Descendant[]): boolean =>
  children.every((node) => {
    if ('text' in node) return node.text.length === 0;
    if ('children' in node)
      return (node.children as Descendant[]).every(
        (child) => 'text' in child && child.text.length === 0
      );
    return false;
  });

export type EditorChangeHandler = (value: Descendant[]) => void;
type CustomEditorProps = {
  editableName?: string;
  top?: ReactNode;
  bottom?: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
  maxHeight?: string;
  editor: Editor;
  placeholder?: string;
  onKeyDown?: KeyboardEventHandler;
  onKeyUp?: KeyboardEventHandler;
  onChange?: EditorChangeHandler;
  onPaste?: ClipboardEventHandler;
  onFiles?: (files: File[]) => void;
  forceSlate?: boolean;
  alternateInputRef?: React.RefObject<HTMLDivElement>;
};
export const CustomEditor = forwardRef<HTMLDivElement, CustomEditorProps>(
  (
    {
      editableName,
      top,
      bottom,
      before,
      after,
      maxHeight = '50vh',
      editor,
      placeholder,
      onKeyDown,
      onKeyUp,
      onChange,
      onPaste,
      onFiles,
      alternateInputRef,
    },
    ref
  ) => {
    const [alternateInput] = useSetting(settingsAtom, 'alternateInput');
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();

    const [isEmpty, setIsEmpty] = useState(true);
    const inputRef = useRef<HTMLDivElement>(null);
    const savedRangeRef = useRef<Range | null>(null);

    const syncAltInputState = useCallback(() => {
      const el = inputRef.current;
      if (!el) return;
      editor.children = serializeAltInput(el);
      setIsEmpty(isAltInputEmpty(el));
      onChange?.(editor.children);
    }, [editor, onChange]);

    useEffect(() => {
      if (!alternateInput) return undefined;

      const origOnChange = editor.onChange;
      editor.onChange = (...args: Parameters<typeof origOnChange>) => {
        origOnChange.apply(editor, args);
        const el = inputRef.current;
        if (!el) return;
        // Sync DOM when editor is cleared externally (e.g. after sending a message)
        if (isSlateChildrenEmpty(editor.children) && el.childNodes.length > 0) {
          el.textContent = '';
          savedRangeRef.current = null;
        }
        setIsEmpty(isAltInputEmpty(el));
      };

      const handleSelectionChange = () => {
        const el = inputRef.current;
        if (!el) return;
        const sel = document.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        if (!el.contains(range.startContainer)) return;
        savedRangeRef.current = range.cloneRange();
      };
      document.addEventListener('selectionchange', handleSelectionChange);

      editor.insertAlternateText = (text: string) => {
        const el = inputRef.current;
        if (!el) return;
        const textNode = document.createTextNode(text);
        savedRangeRef.current = insertNodeAtRange(el, savedRangeRef.current, textNode);
        // Move the caret to after the inserted text (not after a trailing empty node)
        const range = document.createRange();
        range.setStart(textNode, text.length);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        savedRangeRef.current = range.cloneRange();
        syncAltInputState();
      };

      editor.insertAlternateNode = (node: Node) => {
        const el = inputRef.current;
        if (!el) return;
        savedRangeRef.current = insertNodeAtRange(el, savedRangeRef.current, node);
        syncAltInputState();
      };

      editor.setAlternateInputContent = (html: string) => {
        const el = inputRef.current;
        if (!el) return;
        const fragment = htmlToAltInputDom(html, { mx, useAuthentication });
        el.replaceChildren(fragment);
        savedRangeRef.current = null;
        syncAltInputState();
      };

      return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        editor.onChange = origOnChange;
        delete editor.insertAlternateText;
        delete editor.insertAlternateNode;
        delete editor.setAlternateInputContent;
      };
    }, [editor, alternateInput, syncAltInputState, mx, useAuthentication]);

    const handleInput: FormEventHandler<HTMLDivElement> = useCallback(() => {
      syncAltInputState();
    }, [syncAltInputState]);

    const fetchUrlAsFile = useCallback(
      (url: string) => {
        getImageUrlBlob(url)
          .then((blob) => {
            const ext = blob.type.split('/')[1] || 'gif';
            const name = url.split('/').pop()?.split('?')[0] || `image.${ext}`;
            onFiles?.([new File([blob], name, { type: blob.type })]);
          })
          .catch(() => {});
      },
      [onFiles]
    );

    const handleAlternatePaste: React.ClipboardEventHandler<HTMLDivElement> = useCallback(
      (e) => {
        e.preventDefault();

        // Binary file items (screenshot, local image)
        const files = Array.from(e.clipboardData.items)
          .filter((item) => item.kind === 'file')
          .map((item) => item.getAsFile())
          .filter((f): f is File => f !== null);
        if (files.length > 0) {
          onFiles?.(files);
          return;
        }

        // HTML paste containing an img (e.g. keyboard GIF delivered as markup)
        const html = e.clipboardData.getData('text/html');
        if (html) {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const src = doc.querySelector('img')?.getAttribute('src');
          if (src) {
            fetchUrlAsFile(src);
            return;
          }
        }

        // Plain text
        const text = e.clipboardData.getData('text/plain');
        if (text) document.execCommand('insertText', false, text);
      },
      [onFiles, fetchUrlAsFile]
    );

    const handleBeforeInput: React.FormEventHandler<HTMLDivElement> = useCallback(
      (e) => {
        const ie = e.nativeEvent as InputEvent;

        if (ie.inputType === 'deleteContentBackward') {
          const sel = window.getSelection();
          const el = inputRef.current;
          if (sel && sel.rangeCount > 0 && el && handleAltInputBackspace(el, sel.getRangeAt(0))) {
            e.preventDefault();
            syncAltInputState();
          }
          return;
        }

        if (ie.inputType !== 'insertContent' || !ie.dataTransfer) return;

        const items = Array.from(ie.dataTransfer.items);

        // Binary file (keyboard delivers actual image bytes)
        const files = items
          .filter((item) => item.kind === 'file')
          .map((item) => item.getAsFile())
          .filter((f): f is File => f !== null);
        if (files.length > 0) {
          e.preventDefault();
          onFiles?.(files);
          return;
        }

        // URI string (Gboard GIF from Tenor/Giphy CDN)
        const uriItem = items.find((item) => item.kind === 'string');
        if (uriItem) {
          e.preventDefault();
          uriItem.getAsString((raw) => {
            // uri-list format: lines starting with # are comments
            const url = raw
              .split('\n')
              .map((s) => s.trim())
              .find((s) => s && !s.startsWith('#'));
            if (url) fetchUrlAsFile(url);
          });
        }
      },
      [onFiles, fetchUrlAsFile, syncAltInputState]
    );

    const handleInputKeyDown: KeyboardEventHandler<HTMLDivElement> = useCallback(
      (evt) => {
        onKeyDown?.(evt);
      },
      [onKeyDown]
    );

    const renderElement = useCallback(
      (props: RenderElementProps) => <RenderElement {...props} />,
      []
    );

    const renderLeaf = useCallback((props: RenderLeafProps) => <RenderLeaf {...props} />, []);

    const handleDOMBeforeInput = useCallback(
      (e: InputEvent) => {
        if (e.inputType !== 'insertReplacementText') return;

        // On mobile, handle replacement text ourselves to avoid Slate's
        // user-selection restore which computes wrong cursor positions
        // for text prediction / autocorrect. On desktop, fall through
        // to Slate's normal handling (which correctly restores cursor
        // position for right-click spell check corrections).
        if (!mobileOrTablet()) return;

        const [targetRange] = e.getTargetRanges();
        if (!targetRange) return;

        const replacementText = e.dataTransfer ? e.dataTransfer.getData('text/plain') : e.data;
        if (!replacementText) return;

        try {
          const slateRange = ReactEditor.toSlateRange(editor, targetRange, {
            exactMatch: false,
            suppressThrow: true,
          });
          if (!slateRange) return;

          e.preventDefault();
          Transforms.select(editor, slateRange);
          Editor.insertText(editor, replacementText);

          // eslint-disable-next-line consistent-return
          return true;
        } catch {
          // Fall through to Slate's default handling
        }
      },
      [editor]
    );

    // Track where composition starts so we can reliably place the cursor
    // after Slate's Android input manager flushes. Without this, the
    // fallback search can miss when the cursor drifts far from the
    // composed text (e.g. composing in the middle of existing text).
    const compositionStartRef = useRef<{ path: number[]; offset: number } | null>(null);
    const compositionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleCompositionStart = useCallback(() => {
      if (!mobileOrTablet()) return;

      // Record cursor position as a proximity hint for the text search
      // in compositionEnd. Do NOT cancel pending timeouts here — the
      // correction from a previous compositionEnd must still fire so
      // the cursor doesn't stay at the wrong position when the user
      // resumes typing quickly after backspacing.
      if (editor.selection) {
        compositionStartRef.current = {
          path: [...editor.selection.anchor.path],
          offset: editor.selection.anchor.offset,
        };
      }
    }, [editor]);

    const handleCompositionEnd = useCallback(
      (e: React.CompositionEvent) => {
        if (!mobileOrTablet()) return;
        const composedText = e.data;
        if (!composedText) return;

        // Capture start info now, before a new composition can overwrite the ref.
        const startInfo = compositionStartRef.current;
        compositionStartRef.current = null;

        // Cancel any pending timeout from a previous compositionEnd so
        // only the latest correction runs.
        if (compositionTimeoutRef.current !== null) {
          clearTimeout(compositionTimeoutRef.current);
        }

        // Slate's Android input manager flushes 25ms after compositionEnd.
        // During flush it correctly inserts text but then overwrites the
        // cursor with the browser's DOM selection (at the divergence point).
        // Wait for the flush to complete, then correct the cursor to the
        // end of the composed text.
        compositionTimeoutRef.current = setTimeout(() => {
          compositionTimeoutRef.current = null;

          // If a new composition is already active, don't change the
          // cursor — it would disrupt the keyboard's composing state.
          // The correction will be retried when that composition ends.
          if (compositionStartRef.current !== null) return;

          if (!editor.selection) return;
          const { anchor } = editor.selection;

          try {
            // Search the text node for the composed text. Use the tracked
            // start position to pick the right occurrence when duplicates
            // exist (e.g. "the" appears twice). Some keyboards re-compose
            // from the start of the word rather than from our cursor, so
            // we can't assume composedText starts at startInfo.offset —
            // instead we use it as a proximity hint.
            const searchPath = startInfo?.path ?? anchor.path;
            const [textNode] = Editor.node(editor, searchPath);
            const { text } = textNode as { text?: string };
            if (typeof text !== 'string') return;

            const hint = startInfo?.offset ?? anchor.offset;
            let bestMatch = -1;
            let bestDistance = Infinity;
            for (let i = 0; i <= text.length - composedText.length; i++) {
              if (text.startsWith(composedText, i)) {
                const dist = Math.abs(i - hint);
                if (dist < bestDistance) {
                  bestDistance = dist;
                  bestMatch = i;
                }
              }
            }
            if (bestMatch === -1) return;

            const correctOffset = bestMatch + composedText.length;
            // If cursor is already at or past the end of the composed
            // text, it's in a valid position (e.g. after a trailing space
            // that ended the composition). Only correct when the cursor
            // is before correctOffset (the divergence-point bug).
            const samePath =
              searchPath.length === anchor.path.length &&
              searchPath.every((v, i) => v === anchor.path[i]);
            if (samePath && anchor.offset >= correctOffset) {
              return;
            }
            const point = { path: searchPath, offset: correctOffset };
            Transforms.select(editor, { anchor: point, focus: point });
          } catch {
            // ignore if selection is no longer valid
          }
        }, 60);
      },
      [editor]
    );

    const handleKeydown: KeyboardEventHandler = useCallback(
      (evt) => {
        onKeyDown?.(evt);
        const shortcutToggled = toggleKeyboardShortcut(editor, evt);
        if (shortcutToggled) evt.preventDefault();
      },
      [editor, onKeyDown]
    );

    const renderPlaceholder = useCallback(
      ({ attributes, children }: RenderPlaceholderProps) => (
        <span {...attributes} className={css.EditorPlaceholderContainer}>
          {/* Inner component to style the actual text position and appearance */}
          <Text as="span" className={css.EditorPlaceholderTextVisual} truncate>
            {children}
          </Text>
        </span>
      ),
      []
    );

    if (alternateInput) {
      return (
        <div className={css.Editor} ref={ref}>
          {top}
          <Box alignItems="Start">
            {before && (
              <Box className={css.EditorOptions} alignItems="Center" gap="100" shrink="No">
                {before}
              </Box>
            )}
            <Scroll
              className={css.EditorTextareaScroll}
              variant="SurfaceVariant"
              style={{ maxHeight }}
              size="300"
              visibility="Hover"
              hideTrack
            >
              <div
                ref={(el) => {
                  (inputRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                  if (alternateInputRef) {
                    (alternateInputRef as React.MutableRefObject<HTMLDivElement | null>).current =
                      el;
                  }
                }}
                data-editable-name={editableName}
                data-testid="editor-alternate-input"
                className={css.AlternateInput}
                contentEditable
                suppressContentEditableWarning
                data-placeholder={placeholder}
                data-empty={isEmpty ? '' : undefined}
                onInput={handleInput}
                onBeforeInput={handleBeforeInput}
                onKeyDown={handleInputKeyDown}
                onKeyUp={onKeyUp}
                onPaste={handleAlternatePaste}
                autoCapitalize="sentences"
                role="textbox"
                tabIndex={0}
                aria-multiline="true"
                aria-label={placeholder}
              />
            </Scroll>
            {after && (
              <Box className={css.EditorOptions} alignItems="Center" gap="100" shrink="No">
                {after}
              </Box>
            )}
          </Box>
          {bottom && <div className={css.AlternateInputBottom}>{bottom}</div>}
        </div>
      );
    }

    return (
      <div className={css.Editor} ref={ref}>
        <Slate editor={editor} initialValue={initialValue} onChange={onChange}>
          {top}
          <Box alignItems="Start">
            {before && (
              <Box className={css.EditorOptions} alignItems="Center" gap="100" shrink="No">
                {before}
              </Box>
            )}
            <Scroll
              className={css.EditorTextareaScroll}
              variant="SurfaceVariant"
              style={{ maxHeight }}
              size="300"
              visibility="Hover"
              hideTrack
            >
              <Editable
                data-editable-name={editableName}
                data-testid="editor-slate"
                className={css.EditorTextarea}
                placeholder={placeholder}
                renderPlaceholder={renderPlaceholder}
                renderElement={renderElement}
                renderLeaf={renderLeaf}
                onKeyDown={handleKeydown}
                onKeyUp={onKeyUp}
                onPaste={onPaste}
                onDOMBeforeInput={handleDOMBeforeInput}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
              />
            </Scroll>
            {after && (
              <Box className={css.EditorOptions} alignItems="Center" gap="100" shrink="No">
                {after}
              </Box>
            )}
          </Box>
          {bottom}
        </Slate>
      </div>
    );
  }
);
