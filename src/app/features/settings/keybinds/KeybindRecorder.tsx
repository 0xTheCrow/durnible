import type { KeyboardEventHandler } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import { Chip, Text } from 'folds';
import { captureHotkey, formatHotkey } from '../../../utils/keybindFormat';

type KeybindRecorderProps = {
  value: string;
  onChange: (next: string) => void;
  conflict?: boolean;
};

export function KeybindRecorder({ value, onChange, conflict }: KeybindRecorderProps) {
  const [recording, setRecording] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (recording) ref.current?.focus();
  }, [recording]);

  const handleKeyDown: KeyboardEventHandler<HTMLButtonElement> = (evt) => {
    if (!recording) return;
    if (evt.key === 'Escape') {
      evt.preventDefault();
      evt.stopPropagation();
      setRecording(false);
      ref.current?.blur();
      return;
    }
    evt.preventDefault();
    evt.stopPropagation();
    const captured = captureHotkey(evt);
    if (captured) {
      onChange(captured);
      setRecording(false);
      ref.current?.blur();
    }
  };

  const handleClick = () => {
    setRecording(true);
  };

  const handleBlur = () => {
    setRecording(false);
  };

  const display = formatHotkey(value);
  let label: string;
  if (recording) label = 'Press a key combo…';
  else if (display) label = display;
  else label = 'Unbound';

  let variant: 'Primary' | 'Secondary' | 'Critical' = 'Secondary';
  if (recording) variant = 'Primary';
  else if (conflict) variant = 'Critical';

  return (
    <Chip
      ref={ref}
      as="button"
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      variant={variant}
      outlined
      radii="Pill"
      aria-pressed={recording}
      style={{ minWidth: '12rem', justifyContent: 'center' }}
    >
      <Text size="B300" as="kbd">
        {label}
      </Text>
    </Chip>
  );
}
