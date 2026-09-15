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
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockSignalRegistryFindMany: vi.fn(),
  mockGetSignalRegistryCache: vi.fn(),
  mockSetSignalRegistryCache: vi.fn(),
  mockAudit: vi.fn(),
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

vi.mock('../../lib/id-generator', () => ({
  generateManualOutreachAnchorId: vi.fn(() => 'anchor-test'),
}));

import { SeedReportEvidenceService } from '../intelligence/SeedReportEvidenceService';
import { ManualOutreachAnchorService } from '../intelligence/ManualOutreachAnchorService';

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
});
