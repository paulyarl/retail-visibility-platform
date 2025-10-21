/**
 * Feature-guarded translation hook
 * Falls back to raw strings when FF_I18N_SCAFFOLD is OFF
 * REQ: REQ-2025-903
 */
'use client';

import { useTranslation as useI18nextTranslation } from 'react-i18next';
import { FF_I18N_SCAFFOLD } from './i18n';

export function useTranslation() {
  const i18next = FF_I18N_SCAFFOLD ? useI18nextTranslation() : null;

  /**
   * Translation function with fallback
   * When flag is OFF, returns the key as-is (raw string passthrough)
   * When flag is ON, uses i18next translation
   */
  const t = (key: string, fallback?: string): string => {
    if (!FF_I18N_SCAFFOLD) {
      return fallback || key;
    }
    return i18next?.t(key) || fallback || key;
  };

  return { t, i18n: i18next?.i18n };
}
