import React from 'react';
import { Modal } from 'folds';
import { ReactionViewer } from '../features/room/reaction-viewer';
import { OverlayModal } from './OverlayModal';
import { useReactionViewerState, useCloseReactionViewer } from '../state/hooks/reactionViewer';

export function ReactionViewerRenderer() {
  const state = useReactionViewerState();
  const close = useCloseReactionViewer();

  return (
    <OverlayModal
      open={!!state}
      requestClose={close}
      overlayProps={{ onContextMenu: (evt) => evt.stopPropagation() }}
      focusTrapOptions={{ returnFocusOnDeactivate: false }}
    >
      <Modal variant="Surface" size="300" flexHeight>
        {state && (
          <ReactionViewer
            room={state.room}
            initialKey={state.initialKey}
            relations={state.relations}
            requestClose={close}
          />
        )}
      </Modal>
    </OverlayModal>
  );
}
