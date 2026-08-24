/**
 * Seasonal Template Packs — pre-built niche post templates for the GBP post
 * composer (Spec §4 Subsystem 3).
 *
 * Category-keyed static registry (same niche-override spirit as
 * mkt_intake_definitions.niche_overrides): templates target a season and
 * optionally a business category. The composer pre-fills business details
 * ({{businessName}}) and suggests offer fields; the merchant pairs the
 * template with a wallet coupon via the OfferPostBuilder picker.
 */

export type TemplateSeason = 'thanksgiving' | 'christmas' | 'new_years' | 'everyday';

export interface SeasonalPostTemplate {
  id: string;
  label: string;
  season: TemplateSeason;
  topicType: 'STANDARD' | 'EVENT' | 'OFFER';
  /** Category keys this template targets; 'all' applies to every category. */
  categories: string[] | 'all';
  summaryTemplate: string;
  callToActionType?: 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL';
  eventTitle?: string;
  offerTerms?: string;
}

export const SEASONAL_POST_TEMPLATES: SeasonalPostTemplate[] = [
  // ── Thanksgiving ──────────────────────────────────────────────────────
  {
    id: 'thanksgiving-hours',
    label: 'Thanksgiving Hours Notice',
    season: 'thanksgiving',
    topicType: 'STANDARD',
    categories: 'all',
    summaryTemplate:
      "Happy Thanksgiving from all of us at {{businessName}}! Please note our holiday hours this week — check our profile before you visit. We're grateful for your support all year long.",
    callToActionType: 'CALL',
  },
  {
    id: 'thanksgiving-feast-offer',
    label: 'Thanksgiving Feast Offer',
    season: 'thanksgiving',
    topicType: 'OFFER',
    categories: ['restaurant', 'food', 'cafe', 'bakery', 'dining'],
    summaryTemplate:
      'Let {{businessName}} handle the cooking this Thanksgiving! Order your holiday feast ahead — limited slots available. Use the coupon below to save on your pre-order.',
    callToActionType: 'ORDER',
    offerTerms: 'Valid for Thanksgiving pre-orders. Limited availability.',
  },
  // ── Christmas / Holiday ───────────────────────────────────────────────
  {
    id: 'holiday-gift-offer',
    label: 'Holiday Gift Offer',
    season: 'christmas',
    topicType: 'OFFER',
    categories: ['retail', 'store', 'shop', 'boutique'],
    summaryTemplate:
      'Still hunting for the perfect gift? {{businessName}} has you covered! Stop by this week and use the coupon below for holiday savings on gifts everyone will love.',
    callToActionType: 'SHOP',
    offerTerms: 'Valid through December 24. In-store only.',
  },
  {
    id: 'holiday-event',
    label: 'Holiday Event Announcement',
    season: 'christmas',
    topicType: 'EVENT',
    categories: 'all',
    summaryTemplate:
      "Join us at {{businessName}} for our holiday celebration! Festive specials, seasonal favorites, and good cheer — bring the family. We'd love to see you there.",
    callToActionType: 'LEARN_MORE',
    eventTitle: 'Holiday Celebration',
  },
  {
    id: 'holiday-hours',
    label: 'Holiday Hours Notice',
    season: 'christmas',
    topicType: 'STANDARD',
    categories: 'all',
    summaryTemplate:
      'The holidays are here! {{businessName}} will have adjusted hours over Christmas and New Year’s — please check our profile before visiting. Wishing you a wonderful season!',
    callToActionType: 'CALL',
  },
  // ── New Year's ────────────────────────────────────────────────────────
  {
    id: 'new-year-offer',
    label: 'New Year Kickoff Offer',
    season: 'new_years',
    topicType: 'OFFER',
    categories: 'all',
    summaryTemplate:
      "New year, new you — and new savings at {{businessName}}! Start the year right with this limited-time offer. Use the coupon below when you visit us in January.",
    callToActionType: 'LEARN_MORE',
    offerTerms: 'Valid through January 31. One per customer.',
  },
  {
    id: 'new-year-hours',
    label: "New Year's Hours Notice",
    season: 'new_years',
    topicType: 'STANDARD',
    categories: 'all',
    summaryTemplate:
      "Happy New Year from {{businessName}}! We're ringing in the year with adjusted holiday hours — check our profile for details. Here's to a great year ahead!",
    callToActionType: 'CALL',
  },
  // ── Everyday ──────────────────────────────────────────────────────────
  {
    id: 'everyday-welcome-offer',
    label: 'Welcome Offer',
    season: 'everyday',
    topicType: 'OFFER',
    categories: 'all',
    summaryTemplate:
      "New to {{businessName}}? Welcome! Enjoy this special offer on your first visit — just mention the coupon below when you stop by. We can't wait to meet you.",
    callToActionType: 'LEARN_MORE',
    offerTerms: 'First-time customers. One per customer.',
  },
  {
    id: 'everyday-whats-new',
    label: "What's New Announcement",
    season: 'everyday',
    topicType: 'STANDARD',
    categories: 'all',
    summaryTemplate:
      "Something new is happening at {{businessName}}! Stop by this week to see what's changed — fresh arrivals, updated offerings, and the same friendly service you know.",
    callToActionType: 'LEARN_MORE',
  },
];

/** Normalize a GBP category string to a comparable key. */
function normalizeCategory(category: string | null | undefined): string {
  return (category || '').trim().toLowerCase();
}

/**
 * Resolve the templates relevant to a business category. Category-targeted
 * templates win over 'all' templates for the same season; both are returned
 * (category-targeted first).
 */
export function getTemplatesForCategory(category: string | null | undefined): SeasonalPostTemplate[] {
  const key = normalizeCategory(category);
  const targeted = SEASONAL_POST_TEMPLATES.filter(
    (t) => t.categories !== 'all' && t.categories.some((c) => key.includes(c)),
  );
  const generic = SEASONAL_POST_TEMPLATES.filter((t) => t.categories === 'all');
  return [...targeted, ...generic];
}

/**
 * The active season, derived from the current date:
 *   Nov 15–30 → thanksgiving · Dec 1–26 → christmas · Dec 27–Jan 7 → new_years
 * Everything else → everyday.
 */
export function getCurrentSeason(now: Date = new Date()): TemplateSeason {
  const month = now.getMonth(); // 0-based
  const day = now.getDate();
  if (month === 10 && day >= 15) return 'thanksgiving';
  if (month === 11 && day <= 26) return 'christmas';
  if (month === 11 || (month === 0 && day <= 7)) return 'new_years';
  return 'everyday';
}

/** Fill the {{businessName}} placeholder in a template summary. */
export function fillTemplate(template: SeasonalPostTemplate, businessName: string): string {
  return template.summaryTemplate.replace(/\{\{businessName\}\}/g, businessName || 'our store');
}
