/**
 * Channel & Offer Scan / Observed Assets schema tests.
 *
 * Spec: docs/AUDIT_CHANNEL_SCAN_AND_OPPORTUNITY_COLLECTION_SPEC.md §A–C
 *
 * The fixture is shaped after the Dreamcast African Market incident audit —
 * the deterministic stand-in for the non-repeatable live re-run: a business
 * whose delivery offer was verified on three public surfaces while the
 * website could not be verified, now representable with per-field
 * provenance, a per-surface channel ledger, and a deduplicated asset
 * roll-up.
 */

import { describe, it, expect } from 'vitest';
import { businessAnalysisSchema } from '../business-analysis.schema';

// ─── Minimal valid audit (passes schema) ─────────────────────────────────

function baseAudit(): any {
  return {
    audit_metadata: {
      audit_date: '2026-10-13',
      requested_business: {
        business_name: 'Dreamcast African Market',
        city: 'Indianapolis',
        state: 'IN',
        category: 'African grocery store',
      },
      identity_status: 'confirmed',
      identity_confidence: 'high',
    },
    summary: 'Test audit',
    platforms: {
      google: {
        profile_status: 'claimed',
        rating: 4.4,
        total_reviews: 31,
        reviews_with_observable_response: 10,
        observable_unanswered_reviews: 21,
        observable_unanswered_negative_reviews: 2,
        observable_unanswered_positive_reviews: 19,
        observable_response_rate_percent: 32,
      },
    },
    website: { url: 'https://dreamcastmarket.com', status: 'working' },
    nap_consistency: { overall_status: 'consistent' },
    digital_opportunity_score: { score: 4 },
    high_attention: false,
    recommended_tier: 'tier_2',
    data_quality: { confidence: 'medium' },
  };
}

// ─── *_observed_on provenance companions (§A) ────────────────────────────

