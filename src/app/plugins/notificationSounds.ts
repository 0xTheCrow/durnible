import type { NotificationSoundId } from '../state/settings';
import StealthSound from '../../../public/sound/stealth.mp3';
import LowKeySound from '../../../public/sound/low-key.mp3';
import ExuberantSound from '../../../public/sound/exuberant.mp3';
import AttentionSound from '../../../public/sound/attention.mp3';
import ChimeSound from '../../../public/sound/notification.ogg';
import MelodySound from '../../../public/sound/invite.ogg';

type NotificationSoundSpec = {
  name: string;
  url: string;
};

export const NOTIFICATION_SOUNDS: Record<NotificationSoundId, NotificationSoundSpec> = {
  stealth: { name: 'Stealth', url: StealthSound },
  'low-key': { name: 'Low-key', url: LowKeySound },
  exuberant: { name: 'Exuberant', url: ExuberantSound },
  attention: { name: 'Attention', url: AttentionSound },
  chime: { name: 'Chime', url: ChimeSound },
  melody: { name: 'Melody', url: MelodySound },
};

export const NOTIFICATION_SOUND_OPTIONS: NotificationSoundId[] = [
  'stealth',
  'low-key',
  'exuberant',
  'attention',
  'chime',
  'melody',
];

const FALLBACK_NOTIFICATION_SOUND_ID: NotificationSoundId = 'stealth';

export const getNotificationSoundName = (soundId: NotificationSoundId): string =>
  NOTIFICATION_SOUNDS[soundId]?.name ?? NOTIFICATION_SOUNDS[FALLBACK_NOTIFICATION_SOUND_ID].name;

export const getNotificationSoundUrl = (soundId: NotificationSoundId): string =>
  NOTIFICATION_SOUNDS[soundId]?.url ?? NOTIFICATION_SOUNDS[FALLBACK_NOTIFICATION_SOUND_ID].url;
