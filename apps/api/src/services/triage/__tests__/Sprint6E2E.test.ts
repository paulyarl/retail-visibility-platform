/**
 * Sprint 6 E2E test — A5 Dual-Signal Triage → Opener flow
 *
 * Tests the full path from business_analysis audit data with dual signals
 * (repair + review) through:
 *   1. Signal extraction → SignalCode[] including repair + review signals
 *   2. Triage engine evaluation → PB-05 (A5_DUAL_TRIAGE) match
 *   3. A5 field extraction → A5Fields with repair_signals + review gap
 *   4. A5 prompt building → resolved prompt with {{extracted_fields}} injected
 *
 * This is a pure-function E2E test (no database, no LLM call) — it verifies
 * the deterministic pipeline from audit data to resolved prompt. The actual
 * LLM call and quality gate are tested separately.
 *
 * Spec: docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md
 *       Sprint 6 task 3 — E2E test.
 */

import { describe, it, expect } from 'vitest';
import { evaluateTriage } from '../TriageEngineService';
import { extractSignals } from '../signal-extractor';
import { extractFields, buildArchetypePrompt } from '../../outreach-openers';
import type { PlaybookCatalogRow, MatchingRules, SignalExtractorInput } from '../types';
import type { BusinessAnalysisAuditData } from '../../outreach-openers';

// ─── Fixtures ────────────────────────────────────────────────────────────

/** A business_analysis audit with both NAP drift AND a review drought. */
const dualSignalAuditData: BusinessAnalysisAuditData = {
  combined_review_metrics: {
    observable_total_reviews: 42,
    observable_unanswered_reviews: 18,
    observable_unanswered_rate_percent: 43,
    observable_unanswered_negative_reviews: 6,
  },
  platforms: {
    google: {
      rating: 3.8,
      total_reviews: 42,
      profile_status: 'unclaimed',
      observable_unanswered_reviews: 18,
    },
    yelp: {
      rating: 3.5,
      total_reviews: 15,
      profile_status: 'unclaimed',
    },
  },
  website: {
    url: 'https://example-plumber.com',
    status: 'working',
    call_to_action_present: 'no',
    click_to_call_available: 'yes',
    has_booking: false,
  },
  nap_consistency: {
    overall_status: 'inconsistent',
    name_variations: ['Example Plumber', 'Example Plumbing Co'],
    address_variations: ['123 Main St', '123 Main Street'],
    phone_variations: ['555-0100', '555-0101'],
  },
  negative_review_themes: [
    {
      theme: 'Scheduling & Wait Times',
      summary: 'Customers complain about late arrivals',
      supporting_review_count: 4,
    },
  ],
  detected_signals: [
    'CP_NAP_DRIFT_NAME',
    'CP_NAP_DRIFT_ADDRESS',
    'CP_NAP_DRIFT_PHONE',
    'RA_REVIEW_DROUGHT',
    'RA_UNANSWERED_GAP',
    'DS_GBP_UNCLAIMED',
  ],
  audit_metadata: {
    requested_business: { business_name: 'Example Plumber', city: 'Austin', state: 'TX', category: 'plumber' },
    matched_business: { business_name: 'Example Plumber', category: 'plumber' },
    identity_status: 'confirmed',
    identity_confidence: 'high',
  },
};

/** Campaign with a review drought (>180 days since last review). */
const campaignWithDrought = {
  last_review_date: new Date(Date.now() - 220 * 24 * 60 * 60 * 1000), // 220 days ago
  unaddressed_reviews: 18,
  nap_consistent: false,
  has_website: 'yes',
  website_url: 'https://example-plumber.com',
  gbp_claimed: false,
};

const extractorInput: SignalExtractorInput = {
  campaign: campaignWithDrought as any,
  auditData: dualSignalAuditData as any,
};