describe('Channel Scan — *_observed_on companions on website.*', () => {
  it('accepts has_delivery_option=true with observed_on naming the channel', () => {
    const audit = baseAudit();
    audit.website.has_delivery_option = true;
    audit.website.has_delivery_option_observed_on = 'instagram';
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website?.has_delivery_option).toBe(true);
      expect(result.data.website?.has_delivery_option_observed_on).toBe('instagram');
    }
  });

  it('accepts all four companions and a null companion', () => {
    const audit = baseAudit();
    audit.website.has_product_browsing = null;
    audit.website.has_product_browsing_observed_on = null;
    audit.website.has_availability_inquiry = 'unable_to_verify';
    audit.website.has_availability_inquiry_observed_on = null;
    audit.website.has_pickup_ordering = false;
    audit.website.has_pickup_ordering_observed_on = 'marketplace';
    audit.website.has_delivery_option = true;
    audit.website.has_delivery_option_observed_on = 'apple_maps';
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('accepts an unlisted channel value (open-ended vocabulary)', () => {
    const audit = baseAudit();
    audit.website.has_delivery_option = true;
    audit.website.has_delivery_option_observed_on = 'nextdoor';
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('legacy audits without companions still pass', () => {
    const audit = baseAudit();
    audit.website.has_delivery_option = 'unable_to_verify';
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });
});

// ─── channels_scanned (§B) ────────────────────────────────────────────────

describe('Channel Scan — channels_scanned entries', () => {
  const instagramEntry = () => ({
    channel: 'instagram',
    url: 'https://www.instagram.com/dreamcastafricanmarket/',
    rendered: true,
    access_barrier: 'none',
    offers_observed: ['Free delivery within Indianapolis IN on orders of $200'],
    notable_activity: ['9,320 followers', 'posts through 2026-10-10'],
    fulfillment_modes: ['delivery'],
    payment_modes: [],
    availability_channel: 'dm',
    last_activity: '2026-10-10',
    confidence: 'verified_on_surface',
  });

  it('accepts the incident-shaped channel scan', () => {
    const audit = baseAudit();
    audit.channels_scanned = [
      instagramEntry(),
      {
        channel: 'apple_maps',
        url: 'https://maps.apple.com/place?auid=dreamcast',
        rendered: true,
        access_barrier: 'none',
        offers_observed: ['Delivery chip displayed'],
        notable_activity: [],
        fulfillment_modes: ['delivery'],
        payment_modes: ['apple_pay', 'contactless'],
        availability_channel: 'none',
        last_activity: null,
        confidence: 'verified_on_surface',
      },
      {
        channel: 'locator',
        url: 'https://www.fns.usda.gov/snap/retailer-locator',
        rendered: true,
        access_barrier: 'none',
        confidence: 'verified_on_surface',
      },
      // Directed-but-skipped channel — the sweep boundary as data.
      {
        channel: 'order_ahead_platform',
        url: null,
        rendered: null,
        access_barrier: 'not_attempted',
      },
    ];
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channels_scanned).toHaveLength(4);
      expect(result.data.channels_scanned?.[3].access_barrier).toBe('not_attempted');
    }
  });

  it('accepts an empty channels_scanned array (REQUIRED block, [] is a real answer)', () => {
    const audit = baseAudit();
    audit.channels_scanned = [];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('rejects an entry with no channel', () => {
    const audit = baseAudit();
    audit.channels_scanned = [{ rendered: true }];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(false);
  });

  it('rejects an unknown access_barrier (enum enforced)', () => {
    const audit = baseAudit();
    audit.channels_scanned = [
      { ...instagramEntry(), access_barrier: 'firewall' },
    ];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(false);
  });

  it('rejects an unknown confidence value', () => {
    const audit = baseAudit();
    audit.channels_scanned = [{ ...instagramEntry(), confidence: 'high' }];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(false);
  });
});

// ─── observed_assets (§C) ────────────────────────────────────────────────

describe('Channel Scan — observed_assets entries', () => {
  it('accepts the incident-shaped asset roll-up with corroboration', () => {
    const audit = baseAudit();
    audit.observed_assets = [
      {
        asset: 'Free delivery over $200',
        evidence:
          'Instagram bio states "Free delivery within Indianapolis IN on orders of $200"; Apple Maps and MapQuest display delivery attributes',
        source_url: 'https://www.instagram.com/dreamcastafricanmarket/',
        observed_on: 'instagram',
        also_seen_on: ['apple_maps', 'directory'],
        confidence: 'verified_on_surface',
        underexposed: true,
        underexposure_note: 'Absent from the business website and all claimed profiles',
      },
      {
        asset: 'SNAP/EBT authorization',
        evidence:
          'Listed in the USDA FNS retailer locator (fact-of-record: snap_ebt_reported)',
        source_url: 'https://www.fns.usda.gov/snap/retailer-locator',
        observed_on: 'locator',
        also_seen_on: [],
        confidence: 'verified_on_surface',
        underexposed: true,
        underexposure_note: 'No EBT chip on any rendered profile',
      },
      {
        asset: 'Active social following',
        evidence: 'Instagram public profile — 9,320 followers, posts through 2026-10-10',
        source_url: 'https://www.instagram.com/dreamcastafricanmarket/',
        observed_on: 'instagram',
        confidence: 'verified_on_surface',
        underexposed: false,
        underexposure_note: null,
      },
    ];
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.observed_assets).toHaveLength(3);
      expect(result.data.observed_assets?.[0].also_seen_on).toEqual([
        'apple_maps',
        'directory',
      ]);
      expect(result.data.observed_assets?.[2].underexposed).toBe(false);
    }
  });

  it('accepts an empty observed_assets array (REQUIRED block, [] is a real answer)', () => {
    const audit = baseAudit();
    audit.observed_assets = [];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('rejects an entry with no asset label', () => {
    const audit = baseAudit();
    audit.observed_assets = [{ evidence: 'delivery offer seen' }];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(false);
  });

  it('accepts entries with extra keys (passthrough)', () => {
    const audit = baseAudit();
    audit.observed_assets = [
      { asset: 'Halal certification', observed_on: 'directory', note_extra: 'x' },
    ];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });
});

// ─── Opportunity Sentiment (§F) ──────────────────────────────────────────

describe('Opportunity Sentiment — positive_review_themes + sentiment_context', () => {
  const incidentSentiment = () => [
    {
      class: 'logistics',
      observation:
        'Customers expect and praise same-day delivery, and the store already runs free delivery over $200',
      evidence: '"Very fast and same day delivery of my order" (5 stars)',
      source: 'yelp',
      confidence: 'verified_on_surface',
    },
    {
      class: 'demand',
      observation:
        'Shoppers arrive looking for specific staples and sometimes leave empty-handed',
      evidence: '"Good store but did not find what i want" (4 stars, 2025-09-30)',
      source: 'google',
      confidence: 'verified_on_surface',
    },
    {
      class: 'gaps',
      observation:
        'Stock rotation is a recurring complaint — expired and poor-condition goods on the shelf',
      evidence: 'Moldy bread and expired items reported (1 star, 2023-10-27)',
      source: 'google',
      confidence: 'verified_on_surface',
    },
    {
      class: 'infrastructure',
      observation: 'No wheelchair ramp at the entrance; customers ask for one',
      evidence: '"Needs a wheelchair ramp in front of the store" (5 stars, 2023-08-17)',
      source: 'google',
      confidence: 'verified_on_surface',
    },
  ];

  it('accepts the incident-shaped sentiment context across all four classes', () => {
    const audit = baseAudit();
    audit.sentiment_context = incidentSentiment();
    audit.positive_review_themes = [
      {
        theme: 'Assortment depth — fufu flour and West African staples',
        observed_frequency: 'high',
        supporting_review_count: null,
        summary:
          'Reviewers repeatedly name the fufu flour selection as the reason to shop here',
      },
    ];
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sentiment_context).toHaveLength(4);
      expect(result.data.sentiment_context?.map((e: any) => e.class)).toEqual([
        'logistics',
        'demand',
        'gaps',
        'infrastructure',
      ]);
      expect(result.data.positive_review_themes).toHaveLength(1);
    }
  });

  it('rejects an unknown sentiment class (enum enforced)', () => {
    const audit = baseAudit();
    audit.sentiment_context = [
      { class: 'vibes', observation: 'x', source: 'google' },
    ];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(false);
  });

  it('rejects a sentiment entry with no observation', () => {
    const audit = baseAudit();
    audit.sentiment_context = [{ class: 'demand', source: 'google' }];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(false);
  });

  it('accepts empty sentiment arrays (absence is a real answer, not a failure)', () => {
    const audit = baseAudit();
    audit.sentiment_context = [];
    audit.positive_review_themes = [];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('rejects a positive theme with no theme label (shared reviewThemeSchema)', () => {
    const audit = baseAudit();
    audit.positive_review_themes = [{ observed_frequency: 'high' }];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(false);
  });

  it('accepts entries with extra keys (passthrough)', () => {
    const audit = baseAudit();
    audit.sentiment_context = [
      { class: 'infrastructure', observation: 'x', source: 'google', extra: 'y' },
    ];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });
});
