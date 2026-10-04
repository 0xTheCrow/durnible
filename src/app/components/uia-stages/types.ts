import type { AuthDict } from 'matrix-js-sdk';
import type { AuthStageData } from '../../hooks/auth/useUIAFlows';

export type StageComponentProps = {
  stageData: AuthStageData;
  submitAuthDict: (authDict: AuthDict) => void;
  onCancel: () => void;
};
