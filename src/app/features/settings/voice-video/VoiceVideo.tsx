import type { MouseEventHandler } from 'react';
import React, { useState } from 'react';
import type { RectCords } from 'folds';
import {
  Badge,
  Box,
  Button,
  color,
  config,
  Icon,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  ProgressBar,
  Scroll,
  Switch,
  Text,
  toRem,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { Range } from 'react-range';
import { Page, PageContent } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SettingsCardStyle } from '../../../styles/SettingsCard.css';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { useMediaDevices } from '../../../hooks/useMediaDevices';
import { useMicrophoneInputLevel } from '../../../hooks/call/useMicrophoneInputLevel';
import { requestMediaPermission } from '../../../plugins/call/localMedia';
import { SettingsPageHeader } from '../components';
import { stopPropagation } from '../../../utils/keyboard';

type SelectMediaDeviceProps = {
  devices: MediaDeviceInfo[];
  fallbackLabel: string;
  selectedDeviceId?: string;
  onSelect: (deviceId?: string) => void;
};
function SelectMediaDevice({
  devices,
  fallbackLabel,
  selectedDeviceId,
  onSelect,
}: SelectMediaDeviceProps) {
  const [menuCords, setMenuCords] = useState<RectCords>();

  const getDeviceName = (device: MediaDeviceInfo, index: number) =>
    device.label || `${fallbackLabel} ${index + 1}`;

  const selectedDevice = devices.find((device) => device.deviceId === selectedDeviceId);
  const selectedName = selectedDevice
    ? getDeviceName(selectedDevice, devices.indexOf(selectedDevice))
    : 'Default';

  const handleMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuCords(evt.currentTarget.getBoundingClientRect());
  };

  const handleSelect = (deviceId?: string) => {
    onSelect(deviceId);
    setMenuCords(undefined);
  };

  return (
    <>
      <Button
        size="300"
        variant="Secondary"
        outlined
        fill="Soft"
        radii="300"
        after={<Icon size="300" src={Icons.ChevronBottom} />}
        onClick={handleMenu}
      >
        <Text size="T300">{selectedName}</Text>
      </Button>
      <PopOut
        anchor={menuCords}
        offset={5}
        position="Bottom"
        align="End"
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setMenuCords(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowDown' || evt.key === 'ArrowRight',
              isKeyBackward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowUp' || evt.key === 'ArrowLeft',
              escapeDeactivates: stopPropagation,
            }}
          >
            <Menu>
              <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                <MenuItem
                  size="300"
                  variant={selectedDevice === undefined ? 'Primary' : 'Surface'}
                  radii="300"
                  onClick={() => handleSelect(undefined)}
                >
                  <Text size="T300">Default</Text>
                </MenuItem>
                {devices.map((device, index) => (
                  <MenuItem
                    key={device.deviceId}
                    size="300"
                    variant={device.deviceId === selectedDeviceId ? 'Primary' : 'Surface'}
                    radii="300"
                    onClick={() => handleSelect(device.deviceId)}
                  >
                    <Text size="T300">{getDeviceName(device, index)}</Text>
                  </MenuItem>
                ))}
              </Box>
            </Menu>
          </FocusTrap>
        }
      />
    </>
  );
}

export function MicrophoneDeviceSetting() {
  const { audioInputDevices } = useMediaDevices();
  const [preferredAudioInputDeviceId, setPreferredAudioInputDeviceId] = useSetting(
    settingsAtom,
    'preferredAudioInputDeviceId'
  );
  return (
    <SettingTile
      title="Microphone"
      after={
        <SelectMediaDevice
          devices={audioInputDevices}
          fallbackLabel="Microphone"
          selectedDeviceId={preferredAudioInputDeviceId}
          onSelect={setPreferredAudioInputDeviceId}
        />
      }
    />
  );
}

