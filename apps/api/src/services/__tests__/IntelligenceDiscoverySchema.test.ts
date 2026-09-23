/**
 * Unit tests for the intelligence_discovery output schema (Sprint 2).
 *
 * Tests:
 *   - Valid discovery output passes validation
 *   - outside_market candidates excluded from qualifying_businesses
 *   - national_chain / national_franchise / regional_chain excluded from qualifying
 *   - identity_confidence 'low' → business_seek_priority must be 'hold'
 *   - category_fit 'insufficient' → priority 'hold' or recommended false
 *   - No Business-Audit signal fields required (structural §31)
 *   - .passthrough() allows forward-compatible fields
 */

import { describe, it, expect } from 'vitest';
import {
  intelligenceDiscoverySchemaWithRefinements as schema,
  normalizeIntelligenceDiscoveryPayload,
  validateDiscoveryContext,
  deriveCandidateKey,
  canonicalCandidateKey,
  candidateKeySet,
  deriveCompletenessClaim,
  collectDiscoveryContractViolations,
  applyDiscoveryScanContractGate,
  INTELLIGENCE_DISCOVERY_SCHEMA_NAME,
} from '../../validators/intelligence-discovery.schema';

const validCandidate = (overrides: Record<string, any> = {}) => ({
  business_name: 'Test Auto',
  category: 'Auto Repair',
  city: 'Austin',
  state: 'TX',
  location_status: 'inside_city',
  ownership_type: 'independent',
  category_fit: 'verified',
  identity_confidence: 'high',
  discovery_signals: ['INT_LOW_VISIBILITY'],
  discovery_provenance: [{ source: 'Google', role: 'directory' }],
  business_seek_recommended: true,
  business_seek_priority: 'high',
  ...overrides,
});

const validDiscovery = (overrides: Record<string, any> = {}) => ({
  intelligence_mode: 'profile',
  category: 'Auto Repair',
  city: 'Austin',
  state: 'TX',
  focus: 'emerging',
  discovered_businesses: [validCandidate()],
  qualifying_businesses: [validCandidate()],
  candidate_count: 1,
  qualifying_count: 1,
  hold_count: 0,
  ...overrides,
});

