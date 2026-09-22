/**
 * SeedReportEvidenceService tests (§6.7, §8, §11.6, §18)
 *
 * Verifies:
 * - normalizeCandidateEvidence: validation failure path, stable observation
 *   ID assignment, source normalization, seed resolution
 * - validateSignals: registry allowlist enforcement (INT family only,
 *   active only, basis + source_observation_ids required), quarantine path
 * - buildSubstrateEvidence: legacy-seed report path from provenance rows
 * - ManualOutreachAnchorService NAP write-back: connected-contact gate for
 *   fact_confirmed / fact_corrected (§20.4 invariants 2–3)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (hoisted) ─────────────────────────────────────────────────────

const {
  mockQueryRaw,
  mockExecuteRaw,
  mockSignalRegistryFindMany,
  mockGetSignalRegistryCache,
  mockSetSignalRegistryCache,
  mockAudit,
  mockResolveSignalDivergences,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockSignalRegistryFindMany: vi.fn(),
  mockGetSignalRegistryCache: vi.fn(),
  mockSetSignalRegistryCache: vi.fn(),
  mockAudit: vi.fn(),
  mockResolveSignalDivergences: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    mkt_signal_registry: { findMany: mockSignalRegistryFindMany },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({
  audit: mockAudit,
}));

vi.mock('../triage/signal-taxonomy', () => ({
  getSignalRegistryCache: mockGetSignalRegistryCache,
  setSignalRegistryCache: mockSetSignalRegistryCache,
}));

// Phase 7 — the substrate path lazily imports IntelligenceProfileService to
// resolve platform-signal divergences; mock the singleton so tests control
// what the resolver returns.
vi.mock('../intelligence/IntelligenceProfileService', () => ({
  IntelligenceProfileService: {
    getInstance: () => ({ resolveSignalDivergences: mockResolveSignalDivergences }),
  },
}));

vi.mock('../../lib/id-generator', () => ({
  generateDirectoryFieldProvenanceId: vi.fn(() => 'dfp-test'),
  generateManualOutreachAnchorId: vi.fn(() => 'anchor-test'),
  generateOutreachLogId: vi.fn(() => 'mol-test'),
}));

import { SeedReportEvidenceService } from '../intelligence/SeedReportEvidenceService';
import { ManualOutreachAnchorService } from '../intelligence/ManualOutreachAnchorService';
import { MarketContextLoader } from '../intelligence/MarketContextLoader';

// Prisma tagged-template calls arrive as (strings[], ...values).
const sqlText = (call: any[]): string =>
  Array.isArray(call[0]) ? call[0].join('?') : String(call[0]);

const sqlCallsMatching = (mock: any, needle: string) =>
  mock.mock.calls.filter((c: any[]) => sqlText(c).includes(needle));

const ctx = { userId: 'op-1', region: 'us' } as any;

// ─── Fixtures ────────────────────────────────────────────────────────────

const obs = (overrides: Record<string, any> = {}) => ({
  subject: 'seed',
  field: 'business_name',
  value: 'Acme Auto',
  state: 'observed',
  confidence: 'high',
  source_name: 'Google',
  source_type: 'DIRECTORY',
  source_url: 'https://maps.example/acme',
  observed_at: '2025-01-01',
  notes: null,
  ...overrides,
});

const emptyEvidence = () => ({
  observations: [],
  identity_candidates: [],
  category_assessment: null,
  geographic_assessment: null,
  signals: [],
  unresolved_questions: [],
  platform_observations: [],
});

const candidate = (overrides: Record<string, any> = {}) => ({
  candidate_key: 'cand-1',
  business_name: 'Acme Auto',
  city: 'Indianapolis',
  state: 'IN',
  report_evidence: {
    ...emptyEvidence(),
    observations: [obs()],
  },
  ...overrides,
});

const signal = (overrides: Record<string, any> = {}) => ({
  code: 'INT_MISSING_WEBSITE',
  family: 'INT',
  basis: 'No website found in 3 checked sources',
  source_observation_ids: ['obs-1'],
  ...overrides,
});

// SignalRegistryRow shape (camelCase — what the cache carries)
const registryRow = (overrides: Record<string, any> = {}) => ({
  id: 'sig-1',
  code: 'INT_MISSING_WEBSITE',
  family: 'INT',
  label: 'Missing website',
  description: null,
  detectionSource: 'discovery',
  derivedRule: null,
  isActive: true,
  ...overrides,
});

// ─── normalizeCandidateEvidence ──────────────────────────────────────────

describe('SeedReportEvidenceService.normalizeCandidateEvidence', () => {
  const service = SeedReportEvidenceService.getInstance();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSignalRegistryCache.mockReturnValue([registryRow()]);
    mockQueryRaw.mockResolvedValue([]);
  });

  it('returns valid=false with an error for malformed input', async () => {
    const result = await service.normalizeCandidateEvidence({ garbage: true }, ctx);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.candidate_key).toBe('unknown');
  });

  it('assigns stable observation IDs when the prompt omits them', async () => {
    const result = await service.normalizeCandidateEvidence(candidate(), ctx);
    expect(result.valid).toBe(true);
    expect(result.observations_with_ids[0].observation_id).toBe('obs-cand-1-000');
  });

  it('normalizes source_type to lowercase and trims source_name', async () => {
    const result = await service.normalizeCandidateEvidence(
      candidate({
        report_evidence: {
          ...emptyEvidence(),
          observations: [obs({ source_type: '  DIRECTORY ', source_name: '  Google  ' })],
        },
      }),
      ctx,
    );
    expect(result.observations_with_ids[0].source_type).toBe('directory');
    expect(result.observations_with_ids[0].source_name).toBe('Google');
  });

  it('resolves seed_id by business name + city match', async () => {
    mockQueryRaw.mockImplementation((...args: any[]) => {
      if (sqlText(args).includes('FROM directory_presence_seeds')) {
        return Promise.resolve([{ id: 'seed-42' }]);
      }
      return Promise.resolve([]);
    });
    const result = await service.normalizeCandidateEvidence(candidate(), ctx);
    expect(result.seed_id).toBe('seed-42');
  });

  it('returns seed_id=null when no seed matches', async () => {
    mockQueryRaw.mockResolvedValue([]);
    const result = await service.normalizeCandidateEvidence(candidate(), ctx);
    expect(result.seed_id).toBeNull();
  });
});

// ─── validateSignals ─────────────────────────────────────────────────────

describe('SeedReportEvidenceService.validateSignals (§6.7)', () => {
  const service = SeedReportEvidenceService.getInstance();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSignalRegistryCache.mockReturnValue([registryRow()]);
  });

  it('validates an active INT-family registry signal', async () => {
    const { validated, quarantined } = await service.validateSignals([signal()], ctx);
    expect(validated).toHaveLength(1);
    expect(validated[0].registry_signal_id).toBe('sig-1');
    expect(validated[0].label).toBe('Missing website');
    expect(quarantined).toHaveLength(0);
  });

  it('quarantines a signal not in the registry', async () => {
    const { validated, quarantined } = await service.validateSignals(
      [signal({ code: 'INT_UNKNOWN_CODE' })],
      ctx,
    );
    expect(validated).toHaveLength(0);
    expect(quarantined[0].reason).toContain('not found in mkt_signal_registry');
  });

  it('quarantines an inactive registry signal', async () => {
    // Cache filter drops inactive rows → the signal looks unregistered
    mockGetSignalRegistryCache.mockReturnValue([registryRow({ isActive: false })]);
    const { quarantined } = await service.validateSignals([signal()], ctx);
    expect(quarantined[0].reason).toContain('not found in mkt_signal_registry');
  });

  it('quarantines a signal whose registry family is not INT', async () => {
    // Cache filter keeps only INT rows → a BA-family code looks unregistered
    mockGetSignalRegistryCache.mockReturnValue([registryRow({ family: 'BA' })]);
    const { quarantined } = await service.validateSignals([signal()], ctx);
    expect(quarantined.length).toBe(1);
  });

  it('quarantines a signal with no evidence basis', async () => {
    const { quarantined } = await service.validateSignals(
      [signal({ basis: '' })],
      ctx,
    );
    expect(quarantined[0].reason).toContain('no evidence basis');
  });

  it('quarantines a signal with no source_observation_ids', async () => {
    const { quarantined } = await service.validateSignals(
      [signal({ source_observation_ids: [] })],
      ctx,
    );
    expect(quarantined[0].reason).toContain('no source_observation_ids');
  });

  it('falls back to DB registry when cache is empty', async () => {
    mockGetSignalRegistryCache.mockReturnValue(null);
    // DB rows are snake_case — the service maps them to SignalRegistryRow
    mockSignalRegistryFindMany.mockResolvedValue([{
      id: 'sig-1',
      code: 'INT_MISSING_WEBSITE',
      family: 'INT',
      label: 'Missing website',
      description: null,
      detection_source: 'discovery',
      derived_rule: null,
      is_active: true,
    }]);
    const { validated } = await service.validateSignals([signal()], ctx);
    expect(validated).toHaveLength(1);
    expect(mockSignalRegistryFindMany).toHaveBeenCalled();
  });
});

// ─── buildSubstrateEvidence (§18 legacy-seed path) ───────────────────────

describe('SeedReportEvidenceService.buildSubstrateEvidence', () => {
  const service = SeedReportEvidenceService.getInstance();

  const seedStateRow = {
    id: 'seed-1',
    identity_confidence: 'high',
    category_fit: 'verified',
    category: 'Auto Repair',
    city: 'Indianapolis',
    state: 'IN',
    name_variants: ['Acme Auto'],
    nap_owner_corrected: false,
    nap_verified_at: null,
    owner_verified_at: null,
    owner_verification: null,
    contact_status: 'none',
    outreach_state: 'none',
    status: 'active',
    claimed_at: null,
  };

  const provRow = (fieldKey: string, value: string) => ({
    id: `prov-${fieldKey}`,
    field_key: fieldKey,
    value,
    source_name: 'Google',
    source_url: 'https://maps.example',
    accessed_at: new Date('2025-01-01'),
    confidence: 'high',
    evidence_state: 'observed',
    notes: null,
    override_by: null,
    override_at: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw.mockImplementation((...args: any[]) => {
      const sql = sqlText(args);
      if (sql.includes('FROM directory_presence_seeds')) return Promise.resolve([seedStateRow]);
      if (sql.includes('FROM directory_field_provenance')) {
        return Promise.resolve([
          provRow('business_name', 'Acme Auto'),
          provRow('address', '123 Main St'),
          provRow('phone', '317-555-0100'),
        ]);
      }
      return Promise.resolve([]);
    });
    // Phase 7 defaults: no divergences resolved, no INT rows in registry cache.
    mockResolveSignalDivergences.mockResolvedValue([]);
    mockGetSignalRegistryCache.mockReturnValue([]);
  });

  it('builds observations from provenance rows with stable IDs', async () => {
    const result = await service.buildSubstrateEvidence('seed-1', ctx);
    expect(result.valid).toBe(true);
    expect(result.seed_id).toBe('seed-1');
    expect(result.observations_with_ids).toHaveLength(3);
    expect(result.observations_with_ids[0].observation_id).toMatch(/^obs-sub-seed-1-\d{3}$/);
    expect(result.observations_with_ids[0].state).toBe('observed');
  });

  it('builds an identity candidate from provenance + seed state', async () => {
    const result = await service.buildSubstrateEvidence('seed-1', ctx);
    const ic = result.evidence.identity_candidates[0];
    expect(ic.business_name).toBe('Acme Auto');
    expect(ic.city).toBe('Indianapolis');
    expect(ic.identity_confidence).toBe('high');
  });

  it('maps a city-bearing seed to inside_city (claim-hook eligible geography)', async () => {
    const result = await service.buildSubstrateEvidence('seed-1', ctx);
    expect(result.evidence.geographic_assessment?.location_status).toBe('inside_city');
  });

  it('throws NotFoundError for a missing seed', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await expect(service.buildSubstrateEvidence('seed-missing', ctx)).rejects.toThrow('Seed not found');
  });

  // ─── Phase 7: INT_PLATFORM_SIGNAL_DIVERGENCE (spec §5) ───────────────

  const divergenceRow = (over: Record<string, any> = {}) => ({
    platform: 'google',
    weight: 0.6,
    basis: 'local estimate: 8 observations',
    confidence: 0.8,
    observations: 8,
    scope: 'local',
    profileId: 'ip-local',
    profileVersion: 2,
    divergence: -0.3,
    precedenceViaConfidence: true,
    ...over,
  });

  it('emits a validated divergence signal + observation when the registry carries the code', async () => {
    mockResolveSignalDivergences.mockResolvedValue([divergenceRow()]);
    mockGetSignalRegistryCache.mockReturnValue([
      registryRow({
        id: 'sig-div',
        code: 'INT_PLATFORM_SIGNAL_DIVERGENCE',
        label: 'Platform Signal Divergence',
      }),
    ]);
    const result = await service.buildSubstrateEvidence('seed-1', ctx);
    // 3 provenance observations + 1 divergence observation
    expect(result.observations_with_ids).toHaveLength(4);
    const divObs = result.observations_with_ids.find((o) =>
      o.observation_id?.startsWith('obs-div-'),
    );
    expect(divObs).toBeTruthy();
    expect(divObs!.field).toBe('platform_signal_weight:google');
    expect(divObs!.source_type).toBe('intelligence_profile');
    expect(result.validated_signals).toHaveLength(1);
    expect(result.validated_signals[0].code).toBe('INT_PLATFORM_SIGNAL_DIVERGENCE');
    expect(result.validated_signals[0].source_observation_ids).toEqual([
      divObs!.observation_id,
    ]);
    expect(result.quarantined_signals).toHaveLength(0);
    // The normalized evidence carries the signal too.
    expect(result.evidence.signals[0].code).toBe('INT_PLATFORM_SIGNAL_DIVERGENCE');
    expect(result.evidence.signals[0].registry_signal_id).toBe('sig-div');
  });

  it('quarantines the divergence signal when the code is not registered', async () => {
    mockResolveSignalDivergences.mockResolvedValue([divergenceRow()]);
    const result = await service.buildSubstrateEvidence('seed-1', ctx);
    expect(result.validated_signals).toHaveLength(0);
    expect(result.quarantined_signals).toHaveLength(1);
    expect(result.quarantined_signals[0].code).toBe('INT_PLATFORM_SIGNAL_DIVERGENCE');
    expect(result.evidence.signals).toHaveLength(0);
  });

  it('emits no signals when nothing diverges (legacy shape preserved)', async () => {
    const result = await service.buildSubstrateEvidence('seed-1', ctx);
    expect(result.evidence.signals).toEqual([]);
    expect(result.validated_signals).toEqual([]);
    expect(result.observations_with_ids).toHaveLength(3);
  });

  it('is non-fatal when divergence resolution throws', async () => {
    mockResolveSignalDivergences.mockRejectedValue(new Error('profile db down'));
    const result = await service.buildSubstrateEvidence('seed-1', ctx);
    expect(result.valid).toBe(true);
    expect(result.observations_with_ids).toHaveLength(3);
    expect(result.evidence.signals).toEqual([]);
  });
});

// ─── getSeedReportContext (audit + enrichment fragments) ─────────────────
//
// Chain under test:
//   directory_seed_campaign_links → mkt_campaigns_list.discovery_context
//   → mkt_audits_list (business_analysis + category_identification)
//   → directory_category_enrichment (via MarketContextLoader)
//   → mkt_prospect_queue.business_snapshot (attribution fallback)

describe('SeedReportEvidenceService.getSeedReportContext', () => {
  const service = SeedReportEvidenceService.getInstance();
  const marketLoader = MarketContextLoader.getInstance();

  const dims = { category: 'Auto Repair', city: 'Indianapolis', state: 'IN' };

  const baAuditRow = {
    id: 'audit-ba-1',
    platform: 'business_analysis',
    audit_data: {
      public_narrative: 'A neighborhood auto shop on the east side.',
      platforms: {
        google: {
          profile_status: 'claimed',
          profile_url: 'https://maps.example/acme',
          displayed_name: 'Acme Auto',
          primary_category: 'Auto repair shop',
        },
        yelp: { profile_status: 'unable_to_verify' },
      },
    },
    created_at: new Date('2026-09-01'),
  };

  const catAuditRow = {
    id: 'audit-cat-1',
    platform: 'category_identification',
    audit_data: {
      public_narrative: 'Fallback narrative from the category audit.',
      candidate_categories: [
        { category: 'Auto Repair', confidence: 'high', reasoning: 'primary fit' },
        { category: 'Tire Shop', confidence: 'medium', subcategory: null, reasoning: 'sells tires' },
      ],
      digital_footprint: {
        platforms_found: [
          { platform: 'google', url: 'https://maps.example/acme', claimed: true, has_website: true },
          { platform: 'facebook', url: 'https://fb.example/acme', claimed: false },
        ],
      },
    },
    created_at: new Date('2026-08-15'),
  };

  const enrichmentRows = [
    {
      category_key: 'Auto Repair',
      context: {
        category_summary: 'Auto repair shops in this market compete on trust signals.',
        category_signals: ['reviews with owner responses', 'service menu published'],
      },
    },
    {
      category_key: '__location__',
      context: {
        market_summary: 'Indianapolis has a dense independent-repair corridor.',
        metro_context: 'Indianapolis anchors a broad central-Indiana metro.',
        notable_areas: [' Irvington ', ''],
      },
    },
  ];

  /** Wire mockQueryRaw to the fragment-bearing rows; empty elsewhere. */
  const wireFragmentRows = (overrides: {
    links?: any[];
    campaigns?: any[];
    audits?: any[];
    queue?: any[];
    enrichment?: any[];
    catalog?: any[];
  }) => {
    mockQueryRaw.mockImplementation((...args: any[]) => {
      const sql = sqlText(args);
      if (sql.includes('FROM directory_seed_campaign_links')) return Promise.resolve(overrides.links ?? []);
      if (sql.includes('FROM mkt_campaigns_list')) return Promise.resolve(overrides.campaigns ?? []);
      if (sql.includes('FROM mkt_audits_list')) return Promise.resolve(overrides.audits ?? []);
      if (sql.includes('FROM mkt_prospect_queue')) return Promise.resolve(overrides.queue ?? []);
      if (sql.includes('FROM directory_category_enrichment')) return Promise.resolve(overrides.enrichment ?? []);
      if (sql.includes('FROM mkt_bronze_reason_catalog')) return Promise.resolve(overrides.catalog ?? []);
      return Promise.resolve([]);
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    marketLoader.resetCache();
    mockGetSignalRegistryCache.mockReturnValue([]);
    wireFragmentRows({});
  });

  it('returns an empty context when the seed has no campaign link', async () => {
    const rctx = await service.getSeedReportContext('seed-1', dims, ctx);
    expect(rctx.campaign_id).toBeNull();
    expect(rctx.public_narrative).toBeNull();
    expect(rctx.candidate_categories).toEqual([]);
    expect(rctx.platform_observations).toEqual([]);
    expect(rctx.discovery_attribution).toEqual([]);
    expect(rctx.audit_ids).toEqual([]);
  });

  it('prefers the business_analysis narrative and carries both audit ids', async () => {
    wireFragmentRows({
      links: [{ campaign_id: 'cmp-1' }],
      campaigns: [{ discovery_context: null }],
      audits: [baAuditRow, catAuditRow],
    });
    const rctx = await service.getSeedReportContext('seed-1', dims, ctx);
    expect(rctx.campaign_id).toBe('cmp-1');
    expect(rctx.public_narrative).toBe('A neighborhood auto shop on the east side.');
    expect(rctx.business_analysis_audit_id).toBe('audit-ba-1');
    expect(rctx.category_identification_audit_id).toBe('audit-cat-1');
    expect(rctx.audit_ids).toEqual(['audit-ba-1', 'audit-cat-1']);
  });

  it('falls back to the category_identification narrative', async () => {
    wireFragmentRows({
      links: [{ campaign_id: 'cmp-1' }],
      campaigns: [{ discovery_context: null }],
      audits: [catAuditRow],
    });
    const rctx = await service.getSeedReportContext('seed-1', dims, ctx);
    expect(rctx.public_narrative).toBe('Fallback narrative from the category audit.');
  });

  it('maps candidate_categories into the shelf portfolio', async () => {
    wireFragmentRows({
      links: [{ campaign_id: 'cmp-1' }],
      campaigns: [{ discovery_context: null }],
      audits: [catAuditRow],
    });
    const rctx = await service.getSeedReportContext('seed-1', dims, ctx);
    expect(rctx.candidate_categories).toHaveLength(2);
    expect(rctx.candidate_categories[1]).toEqual({
      category: 'Tire Shop',
      confidence: 'medium',
      subcategory: null,
      basis: 'sells tires',
    });
  });

  it('maps audit platforms to observations — unable_to_verify is skipped (§4.3)', async () => {
    wireFragmentRows({
      links: [{ campaign_id: 'cmp-1' }],
      campaigns: [{ discovery_context: null }],
      audits: [baAuditRow, catAuditRow],
    });
    const rctx = await service.getSeedReportContext('seed-1', dims, ctx);
    const platforms = rctx.platform_observations.map((p) => p.platform);
    // google from BA (wins over the footprint duplicate), facebook from the
    // footprint, yelp skipped — unable_to_verify is not an absence finding.
    expect(platforms).toEqual(['google', 'facebook']);
    const google = rctx.platform_observations[0];
    expect(google.presence).toBe('observed');
    expect(google.claimed_status).toBe('claimed');
    expect(google.source_url).toBe('https://maps.example/acme');
    expect(google.primary_category).toBe('Auto repair shop');
    const facebook = rctx.platform_observations[1];
    expect(facebook.claimed_status).toBe('unclaimed');
  });

  it('reads bronze_attribution from campaign discovery_context', async () => {
    wireFragmentRows({
      links: [{ campaign_id: 'cmp-1' }],
      campaigns: [{
        discovery_context: {
          bronze_attribution: [
            { reason_key: 'invisible_but_qualified', basis: 'no reviews vector surfaced it' },
          ],
        },
      }],
      audits: [],
    });
    const rctx = await service.getSeedReportContext('seed-1', dims, ctx);
    expect(rctx.discovery_attribution).toEqual([
      { reason_key: 'invisible_but_qualified', basis: 'no reviews vector surfaced it', label: null },
    ]);
  });

  it('resolves business-facing attribution labels from the bronze reason catalog', async () => {
    wireFragmentRows({
      links: [{ campaign_id: 'cmp-1' }],
      campaigns: [{
        discovery_context: {
          bronze_attribution: [
            { reason_key: 'trade_manifest_only', basis: 'customs sweep' },
            { reason_key: 'unknown_reason', basis: null },
          ],
        },
      }],
      audits: [],
      catalog: [{ reason_key: 'trade_manifest_only', label: 'Trade / import-only visibility' }],
    });
    const rctx = await service.getSeedReportContext('seed-1', dims, ctx);
    expect(rctx.discovery_attribution).toEqual([
      { reason_key: 'trade_manifest_only', basis: 'customs sweep', label: 'Trade / import-only visibility' },
      { reason_key: 'unknown_reason', basis: null, label: null },
    ]);
  });

  it('falls back to the prospect-queue snapshot for attribution', async () => {
    wireFragmentRows({
      links: [{ campaign_id: 'cmp-1' }],
      campaigns: [{ discovery_context: null }],
      audits: [],
      queue: [{
        business_snapshot: {
          bronze_attribution: [{ reason_key: 'trade_manifest_only', basis: 'customs sweep' }],
        },
      }],
    });
    const rctx = await service.getSeedReportContext('seed-1', dims, ctx);
    expect(rctx.discovery_attribution[0].reason_key).toBe('trade_manifest_only');
  });

  it('loads category + location enrichment via MarketContextLoader', async () => {
    wireFragmentRows({ enrichment: enrichmentRows });
    const rctx = await service.getSeedReportContext('seed-1', dims, ctx);
    expect(rctx.market_context.category_summary).toContain('trust signals');
    expect(rctx.market_context.category_signals).toEqual([
      'reviews with owner responses',
      'service menu published',
    ]);
    expect(rctx.market_context.market_summary).toContain('Indianapolis');
    expect(rctx.market_context.metro_context).toContain('central-Indiana metro');
    expect(rctx.market_context.notable_areas).toEqual(['Irvington']);
  });

  it('is non-fatal when the audit query throws', async () => {
    mockQueryRaw.mockImplementation((...args: any[]) => {
      const sql = sqlText(args);
      if (sql.includes('FROM directory_seed_campaign_links')) return Promise.resolve([{ campaign_id: 'cmp-1' }]);
      if (sql.includes('FROM mkt_campaigns_list')) return Promise.reject(new Error('db down'));
      return Promise.resolve([]);
    });
    const rctx = await service.getSeedReportContext('seed-1', dims, ctx);
    expect(rctx.campaign_id).toBe('cmp-1');
    expect(rctx.public_narrative).toBeNull();
  });
});

