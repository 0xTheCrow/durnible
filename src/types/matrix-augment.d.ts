export {};

declare module 'matrix-js-sdk/lib/@types/event.ts' {
  interface AccountDataEvents {
    'in.cinny.spaces': Record<string, unknown>;
    'in.cinny.sticker_pack_order': Record<string, unknown>;
    'in.cinny.favorite_emoji': Record<string, unknown>;
    'io.element.recent_emoji': Record<string, unknown>;
    'im.ponies.user_emotes': Record<string, unknown>;
    'im.ponies.emote_rooms': Record<string, unknown>;
  }

  interface StateEvents {
    'im.ponies.room_emotes': Record<string, unknown>;
    'in.cinny.room.power_level_tags': Record<string, unknown>;
  }
}
