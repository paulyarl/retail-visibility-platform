/**
 * i18n configuration with feature flag guard
 * REQ: REQ-2025-903
 * Feature Flag: FF_I18N_SCAFFOLD (default OFF)
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from '../locales/en-US.json';

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
      },
      lng: 'en-US',
      fallbackLng: 'en-US',
      interpolation: {
        escapeValue: false, // React already escapes
      },
    });
}

export { i18n, FF_I18N_SCAFFOLD };
