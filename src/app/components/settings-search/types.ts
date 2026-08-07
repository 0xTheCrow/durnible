import type { FC } from 'react';

export type SettingsSearchRenderProps = {
  onClose: () => void;
};

export type SettingsSearchEntry<TPage> = {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
  page: TPage;
  pageName: string;
  sectionName: string;
  Render?: FC<SettingsSearchRenderProps>;
  hasOwnCard?: boolean;
};
