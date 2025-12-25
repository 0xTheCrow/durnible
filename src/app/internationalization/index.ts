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
  },
  {
    tag: 'zh-TW',
    predicate: mean(startsWith('zh-TW'), startsWith('zh-Hant')),
    loader: pick('default', () => import('./translations/zh-TW')),
  },
  {
    tag: 'zh-HK',
    predicate: startsWith('zh-HK'),
    loader: pick('default', () => import('./translations/zh-HK')),
  },
  {
    tag: 'hi',
    predicate: startsWith('hi'),
    loader: pick('default', () => import('./translations/hi')),
  },
  {
    tag: 'es',
    predicate: startsWith('es'),
    loader: pick('default', () => import('./translations/es')),
  },
  {
    tag: 'fr',
    predicate: startsWith('fr'),
    loader: pick('default', () => import('./translations/fr')),
  },
  {
    tag: 'ar',
    predicate: startsWith('ar'),
    loader: pick('default', () => import('./translations/ar')),
  },
  {
    tag: 'bn',
    predicate: startsWith('bn'),
    loader: pick('default', () => import('./translations/bn')),
  },
  {
    tag: 'pt',
    predicate: startsWith('pt'),
    loader: pick('default', () => import('./translations/pt')),
  },
  {
    tag: 'ru',
    predicate: startsWith('ru'),
    loader: pick('default', () => import('./translations/ru')),
  },
  {
    tag: 'id',
    predicate: startsWith('id'),
    loader: pick('default', () => import('./translations/id')),
  },
  {
    tag: 'de',
    predicate: startsWith('de'),
    loader: pick('default', () => import('./translations/de')),
  },
);

const { Provider, context, useTranslation } = new InternationalizationReact(i18n);

export { Provider, context, useTranslation };
