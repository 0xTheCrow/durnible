/* eslint-disable no-param-reassign */
import React, {
  ClipboardEventHandler,
  KeyboardEventHandler,
  ReactNode,
  forwardRef,
  useCallback,
  useRef,
  useState,
} from 'react';
import { Box, Scroll, Text } from 'folds';
import { Descendant, Editor, Transforms, createEditor } from 'slate';
import {
  Slate,
  Editable,
  ReactEditor,
  withReact,
  RenderLeafProps,
  RenderElementProps,
  RenderPlaceholderProps,
} from 'slate-react';
import { withHistory } from 'slate-history';
import { BlockType } from './types';
import { RenderElement, RenderLeaf } from './Elements';
import { CustomElement } from './slate';
import * as css from './Editor.css';
import { toggleKeyboardShortcut } from './keyboard';
import { mobileOrTablet } from '../../utils/user-agent';

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
    },
    ref
  ) => {
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

        const replacementText = e.dataTransfer
          ? e.dataTransfer.getData('text/plain')
          : e.data;
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

          // Return true to tell Slate the event is handled.
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

      // Cancel any pending cursor correction from a previous composition
      // to avoid stale corrections interfering with the new one.
      if (compositionTimeoutRef.current !== null) {
        clearTimeout(compositionTimeoutRef.current);
        compositionTimeoutRef.current = null;
      }

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

        // Slate's Android input manager flushes 25ms after compositionEnd.
        // During flush it correctly inserts text but then overwrites the
        // cursor with the browser's DOM selection (at the divergence point).
        // Wait for the flush to complete, then correct the cursor to the
        // end of the composed text.
        compositionTimeoutRef.current = setTimeout(() => {
          compositionTimeoutRef.current = null;
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
            const text = (textNode as { text?: string }).text;
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
            const samePath = searchPath.length === anchor.path.length &&
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
