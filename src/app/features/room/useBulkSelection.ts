import { useCallback, useEffect, useState } from 'react';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { useAtom } from 'jotai';
import { useKeyDown } from '../../hooks/useKeyDown';
import { selectedIdsAtom, selectionModeAtom } from './message/selectionAtom';

export type BulkSelectionApi = {
  selectionMode: boolean;
  selectedIds: Set<string>;
  bulkDeleting: boolean;
  handleBulkDelete: () => Promise<void>;
  handleCancelSelection: () => void;
};

export const useBulkSelection = (mx: MatrixClient, room: Room): BulkSelectionApi => {
  const [selectionMode, setSelectionMode] = useAtom(selectionModeAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedIdsAtom);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    await Promise.allSettled(ids.map((evtId) => mx.redactEvent(room.roomId, evtId)));
    setBulkDeleting(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [mx, room, selectedIds, setSelectedIds, setSelectionMode]);

  const handleCancelSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [setSelectedIds, setSelectionMode]);

  useKeyDown(
    window,
    useCallback(
      (evt: KeyboardEvent) => {
        if (evt.key === 'Escape' && selectionMode) {
          handleCancelSelection();
        }
      },
      [selectionMode, handleCancelSelection]
    )
  );

  useEffect(
    () => () => {
      setSelectedIds(new Set());
      setSelectionMode(false);
    },
    [room.roomId, setSelectedIds, setSelectionMode]
  );

  return {
    selectionMode,
    selectedIds,
    bulkDeleting,
    handleBulkDelete,
    handleCancelSelection,
  };
};
