import React from 'react';
import { Box, Button, Icon, IconButton, Icons, Input, Text } from 'folds';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import type { SettingsSearchState } from './useSettingsSearch';

type SettingsSearchInputProps = {
  search: SettingsSearchState;
  placeholder: string;
};
export function SettingsSearchInput({ search, placeholder }: SettingsSearchInputProps) {
  const isMobile = useScreenSizeContext() === ScreenSize.Mobile;
  const { searchInput, isSearching, handleSearchInputChange, handleSearchSubmit, clearSearch } =
    search;

  return (
    <Box as="form" onSubmit={handleSearchSubmit} gap="200" alignItems="Center" shrink="No">
      <Box grow="Yes">
        <Input
          style={{ width: '100%' }}
          variant="Background"
          size="300"
          radii="400"
          autoFocus={!isMobile}
          placeholder={placeholder}
          before={<Icon src={Icons.Search} size="100" />}
          value={searchInput}
          onChange={handleSearchInputChange}
          after={
            searchInput ? (
              <IconButton
                type="button"
                size="300"
                onClick={clearSearch}
                variant="Background"
                radii="Pill"
                aria-label="Clear search"
              >
                <Icon src={Icons.Cross} size="100" />
              </IconButton>
            ) : undefined
          }
        />
      </Box>
      {isMobile && searchInput && !isSearching && (
        <Button type="submit" size="300" variant="Primary" radii="400">
          <Text size="B300">Search</Text>
        </Button>
      )}
    </Box>
  );
}
