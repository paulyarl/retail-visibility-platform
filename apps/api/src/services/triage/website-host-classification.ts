/**
 * Website Host Classification — shared social/builder host sets
 *
 * Classifies a website URL's host as a social/messaging/profile platform
 * (`WC_THIRD_PARTY_DOMAIN`) or a free builder subdomain (`WC_BUILDER_SUBDOMAIN`).
 *
 * The SAME classification must be reached by three consumers, or the signals
 * disagree with each other:
 *   - `triage/signal-extractor.ts` (§5 derived detection)
 *   - `outreach-openers/archetype-selection.ts` (A7 branch)
 *   - `outreach-openers/field-extractors.ts` (A7Fields)
 * So the host sets live here, not inline in any one of them.
 *
 * Matching is SUFFIX-based (host === entry OR host endsWith '.' + entry) so
 * `m.facebook.com`, `api.whatsapp.com`, and `wa.me` all catch.
 *
 * Spec: docs/LocalBiz/WEBSITE_GAP_AUDIT_PLAYBOOK_SPEC.md §3, §5, §7
 * (OQ-4 — host list governance: registry-izing these is deferred until a
 * second non-code consumer exists; for v1 they are code constants.)
 */

// ─── Host sets ───────────────────────────────────────────────────────────

/**
 * Social / messaging / profile platforms. A `website.url` on one of these
 * means "the website field is a social page" — absence-class gap.
 */
export const SOCIAL_PLATFORM_HOSTS: readonly string[] = [
  'facebook.com',
  'instagram.com',
  'wa.me',
  'api.whatsapp.com',
  'whatsapp.com',
  'x.com',
  'twitter.com',
  'tiktok.com',
  'linktr.ee',
  'yelp.com',
  'nextdoor.com',
  't.me',
  'm.me',
  'threads.net',
  'snapchat.com',
];

/**
 * Free builder subdomains. A live page, but no owned domain — absence-class.
 * Note these are SUFFIX entries: `*.wixsite.com` catches `myshop.wixsite.com`.
 */
export const BUILDER_SUBDOMAIN_HOSTS: readonly string[] = [
  'wixsite.com',
  'wordpress.com',
  'godaddysites.com',
  'weebly.com',
  'square.site',
  'business.site',
  'blogspot.com',
  'tripod.com',
  'angelfire.com',
  'homestead.com',
  'webs.com',
  'jimdo.com',
  'site123.me',
  'strikingly.com',
  'webnode.com',
  'myshopify.com',
  'bigcartel.com',
];

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Extract a normalized lowercase hostname from a URL. Tolerant of bare hosts
 * without a scheme (audit fields sometimes carry `facebook.com/page`).
 * Returns null when no host can be parsed.
 */
export function hostnameOf(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    // Prepend a scheme when absent so `new URL` accepts a bare host.
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const host = new URL(candidate).hostname.toLowerCase();
    // Strip a leading www. so www.facebook.com matches facebook.com.
    return host.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

function hostMatches(host: string, entries: readonly string[]): boolean {
  return entries.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

/** True when the host is a social/messaging/profile platform. */
export function isSocialPlatformHost(url: string | null | undefined): boolean {
  const host = hostnameOf(url);
  return host !== null && hostMatches(host, SOCIAL_PLATFORM_HOSTS);
}

/** True when the host is a free builder subdomain. */
export function isBuilderSubdomainHost(url: string | null | undefined): boolean {
  const host = hostnameOf(url);
  return host !== null && hostMatches(host, BUILDER_SUBDOMAIN_HOSTS);
}

/** Human-readable platform name for a third-party host (e.g. "Facebook"). */
export function thirdPartyPlatformLabel(url: string | null | undefined): string | null {
  const host = hostnameOf(url);
  if (!host) return null;
  const LABELS: Record<string, string> = {
    'facebook.com': 'Facebook',
    'instagram.com': 'Instagram',
    'wa.me': 'WhatsApp',
    'api.whatsapp.com': 'WhatsApp',
    'whatsapp.com': 'WhatsApp',
    'x.com': 'X',
    'twitter.com': 'Twitter',
    'tiktok.com': 'TikTok',
    'linktr.ee': 'Linktree',
    'yelp.com': 'Yelp',
    'nextdoor.com': 'Nextdoor',
    't.me': 'Telegram',
    'm.me': 'Messenger',
    'threads.net': 'Threads',
    'snapchat.com': 'Snapchat',
  };
  for (const entry of SOCIAL_PLATFORM_HOSTS) {
    if (host === entry || host.endsWith(`.${entry}`)) return LABELS[entry] ?? entry;
  }
  return null;
}
