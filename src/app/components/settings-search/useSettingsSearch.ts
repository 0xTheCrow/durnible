import type { ChangeEventHandler, FormEventHandler } from 'react';
import { useState } from 'react';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';

export type SettingsSearchState = {
  searchInput: string;
  searchQuery: string;
  isSearching: boolean;
  handleSearchInputChange: ChangeEventHandler<HTMLInputElement>;
  handleSearchSubmit: FormEventHandler<HTMLFormElement>;
  clearSearch: () => void;
};

export const useSettingsSearch = (): SettingsSearchState => {
  const isMobile = useScreenSizeContext() === ScreenSize.Mobile;
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearchInputChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    const nextInput = evt.target.value;
    setSearchInput(nextInput);

    if (!isMobile || isSearching) {
      setSearchQuery(nextInput);
      setIsSearching(nextInput.trim() !== '');
      return;
    }

    if (nextInput.trim() === '') {
      setSearchQuery(nextInput);
    }
  };

  const handleSearchSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    setSearchQuery(searchInput);
    if (searchInput.trim() !== '') {
      setIsSearching(true);
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setIsSearching(false);
  };

  return {
    searchInput,
    searchQuery,
    isSearching,
    handleSearchInputChange,
    handleSearchSubmit,
    clearSearch,
  };
};
