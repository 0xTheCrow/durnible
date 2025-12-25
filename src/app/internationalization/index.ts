import { Internationalization } from '@intee/core';
import { mean, startsWith } from '@intee/core/helpers/match';
import { pick } from '@intee/core/helpers/load';
import { InternationalizationReact } from '@intee/react';
import en from './translations/en';
import type { Translation } from './translations/en';

export type { Translation };

const i18n = new Internationalization(
  {
    tag: 'en',
    predicate: mean(startsWith('en'), startsWith('en-US')),
    loader: () => en,
  },
  {
    tag: 'zh-CN',
    predicate: mean(startsWith('zh'), startsWith('zh-CN')),
    loader: pick('default', () => import('./translations/zh-CN')),
  }
);

const { Provider, context, useTranslation } = new InternationalizationReact(i18n);

export { Provider, context, useTranslation };
