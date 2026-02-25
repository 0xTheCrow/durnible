/* eslint-disable no-param-reassign */
import React, {
  ClipboardEventHandler,
  KeyboardEventHandler,
  ReactNode,
  forwardRef,
  useCallback,
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

          // On Android, preventDefault() is a no-op for beforeinput events,
          // so the browser still modifies the DOM and fires selectionchange.
          // Slate's onDOMSelectionChange reads the browser's cursor (at the
          // text divergence point) and overwrites our correct cursor.
          // Re-apply the correct selection after those events settle.
          const correctSelection = editor.selection;
          if (correctSelection) {
            requestAnimationFrame(() => {
              try {
                Transforms.select(editor, correctSelection);
              } catch {
                // ignore if selection is no longer valid
              }
            });
          }

          // Return true to tell Slate the event is handled.
          // eslint-disable-next-line consistent-return
          return true;
        } catch {
          // Fall through to Slate's default handling
        }
      },
      [editor]
    );

    const handleCompositionEnd = useCallback(
      (e: React.CompositionEvent) => {
        if (!mobileOrTablet()) return;
        const composedText = e.data;
        if (!composedText) return;

        // Slate's Android input manager flushes 25ms after compositionEnd.
        // During flush it correctly inserts text but then overwrites the
        // cursor with the browser's DOM selection (at the divergence point).
        // Wait for the flush to complete, then correct the cursor to the
        // end of the composed text.
        setTimeout(() => {
          if (!editor.selection) return;
          const { anchor } = editor.selection;
          try {
            const [textNode] = Editor.node(editor, anchor.path);
            const text = (textNode as { text?: string }).text;
            if (typeof text !== 'string') return;

            // The cursor is at the divergence point within the composed text.
            // Search backwards from the cursor to find where the composed
            // text starts, then place the cursor at its end.
            const searchStart = Math.max(0, anchor.offset - composedText.length);
            for (let i = searchStart; i <= anchor.offset; i++) {
              if (text.startsWith(composedText, i)) {
                const correctOffset = i + composedText.length;
                if (correctOffset !== anchor.offset) {
                  const point = { path: anchor.path, offset: correctOffset };
                  Transforms.select(editor, { anchor: point, focus: point });
                }
                break;
              }
            }
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