// ─── buildSubstrateEvidence — report_context wiring ─────────────────────

describe('SeedReportEvidenceService.buildSubstrateEvidence — report_context', () => {
  const service = SeedReportEvidenceService.getInstance();
  const marketLoader = MarketContextLoader.getInstance();

  const seedStateRow = {
    id: 'seed-1',
    identity_confidence: 'high',
    category_fit: 'verified',
    category: 'Auto Repair',
    city: 'Indianapolis',
    state: 'IN',
    name_variants: ['Acme Auto'],
    nap_owner_corrected: false,
    nap_verified_at: null,
    owner_verified_at: null,
    owner_verification: null,
    contact_status: 'none',
    outreach_state: 'none',
    status: 'active',
    claimed_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    marketLoader.resetCache();
    mockResolveSignalDivergences.mockResolvedValue([]);
    mockGetSignalRegistryCache.mockReturnValue([]);
    mockQueryRaw.mockImplementation((...args: any[]) => {
      const sql = sqlText(args);
      if (sql.includes('FROM directory_presence_seeds')) return Promise.resolve([seedStateRow]);
      if (sql.includes('FROM directory_field_provenance')) {
        return Promise.resolve([{
          id: 'prov-1',
          field_key: 'business_name',
          value: 'Acme Auto',
          source_name: 'Google',
          source_url: null,
          accessed_at: new Date('2025-01-01'),
          confidence: 'high',
          evidence_state: 'observed',
          notes: null,
          override_by: null,
          override_at: null,
        }]);
      }
      if (sql.includes('FROM directory_seed_campaign_links')) {
        return Promise.resolve([{ campaign_id: 'cmp-1' }]);
      }
      if (sql.includes('FROM mkt_campaigns_list')) return Promise.resolve([{ discovery_context: null }]);
      if (sql.includes('FROM mkt_audits_list')) {
        return Promise.resolve([{
          id: 'audit-cat-1',
          platform: 'category_identification',
          audit_data: {
            public_narrative: 'A neighborhood auto shop.',
            digital_footprint: {
              platforms_found: [{ platform: 'google', url: 'https://maps.example/acme', claimed: true }],
            },
          },
          created_at: new Date('2026-08-15'),
        }]);
      }
      return Promise.resolve([]);
    });
  });

  it('carries audit-derived platform observations into evidence', async () => {
    const result = await service.buildSubstrateEvidence('seed-1', ctx);
    expect(result.evidence.platform_observations).toHaveLength(1);
    expect(result.evidence.platform_observations[0].platform).toBe('google');
    expect(result.evidence.platform_observations[0].claimed_status).toBe('claimed');
  });

  it('attaches the report context for the builder', async () => {
    const result = await service.buildSubstrateEvidence('seed-1', ctx);
    expect(result.report_context?.public_narrative).toBe('A neighborhood auto shop.');
    expect(result.report_context?.audit_ids).toEqual(['audit-cat-1']);
  });
});

