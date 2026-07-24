import { useMemo } from 'react';
import {
  UTMParams,
  getStoredUTMParams,
  getUTMParamsFromUrl,
  mergeUTMIntoHref,
} from '@/lib/utm';

/**
 * React hook that returns the current page UTM params with fallback to stored session params.
 * Also provides a helper to append those params to an href without overwriting existing ones.
 */
export function useUTM() {
  const params = useMemo<UTMParams>(() => {
    if (typeof window === 'undefined') return {};
    const fromUrl = getUTMParamsFromUrl();
    const fromStorage = getStoredUTMParams();
    return { ...fromStorage, ...fromUrl };
  }, []);

  const withUTM = useMemo(() => {
    return (href: string) => mergeUTMIntoHref(href, params);
  }, [params]);

  return { params, withUTM };
}
