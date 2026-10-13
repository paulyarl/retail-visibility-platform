/**
 * Channel vocabulary for the audit Channel & Offer Scan and the
 * product-visibility `*_observed_on` provenance companions
 * (docs/AUDIT_CHANNEL_SCAN_AND_OPPORTUNITY_COLLECTION_SPEC.md §A/§B).
 *
 * The `website.*` product-visibility fields stay namespaced there for schema
 * stability; the companions record which rendered public surface the
 * determination actually came from. `surfaceNoun`/`surfaceRef` map a channel
 * value to owner-facing phrasing so report/deliverable copy never claims a
 * channel-sourced fact as a site fact.
 */

export const OBSERVED_ON_CHANNELS = [
  'instagram',
  'facebook',
  'tiktok',
  'whatsapp',
  'google',
  'yelp',
  'apple_maps',
  'bbb',
  'owned_site',
  'marketplace',
  'order_ahead_platform',
  'directory',
  'locator',
  'registry',
  'third_party',
  'other',
] as const;

export type ObservedOnChannel = (typeof OBSERVED_ON_CHANNELS)[number];

const SURFACE_NOUNS: Record<string, string> = {
  instagram: 'Instagram profile',
  facebook: 'Facebook page',
  tiktok: 'TikTok profile',
  whatsapp: 'WhatsApp profile',
  google: 'Google listing',
  yelp: 'Yelp profile',
  apple_maps: 'Apple Maps listing',
  bbb: 'BBB profile',
  owned_site: 'site',
  marketplace: 'marketplace listing',
  order_ahead_platform: 'online ordering page',
  directory: 'directory listing',
  locator: 'locator record',
  registry: 'registry record',
  third_party: 'third-party page',
  other: 'online surface',
};

/**
 * Owner-facing noun for a channel value — "Instagram profile",
 * "marketplace listing". `owned_site` and null/undefined both return 'site':
 * legacy audits predate the companions, and a legacy determination was
 * necessarily website-sourced. Unknown channels fall back to a de-snaked
 * "<name> profile".
 */
export function surfaceNoun(channel: string | null | undefined): string {
  if (channel == null || channel === 'owned_site') return 'site';
  return SURFACE_NOUNS[channel] ?? `${channel.replace(/_/g, ' ')} profile`;
}

/**
 * "on <surface>" target for owner-facing copy — 'the site',
 * 'your Instagram profile', 'a marketplace listing'.
 */
export function surfaceRef(channel: string | null | undefined): string {
  const noun = surfaceNoun(channel);
  if (noun === 'site') return 'the site';
  switch (noun) {
    case 'marketplace listing':
    case 'directory listing':
    case 'locator record':
    case 'registry record':
    case 'third-party page':
      return `a ${noun}`;
    case 'online surface':
      return 'an online surface';
    default:
      return `your ${noun}`;
  }
}