// ─── ManualOutreachAnchorService: NAP write-back gate (§20.4) ────────────

describe('ManualOutreachAnchorService verification write-back (§11.6, §20.4)', () => {
  const anchorService = ManualOutreachAnchorService.getInstance();

  const anchorRow = {
    id: 'anchor-1',
    seed_id: 'seed-1',
    campaign_id: null,
    business_prospect_id: null,
    anchor_type: 'address_verification',
    status: 'active',
    title: 'Verify address',
    operator_thesis: 'Confirm the address on file',
    observed_issue: null,
    evidence_summary: null,
    evidence_refs: [],
    verification_question: 'Is 123 Main St still your address?',
    pain_question: null,
    recommended_transition: null,
    expected_verification: 'confirm',
    created_by: 'op-1',
    activated_by: 'op-1',
    created_at: '2025-01-01',
    activated_at: '2025-01-01',
    retired_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw.mockImplementation((...args: any[]) => {
      const sql = sqlText(args);
      if (sql.includes('FROM mkt_outreach_anchors')) return Promise.resolve([anchorRow]);
      if (sql.includes('FROM directory_presence_seeds')) return Promise.resolve([{ tenant_id: 'tnt-1' }]);
      return Promise.resolve([]);
    });
    mockExecuteRaw.mockResolvedValue(1);
  });

  it('writes a NAP verification row for fact_confirmed on a connected call', async () => {
    await anchorService.recordContactWithAnchor(
      {
        anchorId: 'anchor-1',
        seedId: 'seed-1',
        callResult: 'connected',
        verificationResults: [
          { type: 'fact_confirmed', field: 'address', value: '123 Main St' },
        ],
      },
      ctx,
    );

    const napInserts = sqlCallsMatching(mockExecuteRaw, 'INSERT INTO directory_seed_nap_verifications');
    expect(napInserts.length).toBe(1);
    // changed_fields JSON carries { field: { confirmed: value } }
    const changedJson = napInserts[0].find((a: any) => typeof a === 'string' && a.includes('"confirmed"'));
    expect(changedJson).toBeTruthy();
    // owner_corrected is a SQL FALSE literal (not interpolated) — verify no
    // correction flag was applied to the seed
    const flagUpdates = sqlCallsMatching(mockExecuteRaw, 'nap_owner_corrected = TRUE');
    expect(flagUpdates.length).toBe(0);
  });

  it('does NOT write a NAP row for fact_confirmed on a no_answer call (§20.4)', async () => {
    await anchorService.recordContactWithAnchor(
      {
        anchorId: 'anchor-1',
        seedId: 'seed-1',
        callResult: 'no_answer',
        verificationResults: [
          { type: 'fact_confirmed', field: 'address', value: '123 Main St' },
        ],
      },
      ctx,
    );

    const napInserts = sqlCallsMatching(mockExecuteRaw, 'INSERT INTO directory_seed_nap_verifications');
    expect(napInserts.length).toBe(0);
  });

  it('writes an owner_corrected=TRUE NAP row for fact_corrected on a connected call', async () => {
    await anchorService.recordContactWithAnchor(
      {
        anchorId: 'anchor-1',
        seedId: 'seed-1',
        callResult: 'connected',
        verificationResults: [
          {
            type: 'fact_corrected',
            field: 'phone',
            previous_value: '317-555-0100',
            new_value: '317-555-0199',
          },
        ],
      },
      ctx,
    );

    const napInserts = sqlCallsMatching(mockExecuteRaw, 'INSERT INTO directory_seed_nap_verifications');
    expect(napInserts.length).toBe(1);
    // changed_fields JSON carries { field: { previous, corrected } }
    const changedJson = napInserts[0].find((a: any) => typeof a === 'string' && a.includes('"corrected"'));
    expect(changedJson).toBeTruthy();

    // Seed flagged nap_owner_corrected
    const flagUpdates = sqlCallsMatching(mockExecuteRaw, 'nap_owner_corrected = TRUE');
    expect(flagUpdates.length).toBe(1);
  });

  it('writes a canonical seed touch for every contact', async () => {
    await anchorService.recordContactWithAnchor(
      {
        anchorId: 'anchor-1',
        seedId: 'seed-1',
        callResult: 'connected',
        verificationResults: [],
      },
      ctx,
    );

    const touchInserts = sqlCallsMatching(mockExecuteRaw, 'INSERT INTO directory_seed_outreach_touches');
    expect(touchInserts.length).toBe(1);
  });

  it('marks the active anchor as used after contact', async () => {
    await anchorService.recordContactWithAnchor(
      {
        anchorId: 'anchor-1',
        seedId: 'seed-1',
        callResult: 'connected',
        verificationResults: [],
      },
      ctx,
    );

    const usedUpdates = sqlCallsMatching(mockExecuteRaw, "SET status = 'used'");
    expect(usedUpdates.length).toBe(1);
  });

  it('uses the existing campaign outreach-log contract for campaign contacts', async () => {
    await anchorService.recordContactWithAnchor(
      {
        anchorId: 'anchor-1',
        campaignId: 'campaign-1',
        channel: 'phone',
        callResult: 'connected',
        verificationResults: [],
      },
      ctx,
    );

    const logInserts = sqlCallsMatching(mockExecuteRaw, 'INSERT INTO mkt_outreach_log');
    expect(logInserts).toHaveLength(1);
    const sql = sqlText(logInserts[0]);
    expect(sql).toContain('stage_at_time');
    expect(sql).toContain('contact_channel');
    expect(sql).toContain('contact_date');
    expect(sql).toContain('outcome');
    expect(sql).toContain('contacted_by');
    expect(sql).toContain('call_details');
    expect(sql).not.toContain('call_result, verification_results, notes, created_by');
  });
});
