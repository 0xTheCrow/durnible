import React, { useCallback, useState } from 'react';
import { Box, Text, Scroll, Switch, Button } from 'folds';
import { Page, PageContent } from '../../../components/page';
import { SettingsPageHeader } from '../components';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import type { AccountDataSubmitCallback } from '../../../components/AccountDataEditor';
import { AccountDataEditor } from '../../../components/AccountDataEditor';
import { copyToClipboard } from '../../../utils/dom';
import { AccountData } from './AccountData';

type DeveloperToolsProps = {
  onBack: () => void;
  onClose: () => void;
};
export function DeveloperTools({ onBack, onClose }: DeveloperToolsProps) {
  const mx = useMatrixClient();
  const [developerTools, setDeveloperTools] = useSetting(settingsAtom, 'developerTools');
  const [expand, setExpend] = useState(false);
  const [accountDataType, setAccountDataType] = useState<string | null>();

  // Developer tools intentionally work with arbitrary event type strings from user input.
  // These casts are narrow and limited to this component.
  const mxRaw = mx as unknown as {
    setAccountData: (type: string, content: object) => Promise<void>;
    getAccountData: (type: string) => ReturnType<typeof mx.getAccountData>;
  };

  const submitAccountData: AccountDataSubmitCallback = useCallback(
    async (type, content) => {
      await mxRaw.setAccountData(type, content);
    },
    [mxRaw]
  );

  if (accountDataType !== undefined) {
    return (
      <AccountDataEditor
        type={accountDataType ?? undefined}
        content={accountDataType ? mxRaw.getAccountData(accountDataType)?.getContent() : undefined}
        onSubmit={submitAccountData}
        onClose={() => setAccountDataType(undefined)}
      />
    );
  }

  return (
    <Page>
      <SettingsPageHeader title="Developer Tools" onBack={onBack} onClose={onClose} />
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <Box direction="Column" gap="100">
                <Text size="L400">Options</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title="Enable Developer Tools"
                    after={
                      <Switch
                        variant="Primary"
                        value={developerTools}
                        onChange={setDeveloperTools}
                      />
                    }
                  />
                </SequenceCard>
                {developerTools && (
                  <SequenceCard
                    className={SequenceCardStyle}
                    variant="SurfaceVariant"
                    direction="Column"
                    gap="400"
                  >
                    <SettingTile
                      title="Access Token"
                      description="Copy access token to clipboard."
                      after={
                        <Button
                          onClick={() =>
                            copyToClipboard(mx.getAccessToken() ?? '<NO_ACCESS_TOKEN_FOUND>')
                          }
                          variant="Secondary"
                          fill="Soft"
                          size="300"
                          radii="300"
                          outlined
                        >
                          <Text size="B300">Copy</Text>
                        </Button>
                      }
                    />
                  </SequenceCard>
                )}
              </Box>
              {developerTools && (
                <AccountData
                  expand={expand}
                  onExpandToggle={setExpend}
                  onSelect={setAccountDataType}
                />
              )}
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
