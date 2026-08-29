import { useEffect } from 'react';
import { settingsAtom } from '../state/settings';
import { useSetting } from '../state/hooks/settings';
import { setDesktopDevToolsEnabled } from './desktop';

export function DesktopMenuBarSync() {
  const [developerTools] = useSetting(settingsAtom, 'developerTools');

  useEffect(() => {
    setDesktopDevToolsEnabled(developerTools);
  }, [developerTools]);

  return null;
}