describe('intelligence_discovery schema', () => {
  it('schema name is intelligence_discovery', () => {
    expect(INTELLIGENCE_DISCOVERY_SCHEMA_NAME).toBe('intelligence_discovery');
  });

  it('valid discovery output passes', () => {
    const result = schema.safeParse(validDiscovery());
    expect(result.success).toBe(true);
  });

  it('outside_market candidate in qualifying_businesses → fail', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({ location_status: 'outside_market' })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('national_chain in qualifying_businesses → fail', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({ ownership_type: 'national_chain' })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('regional_chain in qualifying_businesses → fail', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({ ownership_type: 'regional_chain' })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('identity_confidence low + priority not hold → fail', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({ identity_confidence: 'low', business_seek_priority: 'high' })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('identity_confidence low + priority hold → pass', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({ identity_confidence: 'low', business_seek_priority: 'hold' })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('category_fit insufficient + priority high + recommended true → fail', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({
        category_fit: 'insufficient',
        business_seek_priority: 'high',
        business_seek_recommended: true,
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('category_fit insufficient + priority hold → pass', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({
        category_fit: 'insufficient',
        business_seek_priority: 'hold',
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('category_fit insufficient + recommended false → pass', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({
        category_fit: 'insufficient',
        business_seek_recommended: false,
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('passthrough allows forward-compatible fields', () => {
    const data = validDiscovery({
      future_field: 'some future value',
      discovered_businesses: [validCandidate({ future_candidate_field: 'ok' })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('discovery_signals accept INT_* codes', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({
        discovery_signals: ['INT_LOW_VISIBILITY', 'INT_HIDDEN_TRUST', 'INT_MULTISOURCE_IDENTITY'],
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  // ─── Tolerant null handling for address/phone (model emits null for unknown) ───

  it('accepts null address and phone on discovered_businesses', () => {
    const data = validDiscovery({
      discovered_businesses: [validCandidate({ address: null, phone: null })],
      qualifying_businesses: [validCandidate({ address: null, phone: null })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts omitted address and phone (backward compat)', () => {
    const candidate = validCandidate();
    delete (candidate as any).address;
    delete (candidate as any).phone;
    const data = validDiscovery({
      discovered_businesses: [candidate],
      qualifying_businesses: [candidate],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  // ─── Tolerant null handling for discovery_provenance.url (model emits null
  //     when a source has no clean URL, e.g. a Facebook page discovered via
  //     social-first search without a canonical URL) ───

  it('accepts null url on discovery_provenance entries', () => {
    const candidate = validCandidate({
      discovery_provenance: [
        { source: 'Facebook', role: 'social-first discovery', url: null, accessed_at: '2026-09-01' },
      ],
    });
    const data = validDiscovery({
      discovered_businesses: [candidate],
      qualifying_businesses: [candidate],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts omitted url on discovery_provenance entries', () => {
    const candidate = validCandidate({
      discovery_provenance: [{ source: 'Google', role: 'directory' }],
    });
    const data = validDiscovery({
      discovered_businesses: [candidate],
      qualifying_businesses: [candidate],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

// ─── normalizeIntelligenceDiscoveryPayload: reference-style qualifying_businesses ───

describe('normalizeIntelligenceDiscoveryPayload', () => {
  it('resolves reference-style qualifying entries from discovered_businesses by name', () => {
    const full = validCandidate({ business_name: 'His Grace African Grocery' });
    const payload = validDiscovery({
      discovered_businesses: [full],
      qualifying_businesses: [
        { business_name: 'His Grace African Grocery', note: 'See discovered_businesses — identical record' },
      ],
    });
    const normalized = normalizeIntelligenceDiscoveryPayload(payload);
    const q = normalized.qualifying_businesses[0];
    // Full record fields are now present...
    expect(q.location_status).toBe('inside_city');
    expect(q.category).toBe('Auto Repair');
    expect(q.business_seek_recommended).toBe(true);
    // ...and the reference-only `note` field is preserved.
    expect(q.note).toBe('See discovered_businesses — identical record');
    // The normalized payload now passes schema validation.
    expect(schema.safeParse(normalized).success).toBe(true);
  });

  it('leaves full qualifying records untouched', () => {
    const full = validCandidate();
    const payload = validDiscovery({
      discovered_businesses: [full],
      qualifying_businesses: [full],
    });
    const normalized = normalizeIntelligenceDiscoveryPayload(payload);
    expect(normalized.qualifying_businesses[0]).toEqual(full);
  });

  it('leaves unmatched references in place so validation surfaces a clear error', () => {
    const payload = validDiscovery({
      discovered_businesses: [validCandidate({ business_name: 'Known Biz' })],
      qualifying_businesses: [
        { business_name: 'Unknown Biz', note: 'no match' },
      ],
    });
    const normalized = normalizeIntelligenceDiscoveryPayload(payload);
    // Unmatched reference is unchanged → validation fails with field-level issues.
    expect(normalized.qualifying_businesses[0].business_name).toBe('Unknown Biz');
    expect(normalized.qualifying_businesses[0].location_status).toBeUndefined();
    expect(schema.safeParse(normalized).success).toBe(false);
  });

  // ─── Missing qualifying_businesses → derive from discovered_businesses ───

  it('derives qualifying_businesses from discovered_businesses when missing', () => {
    const insideA = validCandidate({ business_name: 'Inside Biz A' });
    const insideB = validCandidate({ business_name: 'Inside Biz B' });
    const payload = {
      ...validDiscovery(),
      discovered_businesses: [insideA, insideB],
      qualifying_businesses: undefined,
    };
    const normalized = normalizeIntelligenceDiscoveryPayload(payload);
    expect(Array.isArray(normalized.qualifying_businesses)).toBe(true);
    expect(normalized.qualifying_businesses).toHaveLength(2);
    // Derived entries are the full records from discovered_businesses.
    expect(normalized.qualifying_businesses[0].business_name).toBe('Inside Biz A');
    expect(normalized.qualifying_businesses[1].business_name).toBe('Inside Biz B');
    // The normalized payload now passes schema validation.
    expect(schema.safeParse(normalized).success).toBe(true);
  });

  it('deriving qualifying_businesses excludes outside_market candidates', () => {
    const inside = validCandidate({ business_name: 'Inside Biz' });
    const outside = validCandidate({ business_name: 'Outside Biz', location_status: 'outside_market' });
    const payload = {
      ...validDiscovery(),
      discovered_businesses: [inside, outside],
      qualifying_businesses: undefined,
    };
    const normalized = normalizeIntelligenceDiscoveryPayload(payload);
    expect(normalized.qualifying_businesses).toHaveLength(1);
    expect(normalized.qualifying_businesses[0].business_name).toBe('Inside Biz');
    expect(schema.safeParse(normalized).success).toBe(true);
  });

  it('deriving qualifying_businesses excludes chain/franchise ownership types', () => {
    const independent = validCandidate({ business_name: 'Indie Biz' });
    const national = validCandidate({ business_name: 'National Biz', ownership_type: 'national_chain' });
    const regional = validCandidate({ business_name: 'Regional Biz', ownership_type: 'regional_chain' });
    const payload = {
      ...validDiscovery(),
      discovered_businesses: [independent, national, regional],
      qualifying_businesses: undefined,
    };
    const normalized = normalizeIntelligenceDiscoveryPayload(payload);
    expect(normalized.qualifying_businesses).toHaveLength(1);
    expect(normalized.qualifying_businesses[0].business_name).toBe('Indie Biz');
    expect(schema.safeParse(normalized).success).toBe(true);
  });

  it('deriving qualifying_businesses from an all-qualifying set keeps every candidate', () => {
    // Mirrors the real-world failure: model emits only discovered_businesses,
    // all of which are inside_city + independent/local_chain.
    const localChain = validCandidate({ business_name: 'Saraga', ownership_type: 'local_chain' });
    const independent = validCandidate({ business_name: 'Dreamcast', ownership_type: 'independent' });
    const adjacent = validCandidate({ business_name: 'Redias', location_status: 'adjacent_city' });
    const payload = {
      ...validDiscovery(),
      discovered_businesses: [localChain, independent, adjacent],
      qualifying_businesses: undefined,
      candidate_count: 3,
      qualifying_count: 3,
      hold_count: 0,
    };
    const normalized = normalizeIntelligenceDiscoveryPayload(payload);
    expect(normalized.qualifying_businesses).toHaveLength(3);
    expect(schema.safeParse(normalized).success).toBe(true);
  });

  it('is a no-op when discovered_businesses is empty (cannot derive)', () => {
    const payload = { ...validDiscovery(), discovered_businesses: [], qualifying_businesses: undefined };
    const normalized = normalizeIntelligenceDiscoveryPayload(payload);
    expect(normalized.qualifying_businesses).toBeUndefined();
  });

  it('is a no-op for non-object input', () => {
    expect(normalizeIntelligenceDiscoveryPayload(null)).toBeNull();
    expect(normalizeIntelligenceDiscoveryPayload('string')).toBe('string');
  });
});

// ─── Gold standard per-candidate rating fields ────────────────────────────

describe('intelligence_discovery schema — gold standard candidate fields', () => {
  it('accepts gold_standard_match + gold_standard_gate_results on a candidate', () => {
    const data = validDiscovery({
      discovered_businesses: [validCandidate({
        gold_standard_match: true,
        gold_standard_gate_results: [
          { gate: 'primary_category', passed: true, platform: 'google' },
          { gate: 'hours_present', passed: true },
        ],
      })],
      qualifying_businesses: [validCandidate({
        gold_standard_match: true,
        gold_standard_gate_results: [
          { gate: 'primary_category', passed: true, platform: 'google' },
        ],
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts null gold_standard_match (candidate not rated)', () => {
    const data = validDiscovery({
      discovered_businesses: [validCandidate({ gold_standard_match: null })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts candidates without gold standard fields (legacy / degraded mode)', () => {
    const data = validDiscovery();
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects gold_standard_gate_results with wrong element shape (missing passed)', () => {
    const data = validDiscovery({
      discovered_businesses: [validCandidate({
        gold_standard_gate_results: [{ gate: 'primary_category' }] as any,
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('accepts null gold_standard_gate_results', () => {
    const data = validDiscovery({
      discovered_businesses: [validCandidate({ gold_standard_gate_results: null })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

// ─── Bronze reason attribution (Bronze Standard System, spec §7.4) ────────

describe('intelligence_discovery schema — bronze_attribution', () => {
  it('accepts a candidate with bronze_attribution entries', () => {
    const data = validDiscovery({
      discovered_businesses: [validCandidate({
        bronze_attribution: [
          { reason_key: 'trade_manifest_only', basis: 'US Customs bill-of-lading sweep surfaced the importer' },
          { reason_key: 'endonym_only_name' },
        ],
      })],
      qualifying_businesses: [validCandidate({
        bronze_attribution: [
          { reason_key: 'trade_manifest_only', basis: 'US Customs bill-of-lading sweep surfaced the importer' },
          { reason_key: 'endonym_only_name' },
        ],
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts null bronze_attribution (block present, no reason responsible)', () => {
    const data = validDiscovery({
      discovered_businesses: [validCandidate({ bronze_attribution: null })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts candidates without bronze_attribution (no bronze block / legacy)', () => {
    const data = validDiscovery();
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects a bronze_attribution entry missing reason_key', () => {
    const data = validDiscovery({
      discovered_businesses: [validCandidate({
        bronze_attribution: [{ basis: 'no key' }] as any,
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// ─── validateDiscoveryContext — bronze attribution carry (spec §7.4) ──────

describe('validateDiscoveryContext — bronze_attribution', () => {
  it('keeps an attribution-only context (attribution counts as content)', () => {
    const ctx = validateDiscoveryContext({
      focus: 'emerging',
      bronze_attribution: [{ reason_key: 'trade_manifest_only', basis: 'customs sweep' }],
    });
    expect(ctx).not.toBeNull();
    expect(ctx?.bronze_attribution?.[0]?.reason_key).toBe('trade_manifest_only');
  });

  it('drops attribution entries missing reason_key (invalid context → null)', () => {
    const ctx = validateDiscoveryContext({
      bronze_attribution: [{ basis: 'no key' }] as any,
    });
    expect(ctx).toBeNull();
  });
});

// ─── Competitive weakness attribution (spec §6) ───────────────────────────

describe('intelligence_discovery schema — competitive_weaknesses', () => {
  it('accepts a candidate with competitive_weaknesses entries', () => {
    const data = validDiscovery({
      focus: 'competitive',
      discovered_businesses: [validCandidate({
        competitive_weaknesses: [
          { weakness_key: 'review_response_absent', basis: '312 Google reviews, zero owner responses' },
          { weakness_key: 'single_platform_concentration' },
        ],
      })],
      qualifying_businesses: [validCandidate({
        competitive_weaknesses: [
          { weakness_key: 'review_response_absent', basis: '312 Google reviews, zero owner responses' },
          { weakness_key: 'single_platform_concentration' },
        ],
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts null competitive_weaknesses and benchmark_only flag', () => {
    const data = validDiscovery({
      focus: 'competitive',
      discovered_businesses: [validCandidate({
        competitive_weaknesses: null,
        benchmark_only: true,
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts candidates without competitive_weaknesses (emerging lane / legacy)', () => {
    const data = validDiscovery();
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects a competitive_weaknesses entry missing weakness_key', () => {
    const data = validDiscovery({
      discovered_businesses: [validCandidate({
        competitive_weaknesses: [{ basis: 'no key' }] as any,
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// ─── validateDiscoveryContext — competitive weakness carry (spec §7) ──────

describe('validateDiscoveryContext — competitive_weaknesses', () => {
  it('keeps a weakness-only context (weaknesses count as content)', () => {
    const ctx = validateDiscoveryContext({
      focus: 'competitive',
      competitive_weaknesses: [{ weakness_key: 'nap_drift', basis: 'old address on Yelp' }],
    });
    expect(ctx).not.toBeNull();
    expect(ctx?.competitive_weaknesses?.[0]?.weakness_key).toBe('nap_drift');
  });

  it('keeps a dual-lane context (both attribution kinds coexist — spec §8)', () => {
    const ctx = validateDiscoveryContext({
      bronze_attribution: [{ reason_key: 'trade_manifest_only', basis: 'customs sweep' }],
      competitive_weaknesses: [{ weakness_key: 'website_gap', basis: 'no website on GBP' }],
    });
    expect(ctx).not.toBeNull();
    expect(ctx?.bronze_attribution).toHaveLength(1);
    expect(ctx?.competitive_weaknesses).toHaveLength(1);
  });

  it('drops weakness entries missing weakness_key (invalid context → null)', () => {
    const ctx = validateDiscoveryContext({
      competitive_weaknesses: [{ basis: 'no key' }] as any,
    });
    expect(ctx).toBeNull();
  });
});

// ─── Platform analysis section ────────────────────────────────────────────

describe('intelligence_discovery schema — platform_analysis section', () => {
  const validPlatformAnalysis = () => ({
    gold_standard_profile_id: 'gs-001',
    gold_standard_profile_version: 2,
    gold_standard_platform: 'google',
    platform_breakdown: [
      {
        platform: 'google',
        present_count: 10,
        absent_count: 5,
        meets_gold_standard_count: 3,
        common_gate_failures: [
          { gate: 'primary_category', failed_count: 7 },
        ],
      },
    ],
    candidates_meeting_all_gates: 3,
    most_common_gate_failures: [
      { gate: 'primary_category', failed_count: 7, severity: 'non_negotiable' },
      { gate: 'photo_count', failed_count: 4, severity: 'recommended' },
    ],
    outreach_recommendation: {
      primary_platform: 'google',
      platform_rationale: 'Deepest gold standard + most fixable gaps',
      platform_specific_opportunities: [
        { platform: 'google', opportunity: '7 candidates missing GBP primary category', evidence_summary: 'See platform_breakdown' },
      ],
      recommended_platform_focus: 'google',
      primary_angle: 'Fix your Google presence to match the category leader',
      suggested_call_to_action: 'Schedule a free Google profile audit',
    },
  });

  it('accepts a valid platform_analysis section', () => {
    const data = validDiscovery({ platform_analysis: validPlatformAnalysis() });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts absence of platform_analysis (degraded mode / no gold standard)', () => {
    const data = validDiscovery();
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts platform_analysis with null gold_standard_profile_id', () => {
    const pa = validPlatformAnalysis();
    pa.gold_standard_profile_id = null;
    const data = validDiscovery({ platform_analysis: pa });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts platform_analysis with null gold_standard_platform (cross-platform)', () => {
    const pa = validPlatformAnalysis();
    pa.gold_standard_platform = null;
    const data = validDiscovery({ platform_analysis: pa });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts platform_analysis without platform_breakdown (optional)', () => {
    const pa = validPlatformAnalysis();
    delete pa.platform_breakdown;
    const data = validDiscovery({ platform_analysis: pa });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects platform_analysis with missing outreach_recommendation (required)', () => {
    const pa = validPlatformAnalysis();
    delete pa.outreach_recommendation;
    const data = validDiscovery({ platform_analysis: pa });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects platform_analysis with missing candidates_meeting_all_gates (required)', () => {
    const pa = validPlatformAnalysis();
    delete pa.candidates_meeting_all_gates;
    const data = validDiscovery({ platform_analysis: pa });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects platform_breakdown element with wrong shape (missing present_count)', () => {
    const pa = validPlatformAnalysis();
    (pa.platform_breakdown as any)[0] = { platform: 'google', absent_count: 5 };
    const data = validDiscovery({ platform_analysis: pa });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('accepts extra fields in platform_analysis via passthrough', () => {
    const pa = { ...validPlatformAnalysis(), future_field: 'ok' };
    const data = validDiscovery({ platform_analysis: pa });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

// ─── Scan contract (Discovery Scan Contract Spec v1.3) ────────────────────

const validLedgerRow = (overrides: Record<string, any> = {}) => ({
  unit_id: 'zip:64118',
  unit_type: 'zip_label_matrix',
  unit: '64118 (Kansas City, MO + Gladstone, MO)',
  platforms_swept: ['google'],
  labels_swept: ['Grocery store'],
  status: 'executed_with_findings',
  findings_count: 1,
  candidate_keys: ['test-auto--austin-tx'],
  executed_at: '2026-09-22',
  ...overrides,
});

const validContract = (overrides: Record<string, any> = {}) => ({
  contract_version: 'discovery-scan-contract-v1',
  sweep_ledger: [validLedgerRow()],
  coverage_attestation: {
    units_total: 1,
    units_executed: 1,
    units_executed_empty: 0,
    units_not_executed: 0,
    units_blocked: 0,
    vectors_total: 1,
    vectors_executed: 1,
    vectors_not_executed: 0,
    coverage_ratio: 1,
    completeness_claim: 'verified_full',
    uncovered_municipalities: [],
    unexecuted_vector_list: [],
  },
  municipality_coverage: [],
  reconciliation: null,
  ...overrides,
});

describe('intelligence_discovery schema — scan_contract', () => {
  it('accepts a payload carrying a valid scan_contract', () => {
    const data = validDiscovery({ scan_contract: validContract() });
    expect(schema.safeParse(data).success).toBe(true);
  });

  it('accepts payload without scan_contract (pre-contract / degraded)', () => {
    expect(schema.safeParse(validDiscovery()).success).toBe(true);
  });

  it('rejects a ledger row with an unknown status', () => {
    const c = validContract({ sweep_ledger: [validLedgerRow({ status: 'swept' })] });
    expect(schema.safeParse(validDiscovery({ scan_contract: c })).success).toBe(false);
  });

  it('accepts candidate_key_aliases on a candidate', () => {
    const data = validDiscovery({
      discovered_businesses: [validCandidate({ candidate_key_aliases: ['Al-Hallal Market', 'Darsalaam Foods'] })],
    });
    expect(schema.safeParse(data).success).toBe(true);
  });
});

describe('normalizeIntelligenceDiscoveryPayload — scan_contract degraded mode', () => {
  it('synthesizes an unverified scan_contract when absent', () => {
    const normalized = normalizeIntelligenceDiscoveryPayload(validDiscovery());
    expect(normalized.scan_contract).toBeDefined();
    expect(normalized.scan_contract.coverage_attestation.completeness_claim).toBe('unverified');
    expect(normalized.scan_contract.sweep_ledger).toEqual([]);
  });

  it('leaves a model-emitted scan_contract untouched', () => {
    const contract = validContract();
    const normalized = normalizeIntelligenceDiscoveryPayload(validDiscovery({ scan_contract: contract }));
    expect(normalized.scan_contract).toBe(contract);
  });
});

describe('candidate_key derivation', () => {
  it('slugs name + city + state, dropping legal suffixes and punctuation', () => {
    expect(deriveCandidateKey('Universal African Market LLC', 'Gladstone', 'MO'))
      .toBe('universal-african-market--gladstone-mo');
    expect(deriveCandidateKey("O'Brien & Sons, Inc.", 'Kansas City', 'MO'))
      .toBe('obrien-and-sons--kansas-city-mo');
    expect(deriveCandidateKey('Springfield Diner', 'Springfield', 'IL'))
      .not.toBe(deriveCandidateKey('Springfield Diner', 'Springfield', 'MO'));
  });

  it('canonicalizes separator/casing drift to the same key', () => {
    const a = canonicalCandidateKey('universal-african-market--gladstone-mo');
    const b = canonicalCandidateKey('Universal African Market (Gladstone, MO)');
    const c = canonicalCandidateKey('universal african market gladstone mo');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('candidateKeySet covers primary key, name-only, and aliases', () => {
    const keys = candidateKeySet({
      business_name: 'Tawakal Market',
      city: 'Kansas City',
      candidate_key_aliases: ['Al-Hallal', 'Darsalaam'],
    });
    expect(keys.has(canonicalCandidateKey('tawakal-market--kansas-city'))).toBe(true);
    expect(keys.has(canonicalCandidateKey('Tawakal Market'))).toBe(true);
    expect(keys.has(canonicalCandidateKey('al-hallal--kansas-city'))).toBe(true);
    expect(keys.has(canonicalCandidateKey('darsalaam--kansas-city'))).toBe(true);
  });
});

describe('deriveCompletenessClaim', () => {
  it('returns unverified when nothing executed', () => {
    expect(deriveCompletenessClaim({ units_executed: 0 })).toBe('unverified');
    expect(deriveCompletenessClaim(null)).toBe('unverified');
  });

  it('returns verified_full only when nothing is unexecuted or uncovered', () => {
    expect(deriveCompletenessClaim({
      units_executed: 5, units_not_executed: 0, vectors_not_executed: 0, uncovered_municipalities: [],
    })).toBe('verified_full');
  });

  it('caps at verified_partial when anything is unexecuted or uncovered', () => {
    expect(deriveCompletenessClaim({
      units_executed: 5, units_not_executed: 1, vectors_not_executed: 0, uncovered_municipalities: [],
    })).toBe('verified_partial');
    expect(deriveCompletenessClaim({
      units_executed: 5, units_not_executed: 0, vectors_not_executed: 2, uncovered_municipalities: [],
    })).toBe('verified_partial');
    expect(deriveCompletenessClaim({
      units_executed: 5, units_not_executed: 0, vectors_not_executed: 0, uncovered_municipalities: ['Gladstone, MO'],
    })).toBe('verified_partial');
  });
});

describe('collectDiscoveryContractViolations', () => {
  const payloadWith = (contract: any, candidates: any[] = [validCandidate()]) =>
    validDiscovery({ discovered_businesses: candidates, qualifying_businesses: candidates, scan_contract: contract });

  it('returns no violations for a clean contract', () => {
    const data = payloadWith(validContract({
      sweep_ledger: [validLedgerRow({ candidate_keys: ['test-auto--austin-tx'] })],
    }));
    expect(collectDiscoveryContractViolations(data)).toEqual([]);
  });

  it('returns no violations when scan_contract is absent (synthesized upstream)', () => {
    expect(collectDiscoveryContractViolations(validDiscovery())).toEqual([]);
  });

  it('INV-1: candidate absent from every ledger row → violation', () => {
    const data = payloadWith(validContract({
      sweep_ledger: [validLedgerRow({ candidate_keys: ['somebody-else--austin-tx'] })],
    }));
    const v = collectDiscoveryContractViolations(data);
    expect(v.some((x) => x.invariant === 'INV-1')).toBe(true);
  });

  it('INV-1: alias match satisfies provenance (Tawakal / Al-Hallal case)', () => {
    const biz = validCandidate({ business_name: 'Tawakal Market', candidate_key_aliases: ['Al-Hallal Market'] });
    const data = payloadWith(validContract({
      sweep_ledger: [validLedgerRow({ candidate_keys: ['al-hallal-market--austin-tx'] })],
    }), [biz]);
    expect(collectDiscoveryContractViolations(data).filter((x) => x.invariant === 'INV-1')).toEqual([]);
  });

  it('INV-2: executed_with_findings without backing keys → violation', () => {
    const data = payloadWith(validContract({
      sweep_ledger: [validLedgerRow({ findings_count: 0, candidate_keys: [] })],
    }));
    expect(collectDiscoveryContractViolations(data).some((x) => x.invariant === 'INV-2')).toBe(true);
  });

  it('INV-2: blocked row without blocked_reason → violation', () => {
    const data = payloadWith(validContract({
      sweep_ledger: [validLedgerRow({ status: 'blocked', findings_count: null, candidate_keys: [] })],
    }));
    expect(collectDiscoveryContractViolations(data).some((x) => x.invariant === 'INV-2')).toBe(true);
  });

  it('INV-5: claimed verified_full over a partial ledger → violation', () => {
    const data = payloadWith(validContract({
      coverage_attestation: {
        ...validContract().coverage_attestation,
        units_not_executed: 3,
      },
    }));
    const v = collectDiscoveryContractViolations(data);
    const inv5 = v.find((x) => x.invariant === 'INV-5');
    expect(inv5).toBeDefined();
    expect(inv5!.message).toContain('verified_partial');
  });

  it('INV-6: unexecuted vectors not named → violation', () => {
    const data = payloadWith(validContract({
      coverage_attestation: {
        ...validContract().coverage_attestation,
        vectors_not_executed: 2,
        unexecuted_vector_list: [{ vector: 'Street View sweep', reason: 'no imagery review' }],
        completeness_claim: 'verified_partial',
      },
    }));
    expect(collectDiscoveryContractViolations(data).some((x) => x.invariant === 'INV-6')).toBe(true);
  });

  it('INV-8: executed_empty with empty platforms/labels → violation', () => {
    const data = payloadWith(validContract({
      sweep_ledger: [validLedgerRow({ status: 'executed_empty', findings_count: 0, candidate_keys: [], platforms_swept: [], labels_swept: [] })],
      coverage_attestation: { ...validContract().coverage_attestation, completeness_claim: 'verified_full' },
    }));
    expect(collectDiscoveryContractViolations(data).some((x) => x.invariant === 'INV-8')).toBe(true);
  });

  it('INV-3: expected ZIP with no ledger row → violation; satisfied when row exists', () => {
    const data = payloadWith(validContract());
    const missing = collectDiscoveryContractViolations(data, { expectedZips: ['64118', '64131'] });
    expect(missing.filter((x) => x.invariant === 'INV-3')).toHaveLength(1);
    const covered = collectDiscoveryContractViolations(data, { expectedZips: ['64118'] });
    expect(covered.filter((x) => x.invariant === 'INV-3')).toHaveLength(0);
  });

  it('INV-4: expected municipality missing; uncovered row not echoed to attestation', () => {
    const data = payloadWith(validContract({
      municipality_coverage: [{ municipality: 'Gladstone, MO', status: 'uncovered' }],
    }));
    const v = collectDiscoveryContractViolations(data, {
      expectedMunicipalities: ['Gladstone, MO', 'Liberty, MO'],
    });
    const inv4 = v.filter((x) => x.invariant === 'INV-4');
    // Liberty missing a row + Gladstone uncovered-not-echoed = 2 violations
    expect(inv4).toHaveLength(2);
  });

  it('INV-7: operator member resolving to nothing → violation', () => {
    const data = payloadWith(validContract({
      reconciliation: {
        operator_supplied_members: ['Test Auto', 'Ghost Business'],
        matched_to_candidates: ['test-auto--austin-tx'],
        unmatched: [],
        excluded_with_reason: [],
      },
    }));
    const v = collectDiscoveryContractViolations(data).filter((x) => x.invariant === 'INV-7');
    expect(v).toHaveLength(1);
    expect(v[0].message).toContain('Ghost Business');
  });

  it('INV-7: member matching a candidate name resolves clean', () => {
    const data = payloadWith(validContract({
      reconciliation: { operator_supplied_members: ['Test Auto'], unmatched: [] },
    }));
    expect(collectDiscoveryContractViolations(data).filter((x) => x.invariant === 'INV-7')).toHaveLength(0);
  });

  it('INV-7: member listed in unmatched is itself a violation (G4)', () => {
    const data = payloadWith(validContract({
      reconciliation: { operator_supplied_members: ['Missed Business'], unmatched: ['Missed Business'] },
    }));
    const v = collectDiscoveryContractViolations(data).filter((x) => x.invariant === 'INV-7');
    expect(v).toHaveLength(1);
    expect(v[0].message).toContain('missed a real business');
  });

  it('INV-7: member in excluded_with_reason resolves clean', () => {
    const data = payloadWith(validContract({
      reconciliation: {
        operator_supplied_members: ['Excluded Biz'],
        excluded_with_reason: [{ member: 'Excluded Biz', reason: 'national chain' }],
      },
    }));
    expect(collectDiscoveryContractViolations(data).filter((x) => x.invariant === 'INV-7')).toHaveLength(0);
  });
});

describe('applyDiscoveryScanContractGate', () => {
  const payloadWith = (contract: any, candidates: any[] = [validCandidate()]) =>
    validDiscovery({ discovered_businesses: candidates, qualifying_businesses: candidates, scan_contract: contract });

  it('returns the payload untouched when scan_contract is absent', () => {
    const data = validDiscovery();
    expect(applyDiscoveryScanContractGate(data)).toBe(data);
    expect(data.scan_contract_violations).toBeUndefined();
  });

  it('stamps violations into scan_contract_violations (report-mode)', () => {
    const data = payloadWith(validContract({
      sweep_ledger: [validLedgerRow({ candidate_keys: ['somebody-else--austin-tx'] })],
    }));
    applyDiscoveryScanContractGate(data);
    expect(Array.isArray(data.scan_contract_violations)).toBe(true);
    expect(data.scan_contract_violations.some((v: any) => v.invariant === 'INV-1')).toBe(true);
  });

  it('overwrites an over-claimed completeness_claim with the derived value', () => {
    const data = payloadWith(validContract({
      coverage_attestation: {
        ...validContract().coverage_attestation,
        units_not_executed: 4,
      },
    }));
    applyDiscoveryScanContractGate(data);
    expect(data.scan_contract.coverage_attestation.completeness_claim).toBe('verified_partial');
    expect(data.scan_contract_violations.some((v: any) => v.invariant === 'INV-5')).toBe(true);
  });

  it('computes reconciliation for import-time members: match → key, miss → unmatched + INV-7', () => {
    const data = payloadWith(validContract());
    applyDiscoveryScanContractGate(data, {
      operatorSuppliedMembers: ['Test Auto', 'Ghost Business LLC'],
    });
    const recon = data.scan_contract.reconciliation;
    expect(recon.operator_supplied_members).toEqual(expect.arrayContaining(['Test Auto', 'Ghost Business LLC']));
    expect(recon.matched_to_candidates).toContain('test-auto--austin-tx');
    expect(recon.unmatched).toContain('Ghost Business LLC');
    expect(data.scan_contract_violations.some((v: any) => v.invariant === 'INV-7')).toBe(true);
  });

  it('merges model-emitted reconciliation rather than overwriting', () => {
    const data = payloadWith(validContract({
      reconciliation: {
        operator_supplied_members: ['Earlier Member'],
        matched_to_candidates: ['earlier-member--austin-tx'],
        unmatched: ['Earlier Miss'],
        excluded_with_reason: [{ member: 'Excluded Biz', reason: 'chain' }],
      },
    }));
    applyDiscoveryScanContractGate(data, { operatorSuppliedMembers: ['Test Auto'] });
    const recon = data.scan_contract.reconciliation;
    expect(recon.operator_supplied_members).toEqual(expect.arrayContaining(['Earlier Member', 'Test Auto']));
    expect(recon.matched_to_candidates).toEqual(expect.arrayContaining(['earlier-member--austin-tx', 'test-auto--austin-tx']));
    expect(recon.unmatched).toContain('Earlier Miss');
    expect(recon.excluded_with_reason).toHaveLength(1);
  });

  it('passes expectedZips through to INV-3', () => {
    const data = payloadWith(validContract());
    applyDiscoveryScanContractGate(data, { expectedZips: ['64118', '64131'] });
    expect(data.scan_contract_violations.filter((v: any) => v.invariant === 'INV-3')).toHaveLength(1);
  });
});
