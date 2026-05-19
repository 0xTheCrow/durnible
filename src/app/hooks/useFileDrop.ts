import type { DragEventHandler, RefObject } from 'react';
import { useCallback, useState, useEffect, useRef } from 'react';
import { getDataTransferFiles } from '../utils/dom';

export const useFileDropHandler = (onDrop: (file: File[]) => void): DragEventHandler =>
  useCallback(
    (evt) => {
      const files = getDataTransferFiles(evt.dataTransfer);
      if (files) onDrop(files);
    },
    [onDrop]
  );

export const useFileDropZone = (
  zoneRef: RefObject<HTMLElement>,
  onDrop: (file: File[]) => void,
  fullPageDropZone?: boolean
): boolean => {
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);

  useEffect(() => {
    const target = zoneRef.current;

    if (!fullPageDropZone) {
      // Original behavior: zone is both trigger and drop target
      let dragState: 'start' | 'leave' | 'over' | undefined;

      const handleDragEnter = (evt: DragEvent) => {
        if (evt.dataTransfer?.types.includes('Files')) {
          dragState = 'start';
          setActive(true);
        }
      };
      const handleDragLeave = () => {
        if (dragState !== 'over') return;
        dragState = 'leave';
        setActive(false);
      };
      const handleDragOver = (evt: DragEvent) => {
        evt.preventDefault();
        dragState = 'over';
      };
      const handleDrop = (evt: DragEvent) => {
        evt.preventDefault();
        dragState = undefined;
        setActive(false);
        if (!evt.dataTransfer) return;
        const files = getDataTransferFiles(evt.dataTransfer);
        if (files) onDrop(files);
      };

      target?.addEventListener('dragenter', handleDragEnter);
      target?.addEventListener('dragleave', handleDragLeave);
      target?.addEventListener('dragover', handleDragOver);
      target?.addEventListener('drop', handleDrop);
      return () => {
        target?.removeEventListener('dragenter', handleDragEnter);
        target?.removeEventListener('dragleave', handleDragLeave);
        target?.removeEventListener('dragover', handleDragOver);
        target?.removeEventListener('drop', handleDrop);
      };
    }

    // Expanded behavior: zone triggers activation, document is the drop target
    const handleZoneDragEnter = (evt: DragEvent) => {
      if (evt.dataTransfer?.types.includes('Files') && !activeRef.current) {
        activeRef.current = true;
        setActive(true);
      }
    };
    target?.addEventListener('dragenter', handleZoneDragEnter);

    // Counter tracks nested dragenter/dragleave pairs on document
    // to reliably detect when the drag leaves the browser window
    let counter = 0;
    const handleDocDragEnter = () => {
      counter++;
    };
    const handleDocDragLeave = () => {
      counter--;
      if (counter <= 0) {
        counter = 0;
        if (activeRef.current) {
          activeRef.current = false;
          setActive(false);
        }
      }
    };
    const handleDocDragOver = (evt: DragEvent) => {
      if (activeRef.current) evt.preventDefault();
    };
    const handleDocDrop = (evt: DragEvent) => {
      counter = 0;
      if (!activeRef.current) return;
      evt.preventDefault();
      activeRef.current = false;
      setActive(false);
      if (!evt.dataTransfer) return;
      const files = getDataTransferFiles(evt.dataTransfer);
      if (files) onDrop(files);
    };

    document.addEventListener('dragenter', handleDocDragEnter);
    document.addEventListener('dragleave', handleDocDragLeave);
    document.addEventListener('dragover', handleDocDragOver);
    document.addEventListener('drop', handleDocDrop);

    return () => {
      target?.removeEventListener('dragenter', handleZoneDragEnter);
      document.removeEventListener('dragenter', handleDocDragEnter);
      document.removeEventListener('dragleave', handleDocDragLeave);
      document.removeEventListener('dragover', handleDocDragOver);
      document.removeEventListener('drop', handleDocDrop);
    };
  }, [zoneRef, onDrop, fullPageDropZone]);

  return active;
};