export function MicrophoneInputFloorSetting() {
  const [preferredAudioInputDeviceId] = useSetting(settingsAtom, 'preferredAudioInputDeviceId');
  const [microphoneInputFloorLevel, setMicrophoneInputFloorLevel] = useSetting(
    settingsAtom,
    'microphoneInputFloorLevel'
  );
  const { inputLevel, isMicrophoneAvailable } = useMicrophoneInputLevel(
    preferredAudioInputDeviceId
  );
  const isInputAboveFloor = inputLevel > 0 && inputLevel >= microphoneInputFloorLevel;

  return (
    <SettingTile
      title="Input Floor"
      description={
        isMicrophoneAvailable
          ? 'Audio quieter than the cutoff is not sent to the call. The bar shows your current input volume.'
          : 'Allow microphone access to preview your input volume.'
      }
    >
      <Box direction="Column" gap="200" style={{ paddingTop: config.space.S200 }}>
        <Range
          step={0.01}
          min={0}
          max={1}
          values={[microphoneInputFloorLevel]}
          onChange={(values) => setMicrophoneInputFloorLevel(values[0])}
          renderTrack={(params) => (
            <div
              {...params.props}
              style={{
                ...params.props.style,
                width: '100%',
                height: toRem(16),
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {params.children}
              <ProgressBar
                style={{ width: '100%', backgroundColor: color.SurfaceVariant.ContainerActive }}
                variant={isInputAboveFloor ? 'Success' : 'Secondary'}
                size="400"
                min={0}
                max={1}
                value={inputLevel}
                radii="300"
              />
            </div>
          )}
          renderThumb={(params) => (
            <Badge
              size="400"
              variant="Secondary"
              fill="Solid"
              radii="Pill"
              outlined
              {...params.props}
              style={{ ...params.props.style, zIndex: 0 }}
            />
          )}
        />
        <Text size="T200" priority="300">
          {microphoneInputFloorLevel === 0
            ? 'Cutoff: Off'
            : `Cutoff: ${Math.round(microphoneInputFloorLevel * 100)}%`}
        </Text>
      </Box>
    </SettingTile>
  );
}

export function CameraDeviceSetting() {
  const { videoInputDevices } = useMediaDevices();
  const [preferredVideoInputDeviceId, setPreferredVideoInputDeviceId] = useSetting(
    settingsAtom,
    'preferredVideoInputDeviceId'
  );
  return (
    <SettingTile
      title="Camera"
      after={
        <SelectMediaDevice
          devices={videoInputDevices}
          fallbackLabel="Camera"
          selectedDeviceId={preferredVideoInputDeviceId}
          onSelect={setPreferredVideoInputDeviceId}
        />
      }
    />
  );
}

export function SpeakerDeviceSetting() {
  const { audioOutputDevices } = useMediaDevices();
  const [preferredAudioOutputDeviceId, setPreferredAudioOutputDeviceId] = useSetting(
    settingsAtom,
    'preferredAudioOutputDeviceId'
  );
  return (
    <SettingTile
      title="Speaker"
      after={
        <SelectMediaDevice
          devices={audioOutputDevices}
          fallbackLabel="Speaker"
          selectedDeviceId={preferredAudioOutputDeviceId}
          onSelect={setPreferredAudioOutputDeviceId}
        />
      }
    />
  );
}

export function PreJoinScreenSetting() {
  const [showCallPreJoinScreen, setShowCallPreJoinScreen] = useSetting(
    settingsAtom,
    'showCallPreJoinScreen'
  );
  return (
    <SettingTile
      title="Pre-Join Screen"
      description="Review your devices on a pre-join screen instead of joining calls instantly."
      after={
        <Switch
          variant="Primary"
          value={showCallPreJoinScreen}
          onChange={setShowCallPreJoinScreen}
        />
      }
    />
  );
}

export function DeviceAccessCard() {
  const { audioInputDevices, videoInputDevices, audioOutputDevices, refreshDevices } =
    useMediaDevices();
  const hasDeviceLabels = [...audioInputDevices, ...videoInputDevices, ...audioOutputDevices].some(
    (device) => device.label !== ''
  );
  if (hasDeviceLabels) return null;

  const handleRequestAccess = async () => {
    const isGranted = await requestMediaPermission({ audio: true, video: true });
    if (!isGranted) await requestMediaPermission({ audio: true });
    await refreshDevices();
  };

  return (
    <SequenceCard
      className={SettingsCardStyle}
      variant="SurfaceVariant"
      direction="Column"
      gap="400"
    >
      <SettingTile
        title="Device Access"
        description="Allow microphone and camera access to see your device names."
        after={
          <Button
            size="300"
            variant="Secondary"
            fill="Soft"
            outlined
            radii="300"
            onClick={handleRequestAccess}
          >
            <Text size="B300">Allow Access</Text>
          </Button>
        }
      />
    </SequenceCard>
  );
}

type VoiceVideoProps = {
  onBack: () => void;
  onClose: () => void;
};
export function VoiceVideo({ onBack, onClose }: VoiceVideoProps) {
  return (
    <Page>
      <SettingsPageHeader title="Voice & Video" onBack={onBack} onClose={onClose} />
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <Box direction="Column" gap="100">
                <Text size="L400">Devices</Text>
                <DeviceAccessCard />
                <SequenceCard
                  className={SettingsCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <MicrophoneDeviceSetting />
                  <MicrophoneInputFloorSetting />
                </SequenceCard>
                <SequenceCard
                  className={SettingsCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <CameraDeviceSetting />
                </SequenceCard>
                <SequenceCard
                  className={SettingsCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SpeakerDeviceSetting />
                </SequenceCard>
              </Box>
              <Box direction="Column" gap="100">
                <Text size="L400">Calls</Text>
                <SequenceCard
                  className={SettingsCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <PreJoinScreenSetting />
                </SequenceCard>
              </Box>
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