/** PB-05: A5_DUAL_TRIAGE — dual clause matching repair + review signals. */
const pb05: PlaybookCatalogRow = {
  id: 'mkt-playbook-pb05',
  code: 'PB-05',
  name: 'Dual-Signal Footprint Triage',
  category: 'triage_management',
  archetype: 'A5',
  archetypeLabel: 'A5 Dual Triage',
  description: 'Combined repair + review drought footprint',
  matchingRules: {
    any: [],
    all: [],
    none: [],
    dual: {
      groupA: ['CP_NAP_DRIFT_NAME', 'CP_NAP_DRIFT_ADDRESS', 'CP_NAP_DRIFT_PHONE', 'WC_DEAD_URL', 'WC_URL_MISMATCH'],
      groupB: ['RA_REVIEW_DROUGHT', 'RA_UNANSWERED_GAP', 'RA_REVIEW_SILENCE'],
    },
    confidence: 0.9,
  } as MatchingRules,
  priorityRank: 5,
  fitdOfferTitle: 'Footprint Audit + Fix Roadmap',
  fitdDefaultFeeCents: 15000,
  retainerPitchTitle: 'Visibility Retainer',
  retainerFeeCents: 25000,
  openerPromptTemplateId: null,
  previewDeliverableType: 'footprint_audit',
  isActive: true,
};

/** PB-04: crisis (higher priority — must NOT match when no crisis signals). */
const pb04: PlaybookCatalogRow = {
  ...pb05,
  id: 'mkt-playbook-pb04',
  code: 'PB-04',
  name: 'Crisis Reputation Recovery',
  category: 'recovery_management',
  archetype: 'A2',
  archetypeLabel: 'A2 Negative Recovery',
  matchingRules: {
    any: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS'],
    all: [],
    none: [],
    dual: null,
    confidence: 0.95,
  } as MatchingRules,
  priorityRank: 4,
};

/** PB-03: fallback (lowest priority — rank 99, evaluated last). */
const pb03: PlaybookCatalogRow = {
  ...pb05,
  id: 'mkt-playbook-pb03',
  code: 'PB-03',
  name: 'Review Response Gap',
  category: 'review_management',
  archetype: 'A1',
  archetypeLabel: 'A1 Review Gap',
  matchingRules: {
    any: ['RA_UNANSWERED_GAP'],
    all: [],
    none: [],
    dual: null,
    confidence: 0.7,
  } as MatchingRules,
  priorityRank: 99,
};

const playbooks = [pb04, pb05, pb03];

// ─── Tests ───────────────────────────────────────────────────────────────

