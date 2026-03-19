import React, { useState } from 'react';
import {
  config,
  Icon,
  IconButton,
  Icons,
  Line,
  Modal,
} from 'folds';

import { CustomEditor, useEditor } from './Editor';
import { Toolbar } from './Toolbar';
import { OverlayModal } from '../OverlayModal';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';

export function EditorPreview() {
  const [open, setOpen] = useState(false);
  const editor = useEditor();
  const [toolbar, setToolbar] = useState(false);
  const [alternateInput] = useSetting(settingsAtom, 'alternateInput');

  return (
    <>
      <IconButton variant="SurfaceVariant" onClick={() => setOpen(!open)}>
        <Icon src={Icons.BlockQuote} />
      </IconButton>
      <OverlayModal open={open} requestClose={() => setOpen(false)}>
            <Modal size="500">
              <div style={{ padding: config.space.S400 }}>
                <CustomEditor
                  editor={editor}
                  before={
                    <IconButton variant="SurfaceVariant" size="300" radii="300">
                      <Icon src={Icons.PlusCircle} />
                    </IconButton>
                  }
                  after={
                    <>
                      <IconButton
                        variant="SurfaceVariant"
                        size="300"
                        radii="300"
                        onClick={() => setToolbar(!toolbar)}
                        aria-pressed={toolbar}
                      >
                        <Icon src={toolbar ? Icons.AlphabetUnderline : Icons.Alphabet} />
                      </IconButton>
                      <IconButton variant="SurfaceVariant" size="300" radii="300">
                        <Icon src={Icons.Smile} />
                      </IconButton>
                      <IconButton variant="SurfaceVariant" size="300" radii="300">
                        <Icon src={Icons.Send} />
                      </IconButton>
                    </>
                  }
                  bottom={
                    !alternateInput && toolbar && (
                      <div>
                        <Line variant="SurfaceVariant" size="300" />
                        <Toolbar />
                      </div>
                    )
                  }
                />
              </div>
            </Modal>
      </OverlayModal>
    </>
  );
}
