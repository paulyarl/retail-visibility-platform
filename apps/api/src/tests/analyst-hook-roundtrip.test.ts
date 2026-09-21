/**
 * Analyst hook round-trip (PHYSICAL_RETAIL_PLAYBOOK_ALIGNMENT_SPRINT_PLAN
 * Phase 5.11) — external lane.
 *
 * Pins the end-to-end contract for the analyst-emitted opener hook:
 *
 *   importExternalResult (external agent JSON)
 *     → schema validation accepts alignment_scoring.primary_outreach_hook
 *     → mkt_audits_list.audit_data retains the hook verbatim
 *     → execution stamped source='external' (ai_provider='external')
 *     → ManualOutreachScriptService merge context resolves {{analyst_hook}}
 *       from the persisted audit row (tier-3 fallback)
 *
 * The unit tests in ManualPlayTemplateAuthoring.test.ts cover the triage /
 * per-issue briefing tiers with mocked finders; this test proves the raw
 * audit_data written by the external import is consumable by the merge
 * resolver unchanged.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockTx,
  mockPrisma,
  mockGetCampaign,
  mockGetTriageResult,
  mockGetForCampaign,
  mockGetClaimKitMeta,
  mockGetReportKitMeta,
  mockExecFindMany,
  mockAuditFindFirst,
} = vi.hoisted(() => {
  const mockTx = {
    mkt_prompt_executions_list: { create: vi.fn(async ({ data }: any) => ({ ...data })) },
    mkt_audits_list: { create: vi.fn(async ({ data }: any) => ({ ...data })) },
  };
  const mockExecFindMany = vi.fn();
  const mockAuditFindFirst = vi.fn();
  return {
    mockTx,
    mockExecFindMany,
    mockAuditFindFirst,
    mockPrisma: {
      $transaction: vi.fn(async (fn: any) => fn(mockTx)),
      $queryRawUnsafe: vi.fn(async () => []),
      $executeRawUnsafe: vi.fn(async () => 0),
      $queryRaw: vi.fn(async () => []),
      mkt_campaigns_list: { findUnique: vi.fn(async () => null) },
      mkt_intelligence_profiles: { findFirst: vi.fn(async () => null) },
      mkt_prompt_executions_list: { findMany: mockExecFindMany },
      mkt_audits_list: { findFirst: mockAuditFindFirst },
      users: { findUnique: vi.fn(async () => null) },
    },
    mockGetCampaign: vi.fn(),
    mockGetTriageResult: vi.fn(async () => null),
    mockGetForCampaign: vi.fn(async () => { throw new Error('no worksheet'); }),
    mockGetClaimKitMeta: vi.fn(async () => null),
    mockGetReportKitMeta: vi.fn(async () => null),
  };
});

vi.mock('../prisma', () => ({ prisma: mockPrisma }));
vi.mock('../logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../audit', () => ({ audit: vi.fn() }));
vi.mock('../config/unifiedConfig', () => ({
  unifiedConfig: {
    frontendUrl: 'https://app.test',
    webUrl: '',
    marketingOpsHotProspectAutoSyncOnImport: false,
  },
}));
vi.mock('../middleware/errorHandler', () => ({
  HttpError: class HttpError extends Error {},
  NotFoundError: class NotFoundError extends Error {
    constructor(msg: string) { super(msg); this.name = 'NotFoundError'; }
  },
  ConflictError: class ConflictError extends Error {
    constructor(msg: string) { super(msg); this.name = 'ConflictError'; }
  },
  ValidationError: class ValidationError extends Error {
    constructor(msg: string) { super(msg); this.name = 'ValidationError'; }
  },
}));
vi.mock('../lib/id-generator', () => ({
  generatePromptTemplateId: () => 'mpt-test001',
  generatePromptExecutionId: () => 'mpx-test001',
  generateFilterFlagId: () => 'mff-test001',
  generateMarketingAuditId: () => 'maudit-test001',
  generateManualScriptId: () => 'mms-test001',
  generateManualPlayTemplateId: () => 'mptpl-test001',
}));
vi.mock('../services/MarketingCampaignService', () => ({
  default: { getCampaign: mockGetCampaign },
}));
vi.mock('../services/CampaignTriageService', () => ({
  default: { getTriageResult: mockGetTriageResult },
}));
vi.mock('../services/OutreachIntelligenceService', () => ({
  default: { getForCampaign: mockGetForCampaign },
  resolveSalutation: () => 'Hi there,',
}));
vi.mock('../services/ClaimInviteQrKitService', () => ({
  getClaimInviteKitMeta: mockGetClaimKitMeta,
}));
vi.mock('../services/intelligence/SeedReportDeliveryService', () => ({
  default: { getReportKitMeta: mockGetReportKitMeta },
}));
vi.mock('../services/intelligence/IntelligenceProfileService', () => ({
  IntelligenceProfileService: {
    getInstance: () => ({
      resolveSignalWeightMapForCampaign: vi.fn(async () => undefined),
      resolveSignalWeightsForCampaign: vi.fn(async () => ({})),
    }),
  },
  rankPlatformPriorities: () => [],
  signalPlatformDisplayName: (p: string) => p,
  normalizeSignalPlatformKey: (s: string) => s.trim().toLowerCase(),
  normalizeCategoryKey: (s: string) => s.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' '),
  normalizeReferenceCity: (s: string | null | undefined) => (s ? s.trim() : null),
  normalizeReferenceState: (s: string | null | undefined) => (s ? s.trim().toUpperCase() : null),
  normalizePlatformScope: (s: string | null | undefined) => (s ? s.trim().toLowerCase() || null : null),
}));

import { MarketingPromptService } from '../services/MarketingPromptService';
import ManualOutreachScriptService from '../services/ManualOutreachScriptService';

// ─── Fixtures ────────────────────────────────────────────────────────────

const HOOK =
  'When customers nearby search for berbere and injera, Google sends them ' +
  'to the supermarket across town — your shelves are invisible.';

const BA_TEMPLATE = {
  id: 'mpt-6oeuiizo',
  name: 'Business Digital Audit - Alignment Scoring (Signal-Aligned)',
  version: 12,
  body: 'Audit {{business_name}}',
  prompt_type: 'seek',
  scope: 'business',
  output_schema: { name: 'business_analysis' },
};

const CAMPAIGN = {
  id: 'mcamp-rt01',
  scope: 'business',
  business_name: 'Arsema Food Mart',
  city: 'Indianapolis',
  service_category: 'African Grocery Stores',
  assigned_to: 'Alex Operator',
  address_line1: '100 Main St',
  address_city: 'Indianapolis',
  address_state: 'IN',
  repair_triage_briefing: null,
};

/** Minimal business_analysis payload carrying the analyst hook. */
const AUDIT_PAYLOAD = {
  audit_metadata: {
    audit_date: '2026-09-21',
    requested_business: {
      business_name: 'Arsema Food Mart',
      city: 'Indianapolis',
      state: 'IN',
      category: 'African Grocery Store',
    },
    identity_status: 'confirmed',
    identity_confidence: 'high',
  },
  summary:
    'Physical African grocery storefront is indexed on Google but the ' +
    'inventory is invisible — no product browsing, no stock-check path.',
  business_type: 'product',
  platforms: {
    google: {
      profile_status: 'unclaimed',
      rating: 4.6,
      total_reviews: 41,
      reviews_with_observable_response: 0,
      observable_unanswered_reviews: 0,
      observable_unanswered_negative_reviews: 0,
      observable_unanswered_positive_reviews: 0,
      observable_response_rate_percent: null,
    },
  },
  website: {
    status: 'none_found',
    has_product_browsing: false,
    has_availability_inquiry: false,
  },
  nap_consistency: { overall_status: 'consistent' },
  digital_opportunity_score: { score: 62 },
  high_attention: true,
  data_quality: { confidence: 'medium' },
  detected_signals: ['DS_MISSING_PRODUCT_CATALOG', 'WC_MISSING_AVAILABILITY_INQUIRY'],
  alignment_scoring: {
    lead_disposition: 'HIGH_PRIORITY_OUTREACH',
    primary_outreach_hook: HOOK,
  },
};

