/**
 * UTM / referral parameter helpers for Pinterest and campaign attribution.
 *
 * Supported query params: ref, utm_source, utm_medium, utm_campaign, utm_content, utm_term
 */

export const UTM_KEYS = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export type UTMParams = Partial<Record<(typeof UTM_KEYS)[number], string>>;

const STORAGE_KEY = 'vs_utm_params';

export function getUTMParamsFromUrl(url?: string | URL): UTMParams {
  if (typeof window === 'undefined' && !url) return {};
  const search = url ? (typeof url === 'string' ? new URL(url).searchParams : url.searchParams) : new URLSearchParams(window.location.search);
  const params: UTMParams = {};
  for (const key of UTM_KEYS) {
    const value = search.get(key);
    if (value) {
      params[key] = value;
    }
  }
  return params;
}

export function storeUTMParams(params: UTMParams): void {
  if (typeof window === 'undefined') return;
  const existing = getStoredUTMParams();
  const merged = { ...existing, ...params };
  const trimmed: UTMParams = {};
  for (const key of UTM_KEYS) {
    if (merged[key]) trimmed[key] = merged[key];
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function getStoredUTMParams(): UTMParams {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UTMParams) : {};
  } catch {
    return {};
  }
}

export function clearStoredUTMParams(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function buildUTMQueryString(params: UTMParams): string {
  const search = new URLSearchParams();
  for (const key of UTM_KEYS) {
    if (params[key]) search.set(key, params[key]);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function mergeUTMIntoHref(href: string, params: UTMParams): string {
  if (!params || Object.keys(params).length === 0) return href;
  const [path, existingQs] = href.split('?');
  const search = new URLSearchParams(existingQs || '');
  for (const key of UTM_KEYS) {
    if (params[key] && !search.has(key)) {
      search.set(key, params[key]);
    }
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export function captureAndStoreUTMParams(): UTMParams {
  const params = getUTMParamsFromUrl();
  if (Object.keys(params).length > 0) {
    storeUTMParams(params);
  }
  return params;
}
