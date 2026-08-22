import React, { lazy, Suspense } from 'react';
import { Modal } from 'folds';
import { OverlayModal } from './OverlayModal';
import { useReactionViewerState, useCloseReactionViewer } from '../state/hooks/reactionViewer';

const LazyReactionViewer = lazy(() =>
  import('../features/room/reaction-viewer').then((module) => ({ default: module.ReactionViewer }))
);

export function ReactionViewerRenderer() {
  const state = useReactionViewerState();
  const close = useCloseReactionViewer();

  return (
    <Suspense fallback={null}>
      <OverlayModal
        open={!!state}
        onClose={close}
        overlayProps={{ onContextMenu: (evt) => evt.stopPropagation() }}
        focusTrapOptions={{ returnFocusOnDeactivate: false }}
      >
        <Modal variant="Surface" size="300" flexHeight>
          {state && (
            <LazyReactionViewer
              room={state.room}
              initialKey={state.initialKey}
              relations={state.relations}
              onClose={close}
            />
          )}
        </Modal>
      </OverlayModal>
    </Suspense>
  );
}
