import type { MouseEventHandler } from 'react';
import { useCallback, useState } from 'react';
import { useFocusWithin, useHover } from 'react-aria';
import { useAtom } from 'jotai';
import { messageOptionsAtom } from './messageOptionsAtom';
import { mobileOrTablet } from '../../../utils/user-agent';

type UseMessagePopupTriggerOptions = {
  disabled?: boolean;
};

export function useMessagePopupTrigger(
  eventId: string,
  { disabled = false }: UseMessagePopupTriggerOptions = {}
) {
  const [hover, setHover] = useState(false);
  const { hoverProps } = useHover({ onHoverChange: setHover });
  const { focusWithinProps } = useFocusWithin({ onFocusWithinChange: setHover });
  const [activeMessageOptionsId, setActiveMessageOptionsId] = useAtom(messageOptionsAtom);

  const isMobile = mobileOrTablet();
  const showOptions =
    !disabled && ((!isMobile && hover) || (isMobile && activeMessageOptionsId === eventId));

  const handleTap: MouseEventHandler<HTMLDivElement> = useCallback(
    (evt) => {
      if (!mobileOrTablet() || disabled) return;
      const target = evt.target as HTMLElement | null;
      if (target?.closest('button, a, [role="button"], input, textarea')) return;
      setActiveMessageOptionsId((prev) => (prev === eventId ? null : eventId));
    },
    [disabled, eventId, setActiveMessageOptionsId]
  );

  return { hoverProps, focusWithinProps, handleTap, showOptions };
}
