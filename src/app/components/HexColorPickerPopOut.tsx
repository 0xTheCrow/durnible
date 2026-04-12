import FocusTrap from 'focus-trap-react';
import type { RectCords } from 'folds';
import { Box, Button, config, Input, Menu, PopOut, Text } from 'folds';
import type { MouseEventHandler, ReactNode } from 'react';
import React, { useEffect, useState } from 'react';
import { stopPropagation } from '../utils/keyboard';

type HexColorPickerPopOutProps = {
  children: (onOpen: MouseEventHandler<HTMLElement>, opened: boolean) => ReactNode;
  picker: ReactNode;
  color?: string;
  onChange?: (color: string) => void;
  onRemove?: () => void;
};
export function HexColorPickerPopOut({
  picker,
  color,
  onChange,
  onRemove,
  children,
}: HexColorPickerPopOutProps) {
  const [cords, setCords] = useState<RectCords>();
  const [hexInput, setHexInput] = useState(color ?? '');

  useEffect(() => {
    setHexInput(color ?? '');
  }, [color]);

  const handleHexInput = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const val = evt.target.value;
    setHexInput(val);
    const hex = val.startsWith('#') ? val : `#${val}`;
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
      onChange?.(hex);
    }
  };

  const handleOpen: MouseEventHandler<HTMLElement> = (evt) => {
    setCords(evt.currentTarget.getBoundingClientRect());
  };

  return (
    <PopOut
      anchor={cords}
      position="Bottom"
      align="Center"
      content={
        <FocusTrap
          focusTrapOptions={{
            onDeactivate: () => setCords(undefined),
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu
            style={{
              padding: config.space.S100,
              borderRadius: config.radii.R500,
              overflow: 'initial',
            }}
          >
            <Box direction="Column" gap="200">
              {picker}
              <Input
                value={hexInput}
                onChange={handleHexInput}
                placeholder="#rrggbb"
                size="300"
                variant="Background"
                radii="300"
                style={{ fontFamily: 'monospace' }}
              />
              {onRemove && (
                <Button
                  size="300"
                  variant="Secondary"
                  fill="Soft"
                  radii="400"
                  onClick={() => onRemove()}
                >
                  <Text size="B300">Remove</Text>
                </Button>
              )}
            </Box>
          </Menu>
        </FocusTrap>
      }
    >
      {children(handleOpen, !!cords)}
    </PopOut>
  );
}
