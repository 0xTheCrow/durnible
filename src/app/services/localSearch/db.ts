import Dexie, { type Table } from 'dexie';

export interface IndexedMessage {
  event_id: string;
  room_id: string;
  sender: string;
  origin_server_ts: number;
  user_id: string;
  body: string;
  type: string;
}

export interface RoomMeta {
  room_id: string;
  fetched_until_ts: number;
  fetched_from_ts: number;
}

export interface UserMeta {
  key: string;
  user_id: string;
}

class SearchDatabase extends Dexie {
  messages!: Table<IndexedMessage, string>;

  roomMeta!: Table<RoomMeta, string>;

  userMeta!: Table<UserMeta, string>;

  constructor() {
    super('cinny-search-index');
    this.version(1).stores({
      messages: 'event_id, room_id, origin_server_ts, user_id',
      roomMeta: 'room_id',
      userMeta: 'key',
    });
  }
}

export const searchDb = new SearchDatabase();
