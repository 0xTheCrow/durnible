/**
 * Revy Composer Component
 * Premium message input for Revy Comms
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  ReactNode,
  KeyboardEvent,
  ChangeEvent,
  DragEvent,
  useMemo,
} from 'react';
import classNames from 'classnames';
import * as css from './RevyComposer.css';

// ============================================================================
// ICONS
// ============================================================================

const PaperclipIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const SmileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" x2="9.01" y1="9" y2="9" />
    <line x1="15" x2="15.01" y1="9" y2="9" />
  </svg>
);

const AtSignIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
  </svg>
);

const SlashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 2 22" />
  </svg>
);

const BotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

const SparklesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);

const HashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" x2="20" y1="9" y2="9" />
    <line x1="4" x2="20" y1="15" y2="15" />
    <line x1="10" x2="8" y1="3" y2="21" />
    <line x1="16" x2="14" y1="3" y2="21" />
  </svg>
);

// ============================================================================
// TYPES
// ============================================================================

export interface AutocompleteUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface AutocompleteChannel {
  id: string;
  name: string;
}

export interface AutocompleteCommand {
  id: string;
  name: string;
  description: string;
}

export interface ReplyTo {
  id: string;
  authorName: string;
  content: string;
}

export interface FileUpload {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  preview?: string;
}

export interface RevyComposerProps {
  placeholder?: string;
  channelName?: string;
  replyTo?: ReplyTo;
  onCancelReply?: () => void;
  onSend?: (content: string, files: File[]) => void;
  onAISend?: (prompt: string) => void;
  users?: AutocompleteUser[];
  channels?: AutocompleteChannel[];
  commands?: AutocompleteCommand[];
  disabled?: boolean;
}

// ============================================================================
// COMPOSER COMPONENT
// ============================================================================

export const RevyComposer = forwardRef<HTMLTextAreaElement, RevyComposerProps>(
  (
    {
      placeholder,
      channelName = 'channel',
      replyTo,
      onCancelReply,
      onSend,
      onAISend,
      users = [],
      channels = [],
      commands = [],
      disabled = false,
    },
    ref
  ) => {
    const [value, setValue] = useState('');
    const [aiMode, setAiMode] = useState(false);
    const [markdownEnabled, setMarkdownEnabled] = useState(true);
    const [dragOver, setDragOver] = useState(false);
    const [files, setFiles] = useState<FileUpload[]>([]);
    const [autocompleteType, setAutocompleteType] = useState<'user' | 'channel' | 'command' | null>(null);
    const [autocompleteQuery, setAutocompleteQuery] = useState('');
    const [autocompleteIndex, setAutocompleteIndex] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-resize textarea
    useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 288)}px`;
      }
    }, [value]);

    // Focus textarea on mount
    useEffect(() => {
      textareaRef.current?.focus();
    }, []);

    // Format file size
    const formatFileSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Handle text change
    const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      // Check for autocomplete triggers
      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = newValue.slice(0, cursorPos);

      // Check @mention
      const atMatch = textBeforeCursor.match(/@(\w*)$/);
      if (atMatch) {
        setAutocompleteType('user');
        setAutocompleteQuery(atMatch[1]);
        setAutocompleteIndex(0);
        return;
      }

      // Check #channel
      const hashMatch = textBeforeCursor.match(/#(\w*)$/);
      if (hashMatch) {
        setAutocompleteType('channel');
        setAutocompleteQuery(hashMatch[1]);
        setAutocompleteIndex(0);
        return;
      }

      // Check /command
      const slashMatch = textBeforeCursor.match(/^\/(\w*)$/);
      if (slashMatch) {
        setAutocompleteType('command');
        setAutocompleteQuery(slashMatch[1]);
        setAutocompleteIndex(0);
        return;
      }

      setAutocompleteType(null);
    }, []);

    // Filtered autocomplete items
    const filteredUsers = useMemo(() => {
      if (autocompleteType !== 'user') return [];
      return users.filter(u => u.name.toLowerCase().includes(autocompleteQuery.toLowerCase())).slice(0, 8);
    }, [users, autocompleteQuery, autocompleteType]);

    const filteredChannels = useMemo(() => {
      if (autocompleteType !== 'channel') return [];
      return channels.filter(c => c.name.toLowerCase().includes(autocompleteQuery.toLowerCase())).slice(0, 8);
    }, [channels, autocompleteQuery, autocompleteType]);

    const filteredCommands = useMemo(() => {
      if (autocompleteType !== 'command') return [];
      return commands.filter(c => c.name.toLowerCase().includes(autocompleteQuery.toLowerCase())).slice(0, 8);
    }, [commands, autocompleteQuery, autocompleteType]);

    // Handle keyboard
    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Send with Cmd+Enter
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          if (value.trim() || files.length > 0) {
            if (aiMode && onAISend) {
              onAISend(value.trim());
              setValue('');
              setAiMode(false);
            } else if (onSend) {
              onSend(value.trim(), files.map(f => f.file));
              setValue('');
              setFiles([]);
            }
          }
          return;
        }

        // Toggle AI mode with Cmd+J
        if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
          e.preventDefault();
          setAiMode(!aiMode);
          return;
        }

        // Handle autocomplete navigation
        if (autocompleteType) {
          const items = autocompleteType === 'user'
            ? filteredUsers
            : autocompleteType === 'channel'
            ? filteredChannels
            : filteredCommands;

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAutocompleteIndex(i => (i < items.length - 1 ? i + 1 : 0));
            return;
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setAutocompleteIndex(i => (i > 0 ? i - 1 : items.length - 1));
            return;
          }

          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const item = items[autocompleteIndex];
            if (item) {
              // Insert the autocomplete value
              const cursorPos = e.currentTarget.selectionStart;
              const textBeforeCursor = value.slice(0, cursorPos);
              const textAfterCursor = value.slice(cursorPos);

              let triggerMatch;
              if (autocompleteType === 'user') {
                triggerMatch = textBeforeCursor.match(/@\w*$/);
                if (triggerMatch) {
                  const newValue = textBeforeCursor.slice(0, -triggerMatch[0].length) +
                    `@${(item as AutocompleteUser).name} ` + textAfterCursor;
                  setValue(newValue);
                }
              } else if (autocompleteType === 'channel') {
                triggerMatch = textBeforeCursor.match(/#\w*$/);
                if (triggerMatch) {
                  const newValue = textBeforeCursor.slice(0, -triggerMatch[0].length) +
                    `#${(item as AutocompleteChannel).name} ` + textAfterCursor;
                  setValue(newValue);
                }
              } else if (autocompleteType === 'command') {
                triggerMatch = textBeforeCursor.match(/\/\w*$/);
                if (triggerMatch) {
                  const newValue = `/${(item as AutocompleteCommand).name} `;
                  setValue(newValue);
                }
              }

              setAutocompleteType(null);
            }
            return;
          }

          if (e.key === 'Escape') {
            e.preventDefault();
            setAutocompleteType(null);
            return;
          }
        }

        // Close AI mode with Escape
        if (e.key === 'Escape' && aiMode) {
          e.preventDefault();
          setAiMode(false);
          return;
        }
      },
      [value, files, aiMode, onSend, onAISend, autocompleteType, autocompleteIndex, filteredUsers, filteredChannels, filteredCommands]
    );

    // Handle file selection
    const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      const newFiles = selectedFiles.map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }));
      setFiles(prev => [...prev, ...newFiles]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }, []);

    // Handle file drop
    const handleDragOver = useCallback((e: DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
    }, []);

    const handleDrop = useCallback((e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      const newFiles = droppedFiles.map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }, []);

    // Remove file
    const handleRemoveFile = useCallback((id: string) => {
      setFiles(prev => {
        const file = prev.find(f => f.id === id);
        if (file?.preview) {
          URL.revokeObjectURL(file.preview);
        }
        return prev.filter(f => f.id !== id);
      });
    }, []);

    // Get placeholder text
    const placeholderText = placeholder || (aiMode ? 'Ask AI anything...' : `Message #${channelName}`);

    return (
      <div className={css.ComposerContainer}>
        {/* Reply Preview */}
        {replyTo && (
          <div className={css.ReplyPreview}>
            <div className={css.ReplyPreviewContent}>
              <div className={css.ReplyPreviewLabel}>Replying to {replyTo.authorName}</div>
              <div className={css.ReplyPreviewText}>{replyTo.content}</div>
            </div>
            <button
              className={css.ReplyPreviewClose}
              onClick={onCancelReply}
              type="button"
              aria-label="Cancel reply"
            >
              <XIcon />
            </button>
          </div>
        )}

        {/* Input Wrapper */}
        <div
          className={css.InputWrapper({ aiMode, dragOver })}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* AI Mode Header */}
          {aiMode && (
            <div className={css.AIModeHeader}>
              <span className={css.AIModeIcon}>
                <SparklesIcon />
              </span>
              <span className={css.AIModeTitle}>AI Mode</span>
              <button
                className={css.AIModeClose}
                onClick={() => setAiMode(false)}
                type="button"
                aria-label="Exit AI mode"
              >
                <XIcon />
              </button>
            </div>
          )}

          {/* File Upload Preview */}
          {files.length > 0 && (
            <div className={css.FileUploadPreview}>
              {files.map(file =>
                file.preview ? (
                  <div key={file.id} className={css.ImageUploadPreview}>
                    <img className={css.ImageUploadPreviewImg} src={file.preview} alt={file.name} />
                    <button
                      className={css.ImageUploadPreviewRemove}
                      onClick={() => handleRemoveFile(file.id)}
                      type="button"
                      aria-label="Remove file"
                    >
                      <XIcon />
                    </button>
                  </div>
                ) : (
                  <div key={file.id} className={css.FileUploadItem}>
                    <div className={css.FileUploadItemIcon}>
                      <FileIcon />
                    </div>
                    <span className={css.FileUploadItemName}>{file.name}</span>
                    <span className={css.FileUploadItemSize}>{formatFileSize(file.size)}</span>
                    <button
                      className={css.FileUploadItemRemove}
                      onClick={() => handleRemoveFile(file.id)}
                      type="button"
                      aria-label="Remove file"
                    >
                      <XIcon />
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          {/* Textarea */}
          <div className={css.TextareaWrapper}>
            <textarea
              ref={node => {
                (textareaRef as any).current = node;
                if (typeof ref === 'function') ref(node);
                else if (ref) ref.current = node;
              }}
              className={css.Textarea}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholderText}
              disabled={disabled}
              rows={1}
            />

            {/* Autocomplete Dropdown */}
            {autocompleteType && (
              <div className={css.AutocompleteDropdown}>
                <div className={css.AutocompleteHeader}>
                  {autocompleteType === 'user' && 'Mention someone'}
                  {autocompleteType === 'channel' && 'Link a channel'}
                  {autocompleteType === 'command' && 'Run a command'}
                </div>
                <div className={css.AutocompleteList}>
                  {autocompleteType === 'user' && filteredUsers.map((user, i) => (
                    <div
                      key={user.id}
                      className={css.AutocompleteItem({ selected: i === autocompleteIndex })}
                    >
                      <div className={css.AutocompleteItemIcon({ variant: 'user' })}>
                        {user.avatar ? (
                          <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '6px' }} />
                        ) : (
                          user.name[0].toUpperCase()
                        )}
                      </div>
                      <div className={css.AutocompleteItemContent}>
                        <div className={css.AutocompleteItemTitle}>{user.name}</div>
                      </div>
                    </div>
                  ))}
                  {autocompleteType === 'channel' && filteredChannels.map((channel, i) => (
                    <div
                      key={channel.id}
                      className={css.AutocompleteItem({ selected: i === autocompleteIndex })}
                    >
                      <div className={css.AutocompleteItemIcon({ variant: 'channel' })}>
                        <HashIcon />
                      </div>
                      <div className={css.AutocompleteItemContent}>
                        <div className={css.AutocompleteItemTitle}>{channel.name}</div>
                      </div>
                    </div>
                  ))}
                  {autocompleteType === 'command' && filteredCommands.map((command, i) => (
                    <div
                      key={command.id}
                      className={css.AutocompleteItem({ selected: i === autocompleteIndex })}
                    >
                      <div className={css.AutocompleteItemIcon({ variant: 'command' })}>
                        <SlashIcon />
                      </div>
                      <div className={css.AutocompleteItemContent}>
                        <div className={css.AutocompleteItemTitle}>/{command.name}</div>
                        <div className={css.AutocompleteItemDescription}>{command.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className={css.Toolbar}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <button
              className={css.ToolbarButton()}
              onClick={() => fileInputRef.current?.click()}
              type="button"
              aria-label="Attach file"
            >
              <span className={css.ToolbarIcon}>
                <PaperclipIcon />
              </span>
            </button>
            <button
              className={css.ToolbarButton()}
              type="button"
              aria-label="Add emoji"
            >
              <span className={css.ToolbarIcon}>
                <SmileIcon />
              </span>
            </button>
            <button
              className={css.ToolbarButton()}
              onClick={() => setValue(value + '@')}
              type="button"
              aria-label="Mention someone"
            >
              <span className={css.ToolbarIcon}>
                <AtSignIcon />
              </span>
            </button>
            <button
              className={css.ToolbarButton()}
              onClick={() => setValue('/')}
              type="button"
              aria-label="Run command"
            >
              <span className={css.ToolbarIcon}>
                <SlashIcon />
              </span>
            </button>

            <div className={css.ToolbarDivider} />

            <button
              className={css.ToolbarButton({ ai: true })}
              onClick={() => setAiMode(!aiMode)}
              type="button"
              aria-label="Ask AI"
            >
              <span className={css.ToolbarIcon}>
                <BotIcon />
              </span>
            </button>

            <div className={css.ToolbarSpacer} />

            <div
              className={css.MarkdownToggle}
              onClick={() => setMarkdownEnabled(!markdownEnabled)}
              role="button"
              tabIndex={0}
            >
              <span className={css.MarkdownToggleIndicator({ active: markdownEnabled })} />
              Markdown
            </div>

            <div className={css.ToolbarHint}>
              <span className={css.ToolbarKey}>⌘⏎</span>
              Send
            </div>

            <button
              className={css.SendButton({ variant: aiMode ? 'ai' : 'default' })}
              onClick={() => {
                if (value.trim() || files.length > 0) {
                  if (aiMode && onAISend) {
                    onAISend(value.trim());
                    setValue('');
                    setAiMode(false);
                  } else if (onSend) {
                    onSend(value.trim(), files.map(f => f.file));
                    setValue('');
                    setFiles([]);
                  }
                }
              }}
              disabled={disabled || (!value.trim() && files.length === 0)}
              type="button"
            >
              <SendIcon />
              {aiMode ? 'Generate' : 'Send'}
            </button>
          </div>

          {/* Drag Overlay */}
          {dragOver && (
            <div className={css.DragOverlay}>
              <span className={css.DragOverlayIcon}>
                <UploadIcon />
              </span>
              <span className={css.DragOverlayText}>Drop files to upload</span>
            </div>
          )}
        </div>
      </div>
    );
  }
);
RevyComposer.displayName = 'RevyComposer';

export default RevyComposer;
