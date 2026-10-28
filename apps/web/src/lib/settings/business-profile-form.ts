/**
 * Pure helpers for the Edit Business Profile form. Kept out of the modal so the
 * upload/normalization rules are unit-testable without rendering React.
 */

/**
 * Logo upload responds `{ url }`; older callers read `logo_url`/`dataUrl`. Accept
 * all three so the modal always stores the server URL — never the local data URL
 * the browser previewed while the upload was in flight.
 */
export function extractUploadedLogoUrl(payload: unknown): string | null {
  const record = payload as Record<string, unknown> | null | undefined;
  const candidate = record?.url || record?.logo_url || record?.dataUrl;
  return typeof candidate === 'string' && candidate.trim() !== '' ? candidate.trim() : null;
}

/** Legacy social key → the key every storefront surface reads. */
const SOCIAL_KEY_ALIASES: Record<string, string> = { x: 'twitter' };

export type SocialLinksInput =
  | Record<string, string | null | undefined>
  | Array<{ platform?: string; url?: string }>
  | null
  | undefined;

/**
 * Normalize social links for save: trim, drop blanks (a cleared field means "no
 * link" and must not persist as an empty string) and fold legacy aliases onto
 * their canonical key. The PATCH replaces the whole object, so the result is
 * the complete set of links the profile should keep.
 *
 * The claim flow stores `[{ platform, url }]` in the same column, so accept that
 * shape too and hand back the `{ platform: url }` object every reader expects.
 */
export function normalizeSocialLinks(links: SocialLinksInput): Record<string, string> | undefined {
  if (!links) return undefined;

  const entries: Array<[string, unknown]> = Array.isArray(links)
    ? links.map((entry) => [String(entry?.platform ?? ''), entry?.url])
    : Object.entries(links);

  const normalized: Record<string, string> = {};
  const aliased: Array<[string, string]> = [];

  for (const [rawKey, rawValue] of entries) {
    if (!rawKey || typeof rawValue !== 'string' || rawValue.trim() === '') continue;
    const canonical = SOCIAL_KEY_ALIASES[rawKey];
    if (canonical) {
      aliased.push([canonical, rawValue.trim()]);
    } else {
      normalized[rawKey] = rawValue.trim();
    }
  }

  // Canonical keys win over aliases when both are present.
  for (const [key, value] of aliased) {
    if (!normalized[key]) normalized[key] = value;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
