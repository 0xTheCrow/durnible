import type { SecretAccountData } from '../../../types/matrix/accountData';
import { AccountDataEvent } from '../../../types/matrix/accountData';
import { useAccountData } from '../events/useAccountData';

export const useCrossSigningActive = (): boolean => {
  const masterEvent = useAccountData(AccountDataEvent.CrossSigningMaster);
  const content = masterEvent?.getContent<SecretAccountData>();

  return !!content;
};
