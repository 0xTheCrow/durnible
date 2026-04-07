import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend, { HttpBackendOptions } from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';
import { trimTrailingSlash } from './utils/common';

export function setupI18n(localesPath?: string): void {
  if (i18n.isInitialized) return;

  const instance = i18n.use(LanguageDetector).use(initReactI18next);
  if (localesPath) {
    instance.use(Backend);
  }

  instance.init<HttpBackendOptions>({
    debug: false,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    load: 'languageOnly',
    ...(localesPath
      ? {
          backend: {
            loadPath: `${trimTrailingSlash(localesPath)}/{{lng}}.json`,
          },
        }
      : {}),
  });
}

export default i18n;
