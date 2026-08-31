/**
 * A3 material-drift detection + prompt branching tests.
 *
 * Verifies:
 *   - extractA3Fields computes material_drift correctly (cosmetic vs genuinely
 *     different NAP variations)
 *   - extractA3Fields computes website_broken + website_missing_cta from the
 *     website audit
 *   - buildArchetypePrompt('A3', ...) selects the correct preamble + hook
 *     variant based on material_drift and website_broken
 *
 * The core regression: a campaign with overall_status "consistent" and only
 * formatting-level NAP variations (Rd vs Road, formatted vs unformatted phone,
 * LLC suffix) must NOT produce the crisis "wrong location / dead numbers"
 * preamble. That framing is false for cosmetic drift and destroys the opener's
 * credibility.
 */

import { describe, it, expect } from 'vitest';
import { buildArchetypePrompt } from '../archetype-prompts';
import {
  extractA3Fields,
  extractFields,
  type A3Fields,
  type CommonFields,
} from '../field-extractors';
import type { BusinessAnalysisAuditData } from '../archetype-selection';

// ─── Fixtures ────────────────────────────────────────────────────────────

const common: CommonFields = {
  business_name: 'Kaura International Food Market',
  contact_name: null,
  tone: 'short informal',
  city: 'Indianapolis',
  state: 'IN',
  phone: '317-297-7036',
  website_url: 'https://www.kauramarket.com',
  triggered_signals: [],
  primary_signal_severity: 'borderline',
  strongest_co_occurring: null,
};

function baseAudit(overrides: Partial<BusinessAnalysisAuditData> = {}): BusinessAnalysisAuditData {
  return {
    summary: 'test',
    platforms: {
      google: { profile_status: 'claimed' },
      yelp: {},
      facebook: {},
    },
    combined_review_metrics: {
      observable_unanswered_reviews: 0,
      observable_unanswered_rate_percent: 0,
      observable_unanswered_negative_reviews: 0,
    },
    website: { url: 'https://www.kauramarket.com', status: 'working' },
    nap_consistency: { overall_status: 'consistent' },
    ...overrides,
  };
}

// ─── extractA3Fields — material_drift detection ──────────────────────────

describe('extractA3Fields — material_drift detection', () => {
  it('returns material_drift=false for cosmetic phone formatting differences', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'consistent',
        phone_variations: ['(317) 297-7036', '+1 317-297-7036', '3172977036'],
      },
    });
    const fields = extractA3Fields(audit, common);
    expect(fields.material_drift).toBe(false);
  });

  it('returns material_drift=false for cosmetic address abbreviation differences', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'consistent',
        address_variations: [
          '4271 Lafayette Rd, Indianapolis, IN 46254',
          '4271 Lafayette Road, Indianapolis, IN 46254',
        ],
      },
    });
    const fields = extractA3Fields(audit, common);
    expect(fields.material_drift).toBe(false);
  });

  it('returns material_drift=false for cosmetic name suffix differences (LLC)', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'consistent',
        name_variations: [
          'Kaura International Food Market LLC',
          'Kaura International Food Market',
        ],
      },
    });
    const fields = extractA3Fields(audit, common);
    expect(fields.material_drift).toBe(false);
  });

  it('returns material_drift=false when all three variation types are cosmetic (the reported case)', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'consistent',
        canonical_name: 'Kaura International Food Market',
        name_variations: [
          'Kaura International Food Market LLC',
          'Kaura International Food Market',
        ],
        address_variations: [
          '4271 Lafayette Rd, Indianapolis, IN 46254',
          '4271 Lafayette Road, Indianapolis, IN 46254',
        ],
        phone_variations: [
          '(317) 297-7036',
          '+1 317-297-7036',
          '3172977036',
        ],
      },
    });
    const fields = extractA3Fields(audit, common);
    expect(fields.material_drift).toBe(false);
    expect(fields.overall_status).toBe('consistent');
  });

  it('returns material_drift=true for genuinely different phone numbers', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'inconsistent',
        phone_variations: ['317-297-7036', '317-555-1234'],
      },
    });
    const fields = extractA3Fields(audit, common);
    expect(fields.material_drift).toBe(true);
  });

  it('returns material_drift=true for genuinely different addresses', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'inconsistent',
        address_variations: [
          '4271 Lafayette Rd, Indianapolis, IN 46254',
          '123 Main St, Indianapolis, IN 46201',
        ],
      },
    });
    const fields = extractA3Fields(audit, common);
    expect(fields.material_drift).toBe(true);
  });

  it('returns material_drift=true for genuinely different names', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'inconsistent',
        name_variations: ['Kaura International Food Market', 'Kaura Foods'],
      },
    });
    const fields = extractA3Fields(audit, common);
    expect(fields.material_drift).toBe(true);
  });

  it('returns material_drift=false when nap_consistency is absent', () => {
    const audit = baseAudit({ nap_consistency: undefined });
    const fields = extractA3Fields(audit, common);
    expect(fields.material_drift).toBe(false);
  });
});

