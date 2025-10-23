/**
 * i18n configuration with feature flag guard
 * REQ: REQ-2025-903
 * Feature Flag: FF_I18N_SCAFFOLD (default OFF)
 * Supports: English (en-US), Spanish (es-ES), French (fr-FR)
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from '../locales/en-US.json';
import esES from '../locales/es-ES.json';
import frFR from '../locales/fr-FR.json';

const FF_I18N_SCAFFOLD = process.env.NEXT_PUBLIC_FF_I18N_SCAFFOLD === 'true';

// Only initialize i18next if flag is ON
if (FF_I18N_SCAFFOLD) {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        'en-US': {
          translation: enUS,
        },
        'es-ES': {
          translation: esES,
        },
        'fr-FR': {
          translation: frFR,
        },
      },
      lng: 'en-US',
      fallbackLng: 'en-US',
      supportedLngs: ['en-US', 'es-ES', 'fr-FR'],
      interpolation: {
        escapeValue: false, // React already escapes
      },
    });
}

export { i18n, FF_I18N_SCAFFOLD };