// ─── Tests ───────────────────────────────────────────────────────────────

describe('analyst hook round-trip — external import → audit → {{analyst_hook}}', () => {
  let promptService: MarketingPromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    promptService = MarketingPromptService.getInstance();
    vi.spyOn(promptService, 'getTemplate').mockResolvedValue(BA_TEMPLATE as any);
    mockGetCampaign.mockResolvedValue({ ...CAMPAIGN });
    mockExecFindMany.mockResolvedValue([]);
    mockAuditFindFirst.mockResolvedValue(null);
  });

  it('accepts a business_analysis payload carrying primary_outreach_hook and persists it verbatim', async () => {
    const result = await promptService.importExternalResult({
      campaignId: CAMPAIGN.id,
      templateId: BA_TEMPLATE.id,
      rawOutput: JSON.stringify(AUDIT_PAYLOAD),
      source: 'external',
      metadata: { provider: 'claude', model: 'opus-4', run_id: 'ext-run-1' },
    });

    // Execution row: completed + external provenance.
    const execData = mockTx.mkt_prompt_executions_list.create.mock.calls[0][0].data;
    expect(execData.status).toBe('completed');
    expect(execData.ai_provider).toBe('external');
    expect(execData.template_id).toBe(BA_TEMPLATE.id);

    // Audit row: platform + raw audit_data retains the hook untouched.
    expect(result.audit).not.toBeNull();
    const auditData = mockTx.mkt_audits_list.create.mock.calls[0][0].data;
    expect(auditData.platform).toBe('business_analysis');
    expect(auditData.audit_data.alignment_scoring.primary_outreach_hook).toBe(HOOK);
    expect(auditData.import_metadata.provider).toBe('claude');
  });

  it('resolves {{analyst_hook}} from the persisted audit row (tier-3 fallback)', async () => {
    const result = await promptService.importExternalResult({
      campaignId: CAMPAIGN.id,
      templateId: BA_TEMPLATE.id,
      rawOutput: JSON.stringify(AUDIT_PAYLOAD),
    });

    // Feed the persisted audit_data back through the merge-context resolver —
    // this is the same row shape mkt_audits_list.findFirst returns at read time.
    mockAuditFindFirst.mockResolvedValue({
      audit_data: result.audit.audit_data,
    });

    const ctx = await ManualOutreachScriptService.mergeContextForCampaign(CAMPAIGN.id);
    expect(ctx.analyst_hook).toBe(HOOK);
  });

  it('resolves {{analyst_hook}} from an imported briefing execution (tier-2)', async () => {
    mockExecFindMany.mockResolvedValue([
      {
        raw_output: JSON.stringify({
          profile_repair_audit: { pitch: { opener_hook: 'briefing hook from external analyst' } },
        }),
      },
    ]);

    const ctx = await ManualOutreachScriptService.mergeContextForCampaign(CAMPAIGN.id);
    expect(ctx.analyst_hook).toBe('briefing hook from external analyst');
  });

  it('leaves {{analyst_hook}} unresolved when the audit emits null (no fabricated pitch)', async () => {
    const noHookPayload = {
      ...AUDIT_PAYLOAD,
      high_attention: false,
      alignment_scoring: {
        action_classification: 'BALANCED_HEALTHY',
        lead_disposition: 'STANDARD_OUTREACH',
        primary_outreach_hook: null,
      },
    };

    const result = await promptService.importExternalResult({
      campaignId: CAMPAIGN.id,
      templateId: BA_TEMPLATE.id,
      rawOutput: JSON.stringify(noHookPayload),
    });

    mockAuditFindFirst.mockResolvedValue({ audit_data: result.audit.audit_data });
    const ctx = await ManualOutreachScriptService.mergeContextForCampaign(CAMPAIGN.id);
    expect(ctx.analyst_hook).toBeUndefined();
  });
});
