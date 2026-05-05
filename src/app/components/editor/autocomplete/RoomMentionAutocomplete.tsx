import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import React, { useCallback, useEffect } from 'react';
import { Avatar, Icon, Icons, MenuItem, Text } from 'folds';
import type { MatrixClient } from 'matrix-js-sdk';
import { JoinRule } from 'matrix-js-sdk';
import { useAtomValue } from 'jotai';

import { getDirectRoomAvatarUrl } from '../../../utils/room';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import type { AutocompleteQuery } from './autocompleteQuery';
import { AutocompleteMenu } from './AutocompleteMenu';
import { getMxIdServer, isRoomAlias } from '../../../utils/matrix';
import type { UseAsyncSearchOptions } from '../../../hooks/useAsyncSearch';
import { useAsyncSearch } from '../../../hooks/useAsyncSearch';
import { onTabPress } from '../../../utils/keyboard';
import { useKeyDown } from '../../../hooks/useKeyDown';
import { mDirectAtom } from '../../../state/mDirectList';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import { factoryRoomIdByActivity } from '../../../utils/sort';
import { RoomAvatar, RoomIcon } from '../../room-avatar';

type MentionAutoCompleteHandler = (roomAliasOrId: string, name: string) => void;

const roomAliasFromQueryText = (mx: MatrixClient, text: string) =>
  isRoomAlias(`#${text}`)
    ? `#${text}`
    : `#${text}${text.endsWith(':') ? '' : ':'}${getMxIdServer(mx.getUserId() ?? '')}`;

function UnknownRoomMentionItem({
  query,
  handleAutocomplete,
}: {
  query: AutocompleteQuery<string>;
  handleAutocomplete: MentionAutoCompleteHandler;
}) {
  const mx = useMatrixClient();
  const roomAlias: string = roomAliasFromQueryText(mx, query.text);

  const handleSelect = () => handleAutocomplete(roomAlias, roomAlias);

  return (
    <MenuItem
      as="button"
      radii="300"
      onKeyDown={(evt: ReactKeyboardEvent<HTMLButtonElement>) => onTabPress(evt, handleSelect)}
      onClick={handleSelect}
      before={
        <Avatar size="200">
          <Icon src={Icons.Hash} size="100" />
        </Avatar>
      }
    >
      <Text style={{ flexGrow: 1 }} size="B400">
        {roomAlias}
      </Text>
    </MenuItem>
  );
}

type RoomMentionAutocompleteProps = {
  query: AutocompleteQuery<string>;
  onClose: () => void;
  onSelect: (roomAliasOrId: string, name: string) => void;
};

const SEARCH_OPTIONS: UseAsyncSearchOptions = {
  matchOptions: {
    contain: true,
  },
};

export function RoomMentionAutocomplete({
  query,
  onClose,
  onSelect,
}: RoomMentionAutocompleteProps) {
  const mx = useMatrixClient();
  const mDirects = useAtomValue(mDirectAtom);

  const allRooms = useAtomValue(allRoomsAtom).sort(factoryRoomIdByActivity(mx));

  const [result, search, resetSearch] = useAsyncSearch(
    allRooms,
    useCallback(
      (rId) => {
        const r = mx.getRoom(rId);
        if (!r) return 'Unknown Room';
        const alias = r.getCanonicalAlias();
        if (alias) return [r.name, alias];
        return r.name;
      },
      [mx]
    ),
    SEARCH_OPTIONS
  );

  const autoCompleteRoomIds = result ? result.items.slice(0, 20) : allRooms.slice(0, 20);

  useEffect(() => {
    if (query.text) search(query.text);
    else resetSearch();
  }, [query.text, search, resetSearch]);

  const handleAutocomplete: MentionAutoCompleteHandler = (roomAliasOrId, name) => {
    onSelect(roomAliasOrId, name);
    onClose();
  };

  useKeyDown(window, (evt: KeyboardEvent) => {
    onTabPress(evt, () => {
      if (evt.target instanceof HTMLButtonElement) return;
      if (autoCompleteRoomIds.length === 0) {
        const alias = roomAliasFromQueryText(mx, query.text);
        handleAutocomplete(alias, alias);
        return;
      }
      const rId = autoCompleteRoomIds[0];
      const r = mx.getRoom(rId);
      const name = r?.name ?? rId;
      handleAutocomplete(r?.getCanonicalAlias() ?? rId, name);
    });
  });

  return (
    <AutocompleteMenu headerContent={<Text size="L400">Rooms</Text>} onClose={onClose}>
      {autoCompleteRoomIds.length === 0 ? (
        <UnknownRoomMentionItem query={query} handleAutocomplete={handleAutocomplete} />
      ) : (
        autoCompleteRoomIds.map((rId) => {
          const room = mx.getRoom(rId);
          if (!room) return null;
          const dm = mDirects.has(room.roomId);

          const handleSelect = () => handleAutocomplete(room.getCanonicalAlias() ?? rId, room.name);

          return (
            <MenuItem
              key={rId}
              as="button"
              radii="300"
              onKeyDown={(evt: ReactKeyboardEvent<HTMLButtonElement>) =>
                onTabPress(evt, handleSelect)
              }
              onClick={handleSelect}
              after={
                <Text size="T200" priority="300" truncate>
                  {room.getCanonicalAlias() ?? ''}
                </Text>
              }
              before={
                <Avatar size="200">
                  {dm ? (
                    <RoomAvatar
                      roomId={room.roomId}
                      src={getDirectRoomAvatarUrl(mx, room)}
                      alt={room.name}
                      renderFallback={() => (
                        <RoomIcon
                          size="50"
                          joinRule={room.getJoinRule() ?? JoinRule.Restricted}
                          filled
                        />
                      )}
                    />
                  ) : (
                    <RoomIcon size="100" joinRule={room.getJoinRule()} space={room.isSpaceRoom()} />
                  )}
                </Avatar>
              }
            >
              <Text style={{ flexGrow: 1 }} size="B400" truncate>
                {room.name}
              </Text>
            </MenuItem>
          );
        })
      )}
    </AutocompleteMenu>
  );
}