describe('Sprint 6 E2E: A5 Dual-Signal Triage → Opener', () => {

  it('step 1: extracts both repair and review signals from audit data', () => {
    const signals = extractSignals(extractorInput);

    // Repair signals from NAP drift
    expect(signals).toContain('CP_NAP_DRIFT_NAME');
    expect(signals).toContain('CP_NAP_DRIFT_ADDRESS');
    expect(signals).toContain('CP_NAP_DRIFT_PHONE');

    // Review drought signal (220 days > 180 threshold)
    expect(signals).toContain('RA_REVIEW_DROUGHT');

    // Review gap signal (18 unaddressed > 15 threshold OR 43% > 15%)
    expect(signals).toContain('RA_UNANSWERED_GAP');

    // GBP unclaimed
    expect(signals).toContain('DS_GBP_UNCLAIMED');

    // Should NOT contain crisis signals (no BBB data)
    expect(signals).not.toContain('RA_BBB_GRADE_SUPPRESSION');
    expect(signals).not.toContain('RA_UNANSWERED_COMPLAINTS');
  });

  it('step 2: triage engine matches PB-05 (A5_DUAL_TRIAGE) via dual clause', () => {
    const signals = extractSignals(extractorInput);
    const recommendation = evaluateTriage(signals, playbooks);

    expect(recommendation).not.toBeNull();
    expect(recommendation!.playbookCode).toBe('PB-05');
    expect(recommendation!.archetype).toBe('A5');
    expect(recommendation!.confidence).toBe(0.9);

    // PB-04 (crisis) should NOT match — no crisis signals present
    // PB-03 (fallback) should NOT match — PB-05 has higher priority (rank 5 > 3)
    // and PB-05's dual clause matches (≥1 repair + ≥1 review)
  });

  it('step 2b: PB-04 crisis wins over PB-05 when BBB crisis signals are present', () => {
    // Add BBB crisis signals to the extractor input
    const crisisInput: SignalExtractorInput = {
      ...extractorInput,
      bbb: {
        bbbGrade: 'F',
        unansweredBbbComplaints: 5,
      },
    };
    const signals = extractSignals(crisisInput);
    const recommendation = evaluateTriage(signals, playbooks);

    expect(recommendation).not.toBeNull();
    expect(recommendation!.playbookCode).toBe('PB-04');
    expect(recommendation!.archetype).toBe('A2');
  });

  it('step 3: A5 field extraction produces repair_signals + review gap data', () => {
    const common = {
      business_name: 'Example Plumber',
      contact_name: null,
      tone: 'short informal',
      city: 'Austin',
      state: 'TX',
      phone: '555-0100',
      website_url: 'https://example-plumber.com',
    };

    const fields = extractFields('A5', dualSignalAuditData, common) as any;

    expect(fields.repair_signals).toBeDefined();
    expect(fields.repair_signals.length).toBeGreaterThan(0);
    expect(fields.repair_signals).toContain('nap_inconsistent');
    expect(fields.unaddressed_review_count).toBe(18);
    expect(fields.platforms_with_listings).toContain('Google');
    expect(fields.platforms_with_listings).toContain('Yelp');
    // days_since_last_review is -1 until the caller fills it from campaign data
    expect(fields.days_since_last_review).toBe(-1);
  });

  it('step 4: A5 prompt builds with extracted fields injected', () => {
    const common = {
      business_name: 'Example Plumber',
      contact_name: null,
      tone: 'short informal',
      city: 'Austin',
      state: 'TX',
      phone: '555-0100',
      website_url: 'https://example-plumber.com',
    };

    const fields = extractFields('A5', dualSignalAuditData, common);
    const fieldsJson = JSON.stringify(fields, null, 2);
    const prompt = buildArchetypePrompt('A5', fieldsJson, 'soft');

    // The prompt should contain the extracted fields JSON
    expect(prompt).toContain('Example Plumber');
    expect(prompt).toContain('nap_inconsistent');
    expect(prompt).toContain('"unaddressed_review_count": 18');

    // The prompt should contain the A5-specific instructions
    expect(prompt).toContain('COMBINED FOOTPRINT');
    expect(prompt).toContain('repair_signals');
    expect(prompt).toContain('days_since_last_review');

    // The close line should be injected
    expect(prompt).toContain("Full deliverable's ready within a day");

    // The placeholder should be replaced
    expect(prompt).not.toContain('{{extracted_fields}}');
    expect(prompt).not.toContain('{{close_line}}');
  });

  it('step 4b: A5 prompt with direct_paid close variant', () => {
    const common = {
      business_name: 'Test Business',
      contact_name: 'Jane',
      tone: 'short informal',
      city: 'Denver',
      state: 'CO',
      phone: null,
      website_url: null,
    };

    const fields = extractFields('A5', dualSignalAuditData, common);
    const prompt = buildArchetypePrompt('A5', JSON.stringify(fields), 'direct_paid');

    expect(prompt).toContain('paid engagement');
    expect(prompt).not.toContain('{{close_line}}');
  });

  it('full flow: audit → signals → triage → A5 archetype → prompt', () => {
    // Step 1: Extract signals
    const signals = extractSignals(extractorInput);
    expect(signals.length).toBeGreaterThan(3);

    // Step 2: Evaluate triage
    const recommendation = evaluateTriage(signals, playbooks);
    expect(recommendation!.archetype).toBe('A5');

    // Step 3: Extract A5 fields
    const common = {
      business_name: 'Example Plumber',
      contact_name: null,
      tone: 'short informal',
      city: 'Austin',
      state: 'TX',
      phone: '555-0100',
      website_url: 'https://example-plumber.com',
    };
    const fields = extractFields(recommendation!.archetype, dualSignalAuditData, common);

    // Step 4: Build prompt
    const prompt = buildArchetypePrompt(recommendation!.archetype, JSON.stringify(fields, null, 2));
    expect(prompt).toContain('Example Plumber');
    expect(prompt).toContain('footprint');
    expect(prompt.length).toBeGreaterThan(500);
  });
});
