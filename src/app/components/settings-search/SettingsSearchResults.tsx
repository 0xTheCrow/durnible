import React, { useMemo } from 'react';
import { Box, Button, config, Icon, IconButton, Icons, Scroll, Text } from 'folds';
import { Page, PageContent, PageHeader } from '../page';
import { SequenceCard } from '../sequence-card';
import { SettingTile } from '../setting-tile';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { SettingsCardStyle } from '../../styles/SettingsCard.css';
import type { SettingsSearchEntry } from './types';
import type { SettingsSearchState } from './useSettingsSearch';
import { SettingsSearchInput } from './SettingsSearchInput';

const matchesQuery = <TPage,>(entry: SettingsSearchEntry<TPage>, query: string): boolean =>
  entry.title.toLowerCase().includes(query) ||
  (entry.description?.toLowerCase().includes(query) ?? false) ||
  (entry.keywords?.some((keyword) => keyword.toLowerCase().includes(query)) ?? false);

type ResultGroup<TPage> = {
  pageName: string;
  sectionName: string;
  entries: SettingsSearchEntry<TPage>[];
};

const groupResults = <TPage,>(results: SettingsSearchEntry<TPage>[]): ResultGroup<TPage>[] => {
  const groups = new Map<string, ResultGroup<TPage>>();

  results.forEach((entry) => {
    const key = `${entry.pageName}__${entry.sectionName}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        pageName: entry.pageName,
        sectionName: entry.sectionName,
        entries: [],
      };
      groups.set(key, group);
    }
    group.entries.push(entry);
  });

  return Array.from(groups.values());
};

type SettingsSearchResultsProps<TPage> = {
  search: SettingsSearchState;
  entries: SettingsSearchEntry<TPage>[];
  searchPlaceholder: string;
  onClose: () => void;
  onNavigateTo: (page: TPage) => void;
};
export function SettingsSearchResults<TPage>({
  search,
  entries,
  searchPlaceholder,
  onClose,
  onNavigateTo,
}: SettingsSearchResultsProps<TPage>) {
  const isMobile = useScreenSizeContext() === ScreenSize.Mobile;
  const { searchQuery, clearSearch } = search;

  const groups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return groupResults(entries.filter((entry) => matchesQuery(entry, query)));
  }, [entries, searchQuery]);

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          {isMobile && (
            <Box shrink="No">
              <IconButton onClick={clearSearch} variant="Surface" aria-label="Back to settings">
                <Icon src={Icons.ArrowLeft} />
              </IconButton>
            </Box>
          )}
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              Search Results
            </Text>
            <Button
              size="300"
              variant="Secondary"
              fill="Soft"
              radii="300"
              outlined
              onClick={clearSearch}
            >
              <Text size="B300">Clear</Text>
            </Button>
          </Box>
          <Box shrink="No">
            <IconButton onClick={onClose} variant="Surface" aria-label="Close settings">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      {isMobile && (
        <Box
          style={{ padding: `0 ${config.space.S400} ${config.space.S200}` }}
          shrink="No"
          direction="Column"
        >
          <SettingsSearchInput search={search} placeholder={searchPlaceholder} />
        </Box>
      )}
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              {groups.length === 0 && searchQuery.trim() && (
                <Box direction="Column" alignItems="Center" gap="300">
                  <Text size="T300" priority="300">
                    No settings found for &ldquo;{searchQuery}&rdquo;
                  </Text>
                </Box>
              )}
              {groups.map((group) => (
                <Box key={`${group.pageName}__${group.sectionName}`} direction="Column" gap="100">
                  <Text size="L400">
                    {group.pageName} › {group.sectionName}
                  </Text>
                  {group.entries.map((entry) => {
                    if (entry.Render && entry.hasOwnCard) {
                      return <entry.Render key={entry.id} onClose={onClose} />;
                    }
                    return (
                      <SequenceCard
                        key={entry.id}
                        className={SettingsCardStyle}
                        variant="SurfaceVariant"
                        direction="Column"
                        gap="400"
                      >
                        {entry.Render ? (
                          <entry.Render onClose={onClose} />
                        ) : (
                          <SettingTile
                            title={entry.title}
                            description={entry.description}
                            after={
                              <Button
                                size="300"
                                variant="Secondary"
                                fill="Soft"
                                radii="300"
                                outlined
                                onClick={() => onNavigateTo(entry.page)}
                              >
                                <Text size="T300">Go to {entry.pageName}</Text>
                              </Button>
                            }
                          />
                        )}
                      </SequenceCard>
                    );
                  })}
                </Box>
              ))}
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
