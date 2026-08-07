import React, { useEffect, useRef, useState } from 'react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Text } from 'folds';
import classNames from 'classnames';
import type { CallPaneDock } from '../../state/settings';
import * as css from './CallPane.css';

export const CALL_PANE_DRAG_TYPE = 'call-pane-dock';

const DOCK_LABELS: Record<CallPaneDock, string> = {
  Left: 'Dock Left',
  Right: 'Dock Right',
  Top: 'Dock Top',
  Bottom: 'Dock Bottom',
};

type CallPaneDockZoneProps = {
  dock: CallPaneDock;
  onDock: (dock: CallPaneDock) => void;
};
function CallPaneDockZone({ dock, onDock }: CallPaneDockZoneProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);

  useEffect(() => {
    const zoneElement = zoneRef.current;
    if (!zoneElement) return undefined;
    return dropTargetForElements({
      element: zoneElement,
      canDrop: ({ source }) => source.data.type === CALL_PANE_DRAG_TYPE,
      onDragEnter: () => setIsDraggedOver(true),
      onDragLeave: () => setIsDraggedOver(false),
      onDrop: () => {
        setIsDraggedOver(false);
        onDock(dock);
      },
    });
  }, [dock, onDock]);

  return (
    <div
      ref={zoneRef}
      className={classNames(
        css.CallPaneDockZone,
        css.CallPaneDockZoneArea[dock],
        isDraggedOver && css.CallPaneDockZoneActive
      )}
    >
      <Text size="T300">{DOCK_LABELS[dock]}</Text>
    </div>
  );
}

type CallPaneDockZonesProps = {
  availableDocks: CallPaneDock[];
  onDock: (dock: CallPaneDock) => void;
};
export function CallPaneDockZones({ availableDocks, onDock }: CallPaneDockZonesProps) {
  return (
    <div className={css.CallPaneDockZoneOverlay}>
      {availableDocks.map((dock) => (
        <CallPaneDockZone key={dock} dock={dock} onDock={onDock} />
      ))}
    </div>
  );
}
