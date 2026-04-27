import type { ChangeEventHandler } from 'react';
import React, { useMemo } from 'react';
import { Box, Button, config, Icon, IconButton, Icons, Input, Scroll, Text } from 'folds';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import type { SettingsPages } from '../settingsPages';
import type { SearchEntry } from './searchData';
import { settingsSearchData } from './searchData';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';

type SearchResultsProps = {
  query: string;
  onQueryChange: (query: string) => void;
  onBack: () => void;
  onClose: () => void;
  onNavigateTo: (page: SettingsPages) => void;
};

function matchesQuery(entry: SearchEntry, query: string): boolean {
  const q = query.toLowerCase();
  return (
    entry.title.toLowerCase().includes(q) ||
    (entry.description?.toLowerCase().includes(q) ?? false) ||
    (entry.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false)
  );
}

type GroupedResults = {
  pageName: string;
  sectionName: string;
  page: SettingsPages;
  entries: SearchEntry[];
};

export function SearchResults({
  query,
  onQueryChange,
  onBack,
  onClose,
  onNavigateTo,
}: SearchResultsProps) {
  const isMobile = useScreenSizeContext() === ScreenSize.Mobile;

  const results = useMemo(
    () => (query.trim() ? settingsSearchData.filter((e) => matchesQuery(e, query.trim())) : []),
    [query]
  );

  const grouped = useMemo<GroupedResults[]>(() => {
    const groups = new Map<string, GroupedResults>();
    for (const entry of results) {
      const key = `${entry.pageName}__${entry.sectionName}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          pageName: entry.pageName,
          sectionName: entry.sectionName,
          page: entry.page,
          entries: [],
        };
        groups.set(key, group);
      }
      group.entries.push(entry);
    }
    return Array.from(groups.values());
  }, [results]);

  const handleQueryChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    onQueryChange(evt.target.value);
  };

  const handleQueryClear = () => {
    onQueryChange('');
  };

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          {isMobile && (
            <Box shrink="No">
              <IconButton onClick={onBack} variant="Surface" aria-label="Back to settings">
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
              onClick={onBack}
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
          <Input
            style={{ width: '100%' }}
            variant="Background"
            size="300"
            radii="400"
            placeholder="Search settings..."
            before={<Icon src={Icons.Search} size="100" />}
            value={query}
            onChange={handleQueryChange}
            after={
              query ? (
                <IconButton
                  type="button"
                  size="300"
                  onClick={handleQueryClear}
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
      )}
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              {results.length === 0 && query.trim() && (
                <Box direction="Column" alignItems="Center" gap="300">
                  <Text size="T300" priority="300">
                    No settings found for &ldquo;{query}&rdquo;
                  </Text>
                </Box>
              )}
              {grouped.map((group) => (
                <Box key={`${group.pageName}__${group.sectionName}`} direction="Column" gap="100">
                  <Text size="L400">
                    {group.pageName} › {group.sectionName}
                  </Text>
                  <SequenceCard
                    className={SequenceCardStyle}
                    variant="SurfaceVariant"
                    direction="Column"
                    gap="400"
                  >
                    {group.entries.map((entry) =>
                      entry.Render ? (
                        <entry.Render key={entry.id} />
                      ) : (
                        <SettingTile
                          key={entry.id}
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
                      )
                    )}
                  </SequenceCard>
                </Box>
              ))}
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