// ─── extractA3Fields — website_broken + website_missing_cta ───────────────

describe('extractA3Fields — website status fields', () => {
  it('returns website_broken=true for dead URL status', () => {
    const audit = baseAudit({ website: { url: 'https://example.com', status: 'dead' } });
    const fields = extractA3Fields(audit, common);
    expect(fields.website_broken).toBe(true);
  });

  it('returns website_broken=true for timeout status', () => {
    const audit = baseAudit({ website: { url: 'https://example.com', status: 'timeout' } });
    const fields = extractA3Fields(audit, common);
    expect(fields.website_broken).toBe(true);
  });

  it('returns website_broken=false for working status', () => {
    const audit = baseAudit({ website: { url: 'https://example.com', status: 'working' } });
    const fields = extractA3Fields(audit, common);
    expect(fields.website_broken).toBe(false);
  });

  it('returns website_broken=false when website is absent', () => {
    const audit = baseAudit({ website: undefined });
    const fields = extractA3Fields(audit, common);
    expect(fields.website_broken).toBe(false);
  });

  it('returns website_missing_cta=true when no CTA detected', () => {
    const audit = baseAudit({
      website: { url: 'https://example.com', status: 'working', call_to_action_present: 'no' },
    });
    const fields = extractA3Fields(audit, common);
    expect(fields.website_missing_cta).toBe(true);
  });

  it('returns website_missing_cta=false when CTA is present', () => {
    const audit = baseAudit({
      website: { url: 'https://example.com', status: 'working', call_to_action_present: 'yes', has_booking: true },
    });
    const fields = extractA3Fields(audit, common);
    expect(fields.website_missing_cta).toBe(false);
  });

  it('returns website_broken=true when WC_BROKEN_WEBSITE is in triggered_signals even if website status is not "dead"', () => {
    // Regression: the signal may be model-emitted (from audit_data.detected_signals[])
    // even when the website.status field doesn't use the exact "dead"/"timeout"
    // strings. The field extractor must check the triggered signals too.
    const audit = baseAudit({ website: { url: 'https://example.com', status: 'error' } });
    const commonWithSignal: CommonFields = {
      ...common,
      triggered_signals: [
        { code: 'WC_BROKEN_WEBSITE', label: 'Broken Website (dead URL)', severity: 'crisis' },
      ],
    };
    const fields = extractA3Fields(audit, commonWithSignal);
    expect(fields.website_broken).toBe(true);
  });

  it('returns website_missing_cta=true when WC_MISSING_CTA is in triggered_signals even if website audit says CTA present', () => {
    // Same regression pattern: model-emitted signal vs raw field disagreement.
    const audit = baseAudit({
      website: { url: 'https://example.com', status: 'working', call_to_action_present: 'yes' },
    });
    const commonWithSignal: CommonFields = {
      ...common,
      triggered_signals: [
        { code: 'WC_MISSING_CTA', label: 'Missing Call-to-Action', severity: 'material' },
      ],
    };
    const fields = extractA3Fields(audit, commonWithSignal);
    expect(fields.website_missing_cta).toBe(true);
  });
});

// ─── extractFields dispatcher — primary_signal_severity override ─────────

describe('extractFields dispatcher — primary_signal_severity', () => {
  it('always uses the computed severity, not the buildCommonFields default', () => {
    // Regression: buildCommonFields defaults primary_signal_severity to
    // 'borderline'. The dispatcher must override it with the computed value
    // (e.g., 'cosmetic' for A3 with cosmetic drift), not keep the default.
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'consistent',
        phone_variations: ['(317) 297-7036', '317-297-7036'],
      },
    });
    const commonWithDefault: CommonFields = {
      ...common,
      primary_signal_severity: 'borderline', // the buildCommonFields default
    };
    const fields = extractFields('A3', audit, commonWithDefault) as A3Fields;
    expect(fields.primary_signal_severity).toBe('cosmetic');
  });
});

// ─── buildArchetypePrompt — A3 prompt branching ──────────────────────────

