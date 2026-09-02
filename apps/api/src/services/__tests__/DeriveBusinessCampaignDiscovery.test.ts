/**
 * Unit tests for discovery context handoff in MarketingCampaignService
 * (Migration 253 — GAP-E3).
 *
 *   T1 — Handoff with context: child row has discovery_context +
 *        intelligence_run_id; notes contain the "Discovery context" section;
 *        no business_analysis audit seeded (empty detectedSignals); no
 *        auto-triage.
 *   T2 — Legacy call (no discovery input): child identical to today — null
 *        columns, unchanged notes shape; detectedSignals audit-seed +
 *        auto-triage behavior unchanged.
 *   T7 — Invalid-context drop at handoff (the §6 boundary): malformed
 *        context (e.g. focus: 'bogus', non-INT signal code) → context
 *        dropped + warning logged, campaign still created with null
 *        discovery_context, no block at render.
 *
 * Spec: docs/LocalBiz/marketing_ops_discovery_leads_handoff_spec.md §11
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCampaignsList,
  mockStageHistory,
  mockAudits,
  mockCategoryTone,
  mockServiceCategory,
  mockHotProspect,
} = vi.hoisted(() => ({
  mockCampaignsList: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  mockStageHistory: { create: vi.fn() },
  mockAudits: { create: vi.fn(), findFirst: vi.fn() },
  mockCategoryTone: { getPresetByCategory: vi.fn().mockResolvedValue(null) },
  mockServiceCategory: { getLabel: vi.fn().mockResolvedValue(null) },
  mockHotProspect: { evaluatePainScoreFallback: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_stage_history_list: mockStageHistory,
    mkt_audits_list: mockAudits,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateCampaignId: () => 'mkt-child-001',
  generateStageHistoryId: () => 'msh-001',
  generateMarketingAuditId: () => 'maud-001',
}));

vi.mock('../MarketingCategoryToneService', () => ({
  default: mockCategoryTone,
}));

vi.mock('../MarketingServiceCategoryService', () => ({
  default: mockServiceCategory,
}));

vi.mock('../CampaignTriageService', () => ({
  default: {
    evaluateTriageForCampaign: vi.fn().mockResolvedValue({
      recommendedPlaybook: { code: 'PB-01' },
    }),
  },
}));

vi.mock('../MarketingHotProspectService', () => ({
  MarketingHotProspectService: {
    getInstance: () => mockHotProspect,
  },
}));

import MarketingCampaignService from '../MarketingCampaignService';

describe('deriveBusinessCampaign — discovery context handoff (Migration 253 — GAP-E3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default parent campaign for deriveBusinessCampaign
    mockCampaignsList.findUnique.mockImplementation(async ({ where }: any) => ({
      id: where.id,
      display_id: 'MKT-PARENT-001',
      scope: 'category',
      category: 'Auto Repair',
      city: 'Pittsburgh',
      state: 'PA',
      neighborhood: null,
      tone: null,
      attributes: [],
      mkt_audits_list: [],
    }));
    // Default create returns the child row echoing the input data
    mockCampaignsList.create.mockImplementation(async ({ data }: any) => ({
      id: data.id,
      ...data,
    }));
    mockStageHistory.create.mockResolvedValue({});
  });

  const sampleDiscoveryContext = {
    focus: 'emerging' as const,
    discovered_at: '2026-09-01T12:00:00Z',
    business_seek_priority: 'high' as const,
    category_fit: 'verified' as const,
    identity_confidence: 'high' as const,
    location_status: 'inside_city',
    seek_batch_id: 'msb_abc',
    discovery_signals: ['INT_HIDDEN_TRUST', 'INT_POSSIBLE_CATEGORY_MISALIGNMENT'],
    discovery_provenance: [
      { source: 'Somali Community Directory', role: 'primary', evidence_types: ['listing', 'hours'] },
    ],
  };

  // ─── T1: Handoff with context ─────────────────────────────────────────

  it('T1: child row has discovery_context + intelligence_run_id; notes contain "Discovery context" section; no audit seeded; no auto-triage', async () => {
    const child = await MarketingCampaignService.deriveBusinessCampaign({
      parentId: 'parent-1',
      businessName: 'African Grocery Store',
      discoveryContext: sampleDiscoveryContext,
      intelligenceRunId: 'mir_run_001',
    });

    // Child row persisted with discovery context + run id
    expect(mockCampaignsList.create).toHaveBeenCalledTimes(1);
    const createCall = mockCampaignsList.create.mock.calls[0][0];
    expect(createCall.data.discovery_context).toEqual(sampleDiscoveryContext);
    expect(createCall.data.intelligence_run_id).toBe('mir_run_001');

    // Notes contain the human-readable "Discovery context" section
    expect(child.notes).toContain('Discovery context (intelligence run mir_run_001, discovered 2026-09-01):');
    expect(child.notes).toContain('Seek priority: high');
    expect(child.notes).toContain('Category fit: verified');
    expect(child.notes).toContain('Identity confidence: high');
    expect(child.notes).toContain('Signals: Strong Hidden Trust, Possible Category Misalignment');
    expect(child.notes).toContain('Sources: Somali Community Directory (primary)');

    // No business_analysis audit seeded (detectedSignals is empty for
    // intelligence entries — INT codes live in discovery_signals, not
    // detected_signals)
    expect(mockAudits.create).not.toHaveBeenCalled();

    // No auto-triage (the detectedSignals audit-seed branch is unchanged —
    // it only fires when detectedSignals is non-empty)
    // CampaignTriageService.evaluateTriageForCampaign is the auto-triage
    // call; verify it was NOT called
    const { default: CampaignTriageService } = await import('../CampaignTriageService');
    expect(CampaignTriageService.evaluateTriageForCampaign).not.toHaveBeenCalled();
  });

  // ─── T2: Legacy call (no discovery input) ─────────────────────────────

  it('T2: legacy call (no discovery input) → null columns, unchanged notes shape, detectedSignals audit-seed + auto-triage unchanged', async () => {
    const child = await MarketingCampaignService.deriveBusinessCampaign({
      parentId: 'parent-1',
      businessName: 'Legacy Biz',
      detectedSignals: ['RA_REVIEW_DROUGHT', 'DS_CLAIMED_STATUS'],
    });

    // Child row persisted with null discovery columns
    const createCall = mockCampaignsList.create.mock.calls[0][0];
    expect(createCall.data.discovery_context).toBeNull();
    expect(createCall.data.intelligence_run_id).toBeNull();

    // Notes do NOT contain the "Discovery context" section
    expect(child.notes).not.toContain('Discovery context');
    // Notes DO contain the legacy shape (derived from parent + detected signals)
    expect(child.notes).toContain('Derived from parent campaign');
    expect(child.notes).toContain('Detected signals: RA_REVIEW_DROUGHT, DS_CLAIMED_STATUS');

    // detectedSignals audit-seed fires (non-empty detectedSignals)
    expect(mockAudits.create).toHaveBeenCalledTimes(1);
    const auditCall = mockAudits.create.mock.calls[0][0];
    expect(auditCall.data.platform).toBe('business_analysis');
    expect(auditCall.data.audit_data.detected_signals).toEqual(['RA_REVIEW_DROUGHT', 'DS_CLAIMED_STATUS']);

    // Auto-triage fires
    const { default: CampaignTriageService } = await import('../CampaignTriageService');
    expect(CampaignTriageService.evaluateTriageForCampaign).toHaveBeenCalledTimes(1);
  });

  // ─── T7: Invalid-context drop at handoff ──────────────────────────────
  // This tests the §6 validation boundary: malformed context → dropped +
  // logged, campaign still created with null discovery_context.
  // The drop happens in createCampaignFromQueue (which calls
  // validateDiscoveryContext), but we also verify deriveBusinessCampaign
  // itself is resilient — it accepts whatever context is passed and
  // persists it; the validation boundary is upstream. Here we test the
  // validateDiscoveryContext helper directly + the end-to-end behavior.

  it('T7: validateDiscoveryContext drops malformed context (focus: "bogus")', async () => {
    const { validateDiscoveryContext } = await import('../../validators/intelligence-discovery.schema');

    // focus: 'bogus' is not in ['emerging', 'competitive'] → invalid
    const result = validateDiscoveryContext({
      ...sampleDiscoveryContext,
      focus: 'bogus' as any,
    });
    expect(result).toBeNull();
  });

  it('T7: validateDiscoveryContext drops malformed context (non-INT signal code)', async () => {
    const { validateDiscoveryContext } = await import('../../validators/intelligence-discovery.schema');

    // RA_REVIEW_DROUGHT is not an INT_* code → fails the /^INT_/ regex
    const result = validateDiscoveryContext({
      ...sampleDiscoveryContext,
      discovery_signals: ['RA_REVIEW_DROUGHT'],
    });
    expect(result).toBeNull();
  });

  it('T7: validateDiscoveryContext drops empty context (no signals, no provenance, no meta)', async () => {
    const { validateDiscoveryContext } = await import('../../validators/intelligence-discovery.schema');

    const result = validateDiscoveryContext({
      focus: 'emerging',
      discovered_at: '2026-09-01',
    });
    expect(result).toBeNull();
  });

  it('T7: validateDiscoveryContext accepts valid context', async () => {
    const { validateDiscoveryContext } = await import('../../validators/intelligence-discovery.schema');

    const result = validateDiscoveryContext(sampleDiscoveryContext);
    expect(result).not.toBeNull();
    expect(result?.focus).toBe('emerging');
    expect(result?.discovery_signals).toEqual(['INT_HIDDEN_TRUST', 'INT_POSSIBLE_CATEGORY_MISALIGNMENT']);
  });

  it('T7: deriveBusinessCampaign with null discoveryContext → null columns (no crash)', async () => {
    // Even if the upstream validation drops context and passes null,
    // deriveBusinessCampaign must still create the campaign successfully.
    const child = await MarketingCampaignService.deriveBusinessCampaign({
      parentId: 'parent-1',
      businessName: 'Dropped Context Biz',
      discoveryContext: null,
      intelligenceRunId: undefined,
    });

    const createCall = mockCampaignsList.create.mock.calls[0][0];
    expect(createCall.data.discovery_context).toBeNull();
    expect(createCall.data.intelligence_run_id).toBeNull();
    expect(child.notes).not.toContain('Discovery context');
  });
});
