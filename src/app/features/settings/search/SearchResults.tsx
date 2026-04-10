import React, { useMemo } from 'react';
import { Box, Button, Icon, IconButton, Icons, Scroll, Text } from 'folds';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import type { SettingsPages } from '../settingsPages';
import type { SearchEntry } from './searchData';
import { settingsSearchData } from './searchData';

type SearchResultsProps = {
  query: string;
  requestClose: () => void;
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

export function SearchResults({ query, requestClose, onNavigateTo }: SearchResultsProps) {
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

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              Search Results
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
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
