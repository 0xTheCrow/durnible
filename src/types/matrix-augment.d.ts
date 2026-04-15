// Module augmentation for matrix-js-sdk.
//
// The SDK exposes `StateEvents`, `AccountDataEvents`, and `TimelineEvents`
// as open interfaces so downstream projects can register custom event types
// with their content shapes. Adding a key here lets the existing
// `mx.sendStateEvent` / `mx.sendEvent` / `mx.setAccountData` generics resolve
// without a cast, and also gives us real content-type checking at those sites.
//
// Augmentation is global once this file is part of the TS project — no import
// is required anywhere else.

import type { PollResponseEventContent } from 'matrix-js-sdk/lib/@types/polls.ts';
import type { PackContent, EmoteRoomsContent } from '../app/plugins/custom-emoji/types';
import type { InCinnySpacesContent } from '../app/hooks/useSidebarItems';
import type { StickerPackOrderContent } from '../app/hooks/useStickerPackOrder';
import type { FavoriteEmojiContent } from '../app/plugins/favorite-emoji';
import type { RecentEmojiContent } from '../app/plugins/recent-emoji';
import type { PowerLevelTags } from '../app/hooks/usePowerLevelTags';

declare module 'matrix-js-sdk/lib/@types/event.ts' {
  interface AccountDataEvents {
    'in.cinny.spaces': InCinnySpacesContent;
    'in.cinny.sticker_pack_order': StickerPackOrderContent;
    'in.cinny.favorite_emoji': FavoriteEmojiContent;
    'io.element.recent_emoji': RecentEmojiContent;
    'im.ponies.user_emotes': PackContent;
    'im.ponies.emote_rooms': EmoteRoomsContent;
  }

  interface StateEvents {
    'im.ponies.room_emotes': PackContent;
    'in.cinny.room.power_level_tags': PowerLevelTags;
  }

  interface TimelineEvents {
    'org.matrix.msc3381.poll.response': PollResponseEventContent;
  }
}