describe('buildArchetypePrompt — A3 variant selection', () => {
  function buildPrompt(fields: Partial<A3Fields>): string {
    const fullFields = { ...common, ...fields } as A3Fields;
    return buildArchetypePrompt('A3', JSON.stringify(fullFields, null, 2), 'soft');
  }

  it('uses the COSMETIC preamble when material_drift=false and website is not broken', () => {
    const prompt = buildPrompt({
      material_drift: false,
      website_broken: false,
      overall_status: 'consistent',
      name_variations: ['Kaura International Food Market LLC', 'Kaura International Food Market'],
      address_variations: ['4271 Lafayette Rd, Indianapolis, IN 46254', '4271 Lafayette Road, Indianapolis, IN 46254'],
      phone_variations: ['(317) 297-7036', '+1 317-297-7036', '3172977036'],
      platforms_with_listings: ['Google', 'Yelp', 'Facebook'],
      canonical_name: 'Kaura International Food Market',
      website_missing_cta: false,
    });
    // Must NOT contain the MATERIAL crisis preamble — "Customers are being
    // sent to the wrong location or calling dead numbers" only appears in
    // the MATERIAL preamble. (The SIGNAL_CONTEXT_NOTE mentions "wrong
    // location" in a negative instruction telling the LLM NOT to use it,
    // which is correct and should not trigger this assertion.)
    expect(prompt).not.toContain('Customers are being sent to the wrong');
    // Must contain the soft framing
    expect(prompt).toContain('formats');
    expect(prompt).toContain('hedge on which');
  });

  it('uses the MATERIAL preamble when material_drift=true', () => {
    const prompt = buildPrompt({
      material_drift: true,
      website_broken: false,
      overall_status: 'inconsistent',
      phone_variations: ['317-297-7036', '317-555-1234'],
      platforms_with_listings: ['Google', 'Yelp'],
      canonical_name: 'Test Biz',
      website_missing_cta: false,
      name_variations: [],
      address_variations: [],
    });
    // Must contain the crisis framing
    expect(prompt).toContain('wrong location');
    expect(prompt).toContain('dead numbers');
    // Must contain the "wrong pin" consequence
    expect(prompt).toContain('wrong pin');
  });

  it('uses the BROKEN_WEBSITE preamble when website_broken=true and material_drift=false', () => {
    const prompt = buildPrompt({
      material_drift: false,
      website_broken: true,
      overall_status: 'consistent',
      name_variations: ['Test Biz LLC', 'Test Biz'],
      address_variations: [],
      phone_variations: ['(317) 555-0100', '317-555-0100'],
      platforms_with_listings: ['Google', 'Yelp'],
      canonical_name: 'Test Biz',
      website_missing_cta: false,
    });
    // Must lead with the broken website, not NAP drift
    expect(prompt).toContain("website link isn't loading");
    expect(prompt).toContain('dead page');
    // Must NOT use the MATERIAL crisis NAP preamble — "Customers are being
    // sent to the wrong location" only appears in the MATERIAL preamble.
    // (The SIGNAL_CONTEXT_NOTE's negative reference to "wrong location" is
    // correct and should not trigger this assertion.)
    expect(prompt).not.toContain('Customers are being sent to the wrong');
  });

  it('uses the MATERIAL preamble when both website_broken=true and material_drift=true', () => {
    // Material NAP drift takes priority — it's the A3 archetype's core signal
    const prompt = buildPrompt({
      material_drift: true,
      website_broken: true,
      overall_status: 'inconsistent',
      phone_variations: ['317-297-7036', '317-555-1234'],
      platforms_with_listings: ['Google', 'Yelp'],
      canonical_name: 'Test Biz',
      website_missing_cta: false,
      name_variations: [],
      address_variations: [],
    });
    expect(prompt).toContain('wrong location');
    expect(prompt).toContain('wrong pin');
  });

  it('includes the "most semantically divergent" instruction in the MATERIAL variant', () => {
    const prompt = buildPrompt({
      material_drift: true,
      website_broken: false,
      overall_status: 'inconsistent',
      phone_variations: ['317-297-7036', '317-555-1234'],
      platforms_with_listings: ['Google', 'Yelp'],
      canonical_name: 'Test Biz',
      website_missing_cta: false,
      name_variations: [],
      address_variations: [],
    });
    expect(prompt).toContain('SEMANTICALLY DIVERGENT');
    expect(prompt).toContain('normalize phone numbers');
  });

  it('includes the "do NOT say different addresses" guard in the COSMETIC variant', () => {
    const prompt = buildPrompt({
      material_drift: false,
      website_broken: false,
      overall_status: 'consistent',
      name_variations: ['Test Biz LLC', 'Test Biz'],
      address_variations: ['123 Main St, Indy, IN', '123 Main Street, Indy, IN'],
      phone_variations: ['(317) 555-0100', '317-555-0100'],
      platforms_with_listings: ['Google', 'Yelp'],
      canonical_name: 'Test Biz',
      website_missing_cta: false,
    });
    expect(prompt).toContain('Do NOT say "different addresses"');
    expect(prompt).toContain('formatting difference');
  });

  it('forbids overstating cosmetic drift as a crisis in all variants', () => {
    const cosmeticPrompt = buildPrompt({
      material_drift: false,
      website_broken: false,
      overall_status: 'consistent',
      name_variations: [],
      address_variations: [],
      phone_variations: [],
      platforms_with_listings: ['Google'],
      canonical_name: 'Test Biz',
      website_missing_cta: false,
    });
    expect(cosmeticPrompt).toContain('overstating cosmetic formatting');
  });
});
