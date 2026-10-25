/**
 * Entry Presence gateway triad — shared copy for the claim success screen
 * (`DirectoryClaimClient` → ClaimUpgradeTeaser) and the dashboard handoff
 * (`TierUpgradeCard`). One copy source keeps both surfaces aligned with the
 * claim handoff spec (docs/LocalBiz/directory_presence_claim_handoff_spec.md).
 */
import type { UpgradeTierOption } from '@/services/DirectoryPresenceUpgradeService';

// Static fallback — renders only when no live upgrade options are available
// (accept-response embed absent and no authenticated refresh). Prices are
// launch-locked but DB-adjustable — render as "from $X/mo" (spec §2 caveat).
export const FALLBACK_PRESENCE_MODES: UpgradeTierOption[] = [
  {
    tierKey: 'presence',
    name: 'Storefront',
    displayName: 'Storefront',
    description: null,
    priceMonthly: 39,
    priceAnnual: 468,
    sortOrder: 10,
    billingType: 'subscription',
    mode: 'commerce',
    tagline: 'Sell with deposit checkout',
    isPrimary: true,
    newFeatures: [],
  },
  {
    tierKey: 'discovery',
    name: 'SWIS',
    displayName: 'SWIS',
    description: null,
    priceMonthly: 29,
    priceAnnual: 348,
    sortOrder: 20,
    billingType: 'subscription',
    mode: 'google',
    tagline: 'Put your products on Google',
    isPrimary: false,
    newFeatures: [],
  },
  {
    tierKey: 'storefront',
    name: 'Storefront+',
    displayName: 'Storefront+',
    description: null,
    priceMonthly: 59,
    priceAnnual: 708,
    sortOrder: 30,
    billingType: 'subscription',
    mode: 'platform',
    tagline: 'Showcase your full catalog',
    isPrimary: false,
    newFeatures: [],
  },
];

// Curated per-mode unlock copy — must stay within each tier's actual feature
// set (spec copy accuracy rules: no premium layout, no featured products;
// hours/map/contact/QR/SNAP are already free). presence is the one mode with
// native checkout — deposit-only, Stripe.
export const MODE_UNLOCK_COPY: Record<string, string> = {
  presence:
    'Full directory chrome plus a hosted storefront with deposit checkout (Stripe). Upgrade to full payment and more gateways anytime as add-ons.',
  discovery:
    'Your products on Google — Merchant Center feed, Shopping and local inventory visibility, hosted on your platform subdomain.',
  storefront:
    'A full, branded storefront browse experience with product catalog on your subdomain — add checkout anytime as an à-la-carte add-on.',
};

/** Primary (recommended) mode first — mirrors the upgrade page's gateway sort. */
export function sortPresenceModes(modes: UpgradeTierOption[]): UpgradeTierOption[] {
  return [...modes].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
}
