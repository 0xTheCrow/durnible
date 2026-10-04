import type { ReactNode, RefObject } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Header,
  Icon,
  Icons,
  PopOutContainerProvider,
  Text,
  TooltipContainerProvider,
} from 'folds';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import classNames from 'classnames';
import {
  checkIsSideDock,
  useCallPaneDock,
  useCallPaneResize,
} from '../../hooks/call/useCallPaneLayout';
import { CallPaneDockMenu } from './CallPaneDockMenu';
import { CALL_PANE_DRAG_TYPE, CallPaneDockZones } from './CallPaneDockZones';
import * as paneResizeCss from '../../styles/PaneResizeHandle.css';
import * as css from './CallPane.css';

type CallPaneFrameProps = {
  paneRef: RefObject<HTMLDivElement>;
  title: string;
  subtitle?: string;
  isFullscreen?: boolean;
  headerActions?: ReactNode;
  children: ReactNode;
};
export function CallPaneFrame({
  paneRef,
  title,
  subtitle,
  isFullscreen = false,
  headerActions,
  children,
}: CallPaneFrameProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const { dock, setDock, availableDocks, isDockDragEnabled } = useCallPaneDock();
  const { paneSize, isResizing, handleResizePointerDown, handleResizeKeyDown } = useCallPaneResize(
    paneRef,
    dock
  );
  const isDockDraggable = isDockDragEnabled && !isFullscreen;
  const [isDraggingPane, setIsDraggingPane] = useState(false);

  useEffect(() => {
    const headerElement = headerRef.current;
    if (!headerElement || !isDockDraggable) return undefined;
    return draggable({
      element: headerElement,
      getInitialData: () => ({ type: CALL_PANE_DRAG_TYPE }),
      onDragStart: () => setIsDraggingPane(true),
      onDrop: () => setIsDraggingPane(false),
    });
  }, [isDockDraggable]);

  const isSideDock = checkIsSideDock(dock);
  const portalContainer = isFullscreen ? paneRef.current ?? undefined : undefined;

  return (
    <div
      ref={paneRef}
      className={classNames(css.CallPane, css.CallPaneDockBorder[dock])}
      style={isFullscreen ? undefined : { [isSideDock ? 'width' : 'height']: paneSize }}
      data-testid="call-pane"
    >
      <TooltipContainerProvider value={portalContainer}>
        <PopOutContainerProvider value={portalContainer}>
          {!isFullscreen && (
            <button
              type="button"
              className={classNames(
                paneResizeCss.PaneResizeHandle,
                isSideDock
                  ? paneResizeCss.PaneResizeHandleSide
                  : paneResizeCss.PaneResizeHandleHorizontal,
                paneResizeCss.PaneResizeHandleAnchor[dock]
              )}
              data-resizing={isResizing}
              onPointerDown={handleResizePointerDown}
              onKeyDown={handleResizeKeyDown}
              aria-label="Resize Call Panel"
            />
          )}
          <Header
            ref={headerRef}
            size="600"
            variant="Surface"
            className={classNames(
              css.CallPaneHeader,
              isDockDraggable && css.CallPaneHeaderDraggable
            )}
          >
            <Icon size="100" src={Icons.Phone} filled />
            <Box grow="Yes" direction="Column">
              <Text size="T300" truncate>
                <b>{title}</b>
              </Text>
              {subtitle && (
                <Text size="T200" priority="300">
                  {subtitle}
                </Text>
              )}
            </Box>
            {!isFullscreen && (
              <CallPaneDockMenu dock={dock} availableDocks={availableDocks} onDock={setDock} />
            )}
            {headerActions}
          </Header>

          {children}

          {isDraggingPane && <CallPaneDockZones availableDocks={availableDocks} onDock={setDock} />}
        </PopOutContainerProvider>
      </TooltipContainerProvider>
    </div>
  );
}
