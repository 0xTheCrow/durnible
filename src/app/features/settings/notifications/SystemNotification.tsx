import React from 'react';
import { Box, Text, Switch, Button, color } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SettingsCardStyle } from '../../../styles/SettingsCard.css';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { getNotificationState, usePermissionState } from '../../../hooks/usePermission';
import { SelectNotificationSound } from '../components';

/*
function EmailNotification() {
  const mx = useMatrixClient();
  const [result, refreshResult] = useEmailNotifications();

  const [setState, setEnable] = useAsyncCallback(
    useCallback(
      async (email: string, enable: boolean) => {
        if (enable) {
          await mx.setPusher({
            kind: 'email',
            app_id: 'm.email',
            pushkey: email,
            app_display_name: 'Email Notifications',
            device_display_name: email,
            lang: 'en',
            data: {
              brand: 'Durnible',
            },
            append: true,
          });
          return;
        }
        await mx.setPusher({
          pushkey: email,
          app_id: 'm.email',
          kind: null,
        } as unknown as IPusherRequest);
      },
      [mx]
    )
  );

  const handleChange = (value: boolean) => {
    if (result && result.email) {
      setEnable(result.email, value).then(() => {
        refreshResult();
      });
    }
  };

  return (
    <SettingTile
      title="Email Notification"
      description={
        <>
          {result && !result.email && (
            <Text as="span" style={{ color: color.Critical.Main }} size="T200">
              Your account does not have any email attached.
            </Text>
          )}
          {result && result.email && <>Send notification to your email. {`("${result.email}")`}</>}
          {result === null && (
            <Text as="span" style={{ color: color.Critical.Main }} size="T200">
              Unexpected Error!
            </Text>
          )}
          {result === undefined && 'Send notification to your email.'}
        </>
      }
      after={
        <>
          {setState.status !== AsyncStatus.Loading &&
            typeof result === 'object' &&
            result?.email && <Switch value={result.enabled} onChange={handleChange} />}
          {(setState.status === AsyncStatus.Loading || result === undefined) && (
            <Spinner variant="Secondary" />
          )}
        </>
      }
    />
  );
}
*/

export function SystemNotification() {
  const notifPermission = usePermissionState('notifications', getNotificationState());
  const [showNotifications, setShowNotifications] = useSetting(settingsAtom, 'showNotifications');
  const [isNotificationSoundEnabled, setIsNotificationSoundEnabled] = useSetting(
    settingsAtom,
    'isNotificationSoundEnabled'
  );
  const [messageNotificationSoundId, setMessageNotificationSoundId] = useSetting(
    settingsAtom,
    'messageNotificationSoundId'
  );
  const [inviteNotificationSoundId, setInviteNotificationSoundId] = useSetting(
    settingsAtom,
    'inviteNotificationSoundId'
  );

  const requestNotificationPermission = () => {
    window.Notification.requestPermission();
  };

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">System</Text>
      <SequenceCard
        className={SettingsCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Desktop Notifications"
          description={
            notifPermission === 'denied' ? (
              <Text as="span" style={{ color: color.Critical.Main }} size="T200">
                {'Notification' in window
                  ? 'Notification permission is blocked. Please allow notification permission from browser address bar.'
                  : 'Notifications are not supported by the system.'}
              </Text>
            ) : (
              <span>Show desktop notifications when message arrive.</span>
            )
          }
          after={
            notifPermission === 'prompt' ? (
              <Button size="300" radii="300" onClick={requestNotificationPermission}>
                <Text size="B300">Enable</Text>
              </Button>
            ) : (
              <Switch
                disabled={notifPermission !== 'granted'}
                value={showNotifications}
                onChange={setShowNotifications}
              />
            )
          }
        />
      </SequenceCard>
      <SequenceCard
        className={SettingsCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Notification Sound"
          description="Play sound when new message arrive."
          after={
            <Switch value={isNotificationSoundEnabled} onChange={setIsNotificationSoundEnabled} />
          }
        />
        <SettingTile
          title="Message Sound"
          description="Sound played when a new message arrive."
          after={
            <SelectNotificationSound
              soundId={messageNotificationSoundId}
              disabled={!isNotificationSoundEnabled}
              onSelect={setMessageNotificationSoundId}
            />
          }
        />
        <SettingTile
          title="Invite Sound"
          description="Sound played when a new invitation arrive."
          after={
            <SelectNotificationSound
              soundId={inviteNotificationSoundId}
              disabled={!isNotificationSoundEnabled}
              onSelect={setInviteNotificationSoundId}
            />
          }
        />
      </SequenceCard>
      {/*
      <SequenceCard
        className={SettingsCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <EmailNotification />
      </SequenceCard>
      */}
    </Box>
  );
}
