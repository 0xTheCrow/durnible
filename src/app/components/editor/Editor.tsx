import type { FormEventHandler, KeyboardEventHandler, ReactNode } from 'react';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Box, Scroll } from 'folds';
import {
  handleEditorBackspace,
  htmlToEditorDom,
  insertNodeAtRange,
  isEditorEmpty,
} from './editorInput';
import { handleEditorShortcut } from './editorKeyboard';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useKeybinds } from '../../state/hooks/keybinds';
import * as css from './Editor.css';
import { getImageUrlBlob } from '../../utils/dom';

export type EditorController = {
  el: HTMLDivElement | null;
  focus: () => void;
  insertText: (text: string) => void;
  insertNode: (node: Node) => void;
  setContent: (html: string) => void;
};

export type EditorChangeHandler = () => void;

type CustomEditorProps = {
  editableName?: string;
  top?: ReactNode;
  bottom?: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
  maxHeight?: string;
  placeholder?: string;
  onKeyDown?: KeyboardEventHandler;
  onKeyUp?: KeyboardEventHandler;
  onChange?: EditorChangeHandler;
  onFiles?: (files: File[]) => void;
  editorInputRef?: React.RefObject<EditorController | null>;
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
      placeholder,
      onKeyDown,
      onKeyUp,
      onChange,
      onFiles,
      editorInputRef,
    },
    ref
  ) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const keybinds = useKeybinds();

    const [isEmpty, setIsEmpty] = useState(true);
    const inputRef = useRef<HTMLDivElement>(null);
    const savedRangeRef = useRef<Range | null>(null);

    const syncEditorState = useCallback(() => {
      const el = inputRef.current;
      if (!el) return;
      setIsEmpty(isEditorEmpty(el));
      onChange?.();
    }, [onChange]);

    useImperativeHandle(
      editorInputRef,
      () => ({
        get el() {
          return inputRef.current;
        },
        focus: () => {
          const el = inputRef.current;
          if (!el) return;
          el.focus();
          const saved = savedRangeRef.current;
          if (saved && el.contains(saved.startContainer)) {
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(saved.cloneRange());
          }
        },
        insertText: (text: string) => {
          const el = inputRef.current;
          if (!el) return;
          const textNode = document.createTextNode(text);
          savedRangeRef.current = insertNodeAtRange(el, savedRangeRef.current, textNode);
          const range = document.createRange();
          range.setStart(textNode, text.length);
          range.collapse(true);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
          savedRangeRef.current = range.cloneRange();
          syncEditorState();
        },
        insertNode: (node: Node) => {
          const el = inputRef.current;
          if (!el) return;
          savedRangeRef.current = insertNodeAtRange(el, savedRangeRef.current, node);
          syncEditorState();
        },
        setContent: (html: string) => {
          const el = inputRef.current;
          if (!el) return;
          const fragment = htmlToEditorDom(html, { mx, useAuthentication });
          el.replaceChildren(fragment);
          savedRangeRef.current = null;
          syncEditorState();
        },
      }),
      [mx, useAuthentication, syncEditorState]
    );

    useEffect(() => {
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
      return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
      };
    }, []);

    const handleInput: FormEventHandler<HTMLDivElement> = useCallback(() => {
      syncEditorState();
    }, [syncEditorState]);

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

    const handleEditorPaste: React.ClipboardEventHandler<HTMLDivElement> = useCallback(
      (e) => {
        e.preventDefault();

        const files = Array.from(e.clipboardData.items)
          .filter((item) => item.kind === 'file')
          .map((item) => item.getAsFile())
          .filter((f): f is File => f !== null);
        if (files.length > 0) {
          onFiles?.(files);
          return;
        }

        const html = e.clipboardData.getData('text/html');
        if (html) {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const src = doc.querySelector('img')?.getAttribute('src');
          if (src) {
            fetchUrlAsFile(src);
            return;
          }
        }

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
          if (sel && sel.rangeCount > 0 && el && handleEditorBackspace(el, sel.getRangeAt(0))) {
            e.preventDefault();
            syncEditorState();
          }
          return;
        }

        if (ie.inputType !== 'insertContent' || !ie.dataTransfer) return;

        const items = Array.from(ie.dataTransfer.items);

        const files = items
          .filter((item) => item.kind === 'file')
          .map((item) => item.getAsFile())
          .filter((f): f is File => f !== null);
        if (files.length > 0) {
          e.preventDefault();
          onFiles?.(files);
          return;
        }

        const uriItem = items.find((item) => item.kind === 'string');
        if (uriItem) {
          e.preventDefault();
          uriItem.getAsString((raw) => {
            const url = raw
              .split('\n')
              .map((s) => s.trim())
              .find((s) => s && !s.startsWith('#'));
            if (url) fetchUrlAsFile(url);
          });
        }
      },
      [onFiles, fetchUrlAsFile, syncEditorState]
    );

    const handleInputKeyDown: KeyboardEventHandler<HTMLDivElement> = useCallback(
      (evt) => {
        onKeyDown?.(evt);
        if (evt.defaultPrevented) return;
        const el = inputRef.current;
        if (!el) return;
        if (handleEditorShortcut(el, evt, keybinds)) {
          evt.preventDefault();
          evt.stopPropagation();
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      [onKeyDown, keybinds]
    );

    return (
      <div className={css.Editor} ref={ref} data-no-swipe-drawer>
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
              ref={inputRef}
              data-editable-name={editableName}
              data-testid="editor"
              className={css.AlternateInput}
              contentEditable
              suppressContentEditableWarning
              data-placeholder={placeholder}
              data-empty={isEmpty ? '' : undefined}
              onInput={handleInput}
              onBeforeInput={handleBeforeInput}
              onKeyDown={handleInputKeyDown}
              onKeyUp={onKeyUp}
              onPaste={handleEditorPaste}
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
        {bottom}
      </div>
    );
  }
);
