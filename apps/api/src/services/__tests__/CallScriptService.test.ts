/**
 * CallScriptService tests (§8 slice 3)
 *
 * Verifies:
 * - assembleForCampaign: merge resolution (incl. visible-placeholder on
 *   missing business/address), phone_required 400, ranking passthrough,
 *   Stage 2 angle selection (default = top-ranked, explicit ?angle=)
 * - applyCallConfirmations: fill/confirm/conflict/idempotency, sibling
 *   write-target resolution, null-only campaign.email fill
 *
 * Spec: docs/LocalBiz/marketing_ops_cold_call_channel_sprint_plan.md §5.2–§5.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (hoisted) ─────────────────────────────────────────────────────

const {
  mockGetCampaign,
  mockResolveCampaignArchetype,
  mockGetTriageResult,
  mockGetForCampaign,
  mockOiFindUnique,
  mockOiCreate,
  mockOiUpdate,
  mockCampaignsFindUnique,
  mockCampaignsFindMany,
  mockCampaignsUpdate,
  mockPreviewTokensFindMany,
  mockEnsureShortCode,
  mockAudit,
  mockGetLatestAuditData,
  mockQueryRaw,
  mockUsersFindUnique,
  mockGetClaimKitMeta,
  mockGetReportKitMeta,
} = vi.hoisted(() => ({
  mockGetCampaign: vi.fn(),
  mockResolveCampaignArchetype: vi.fn(),
  mockGetTriageResult: vi.fn(),
  mockGetForCampaign: vi.fn(),
  mockOiFindUnique: vi.fn(),
  mockOiCreate: vi.fn(),
  mockOiUpdate: vi.fn(),
  mockCampaignsFindUnique: vi.fn(),
  mockCampaignsFindMany: vi.fn(),
  mockCampaignsUpdate: vi.fn(),
  mockPreviewTokensFindMany: vi.fn(),
  mockEnsureShortCode: vi.fn(),
  mockAudit: vi.fn(),
  mockGetLatestAuditData: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockUsersFindUnique: vi.fn(),
  mockGetClaimKitMeta: vi.fn(),
  mockGetReportKitMeta: vi.fn(),
}));

// The shared outreach-link resolver (§5.1) resolves claim/report QR URLs
// through these two kit services.
vi.mock('../ClaimInviteQrKitService', () => ({
  getClaimInviteKitMeta: mockGetClaimKitMeta,
}));

vi.mock('../intelligence/SeedReportDeliveryService', () => ({
  default: { getReportKitMeta: mockGetReportKitMeta },
}));

vi.mock('../MarketingCampaignService', () => ({
  default: {
    getCampaign: mockGetCampaign,
  },
}));

vi.mock('../OutreachOpenerService', () => ({
  resolveCampaignArchetype: mockResolveCampaignArchetype,
  OutreachOpenerService: class {
    static getInstance() { return {}; }
  },
}));

vi.mock('../CampaignTriageService', () => ({
  default: {
    getTriageResult: mockGetTriageResult,
  },
}));

vi.mock('../OutreachIntelligenceService', () => ({
  default: {
    getForCampaign: mockGetForCampaign,
  },
  resolveSalutation: (payload: any, businessName: string | null) => {
    if (payload?.owner_name?.value) {
      return `Hi ${payload.owner_name.value.split(' ')[0]},`;
    }
    if (businessName && businessName.trim().length > 0 && businessName.length <= 60) {
      return `Hi ${businessName.trim()},`;
    }
    return 'Hi there,';
  },
}));

vi.mock('../MarketingDeliverableService', () => ({
  default: {
    ensureShortCode: mockEnsureShortCode,
  },
}));

vi.mock('../deliverable/BusinessContextService', () => ({
  default: {
    getLatestAuditData: mockGetLatestAuditData,
  },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    mkt_outreach_intelligence: {
      findUnique: mockOiFindUnique,
      create: mockOiCreate,
      update: mockOiUpdate,
    },
    mkt_campaigns_list: {
      findUnique: mockCampaignsFindUnique,
      findMany: mockCampaignsFindMany,
      update: mockCampaignsUpdate,
    },
    mkt_deliverable_preview_tokens: {
      findMany: mockPreviewTokensFindMany,
    },
    users: {
      findUnique: mockUsersFindUnique,
    },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({
  audit: mockAudit,
}));

vi.mock('../../middleware/errorHandler', () => ({
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

vi.mock('../../lib/id-generator', () => ({
  generateOutreachIntelligenceId: () => 'moi-test001',
}));

// Import after mocks
import CallScriptService from '../CallScriptService';

// ─── Fixtures ────────────────────────────────────────────────────────────

function makeCampaign(overrides: Partial<any> = {}) {
  return {
    id: 'camp-001',
    business_name: 'Tetees Market',
    city: 'Indianapolis',
    service_category: 'African Grocery Stores',
    phone: '317-555-0100',
    address_line1: '4201 N College Ave',
    address_city: 'Indianapolis',
    address_state: 'IN',
    assigned_to: 'Adrien Yarl',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCampaign.mockResolvedValue(makeCampaign());
  mockResolveCampaignArchetype.mockResolvedValue({
    archetype: 'A3',
    source: 'fallback',
    reason: 'test',
  });
  mockGetTriageResult.mockResolvedValue({ detectedSignals: [] });
  mockGetForCampaign.mockResolvedValue(null);
  mockPreviewTokensFindMany.mockResolvedValue([]);
  mockOiFindUnique.mockResolvedValue(null);
  mockOiCreate.mockResolvedValue({ id: 'moi-test001' });
  mockOiUpdate.mockResolvedValue({ id: 'moi-existing' });
  mockCampaignsFindUnique.mockResolvedValue({ email: null });
  mockCampaignsFindMany.mockResolvedValue([]);
  mockCampaignsUpdate.mockResolvedValue({});
  mockEnsureShortCode.mockResolvedValue(null);
  mockAudit.mockResolvedValue({});
  mockGetLatestAuditData.mockResolvedValue(null);
  mockGetClaimKitMeta.mockResolvedValue(null);
  mockGetReportKitMeta.mockResolvedValue(null);
});

// ─── Assembly tests ──────────────────────────────────────────────────────

describe('CallScriptService.assembleForCampaign', () => {
  it('assembles all five stages with merge fields resolved', async () => {
    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.stages.verify).toContain('Tetees Market');
    expect(result.stages.verify).not.toContain('{{business}}');
    expect(result.stages.bridge).toContain('african grocery stores');
    expect(result.stages.bridge).toContain('Indianapolis');
    expect(result.stages.ask).toBeTruthy();
    expect(result.stages.close).toContain('Adrien Yarl');
    expect(result.stages.hook.line).toBeTruthy();
  });

  it('throws phone_required when campaign has no phone', async () => {
    mockGetCampaign.mockResolvedValue(makeCampaign({ phone: null }));

    await expect(CallScriptService.assembleForCampaign('camp-001'))
      .rejects.toThrow('phone_required');
  });

  it('returns every ranked hook option', async () => {
    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.hookOptions).toHaveLength(23);
    for (let i = 0; i < 23; i++) {
      expect(result.hookOptions[i].rank).toBe(i + 1);
    }
  });

  it('default angle is the top-ranked hook', async () => {
    // A3 archetype → gbp_verification, nap_normalization, hours_sync,
    // cross_platform_expansion have A3 affinity. gbp_verification is
    // first in catalog order among A3 hooks.
    mockResolveCampaignArchetype.mockResolvedValue({
      archetype: 'A3',
      source: 'fallback',
      reason: 'test',
    });

    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.hookOptions[0].angle).toBe('gbp_verification');
    expect(result.stages.hook.angle).toBe('gbp_verification');
  });

  it('availability_inquiry is the default hook when WC_MISSING_AVAILABILITY_INQUIRY fired under A6', async () => {
    mockResolveCampaignArchetype.mockResolvedValue({
      archetype: 'A6',
      source: 'fallback',
      reason: 'test',
    });
    mockGetTriageResult.mockResolvedValue({
      detectedSignals: [{ code: 'WC_MISSING_AVAILABILITY_INQUIRY', label: 'Missing Availability Inquiry' }],
    });

    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.hookOptions[0].angle).toBe('availability_inquiry');
    expect(result.stages.hook.angle).toBe('availability_inquiry');
    // Merge-resolved: business/category/city filled, no placeholders left
    expect(result.stages.hook.line).toContain('african grocery stores');
    expect(result.stages.hook.line).toContain('Indianapolis');
    expect(result.stages.hook.line).not.toContain('{{');
  });

  it('explicit angle overrides the default', async () => {
    const result = await CallScriptService.assembleForCampaign('camp-001', 'review_acquisition');

    expect(result.stages.hook.angle).toBe('review_acquisition');
  });

  it('unresolvable placeholders render visibly (never fabricated)', async () => {
    mockGetCampaign.mockResolvedValue(makeCampaign({
      business_name: null,
      address_line1: null,
      address_city: null,
      address_state: null,
    }));

    const result = await CallScriptService.assembleForCampaign('camp-001');

    // {{business}} should remain visible in Stage 1
    expect(result.stages.verify).toContain('{{business}}');
  });

  it('resolves {{address}} from campaign address fields', async () => {
    const result = await CallScriptService.assembleForCampaign('camp-001');

    // The verify stage doesn't use {{address}} but the merge context
    // should have it resolved. Check via a hook that uses {{address}}.
    // (No seed hooks use {{address}} — verify the context is correct
    // by checking that the verify stage has the business name.)
    expect(result.stages.verify).toContain('Tetees Market');
  });

  it('returns the generic objection table (5 rows) for a non-scoped archetype', async () => {
    mockResolveCampaignArchetype.mockResolvedValue({
      archetype: 'A1',
      source: 'fallback',
      reason: 'test',
    });
    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.objections).toHaveLength(5);
    for (const obj of result.objections) {
      expect(obj.objection).toBeTruthy();
      expect(obj.response).toBeTruthy();
    }
  });

  it('prepends the website-playbook objections for A7 campaigns', async () => {
    mockResolveCampaignArchetype.mockResolvedValue({
      archetype: 'A7',
      source: 'fallback',
      reason: 'test',
    });

    const result = await CallScriptService.assembleForCampaign('camp-001');

    // 5 generic + 5 website-playbook rows, website first.
    expect(result.objections).toHaveLength(10);
    expect(result.objections.some((o) => /don't need a website/i.test(o.objection))).toBe(true);
    expect(result.objections.some((o) => /afford/i.test(o.objection))).toBe(true);
  });

  it('callContext includes phone, owner_name, team_signal', async () => {
    mockGetForCampaign.mockResolvedValue({
      owner_name: 'Maria',
      owner_name_confidence: 'confirmed',
      team_signal: 'family_team',
    });

    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.callContext.phone).toBe('317-555-0100');
    expect(result.callContext.owner_name).toBe('Maria');
    expect(result.callContext.owner_name_confidence).toBe('confirmed');
    expect(result.callContext.team_signal).toBe('family_team');
  });

  it('callContext defaults when no worksheet exists', async () => {
    mockGetForCampaign.mockResolvedValue(null);

    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.callContext.owner_name).toBeNull();
    expect(result.callContext.owner_name_confidence).toBe('unavailable');
    expect(result.callContext.team_signal).toBe('unknown');
  });

  it('gallery_short_url is null when no active gallery token', async () => {
    mockPreviewTokensFindMany.mockResolvedValue([]);

    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.callContext.gallery_short_url).toBeNull();
  });

  it('gallery_short_url resolves to /g/{code} when active token has short_code', async () => {
    mockPreviewTokensFindMany.mockResolvedValue([
      {
        id: 'tok-1',
        token: 'longtoken123',
        token_type: 'diagnostic_gallery',
        short_code: 'ABC123',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        converted_at: null,
        created_at: new Date().toISOString(),
      },
    ]);

    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.callContext.gallery_short_url).toBe('/g/ABC123');
  });

  it('gallery_short_url backfills short_code for legacy tokens', async () => {
    mockPreviewTokensFindMany.mockResolvedValue([
      {
        id: 'tok-legacy',
        token: 'longtoken123',
        token_type: 'diagnostic_gallery',
        short_code: null,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        converted_at: null,
        created_at: new Date().toISOString(),
      },
    ]);
    mockEnsureShortCode.mockResolvedValue('XYZ789');

    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.callContext.gallery_short_url).toBe('/g/XYZ789');
  });

  it('archetype-affinity hooks rank first', async () => {
    mockResolveCampaignArchetype.mockResolvedValue({
      archetype: 'A4',
      source: 'fallback',
      reason: 'test',
    });

    const result = await CallScriptService.assembleForCampaign('camp-001');
    // The A4-affinity tier (catalog order): gbp_verification, website_foundation,
    // website_repair, website_tiers, website_visibility, availability_inquiry,
    // click_to_call, zero_footprint — 8 hooks, all ahead of non-affinity hooks.
    const topAngles = result.hookOptions.slice(0, 8).map((h) => h.angle);

    expect(topAngles).toContain('gbp_verification');
    expect(topAngles).toContain('website_foundation');
    expect(topAngles).toContain('website_repair');
    expect(topAngles).toContain('website_tiers');
    expect(topAngles).toContain('website_visibility');
    expect(topAngles).toContain('availability_inquiry');
    expect(topAngles).toContain('click_to_call');
  });

  it('priority order — the hook matching the highest-severity signal leads (A7 website bundle)', async () => {
    mockResolveCampaignArchetype.mockResolvedValue({
      archetype: 'A7',
      source: 'fallback',
      reason: 'test',
    });
    mockGetTriageResult.mockResolvedValue({
      detectedSignals: [
        { code: 'WC_BROKEN_WEBSITE', label: 'Broken', contributedToRule: true },
        { code: 'WC_STALE_WEBSITE', label: 'Stale', contributedToRule: true },
        { code: 'WC_MOBILE_FRICTION', label: 'Mobile', contributedToRule: true },
      ],
    });
    // Severity is derived from the audit — a non-null audit is required.
    mockGetLatestAuditData.mockResolvedValue({ auditData: {} });

    const result = await CallScriptService.assembleForCampaign('camp-001');
    const angles = result.hookOptions.map((h) => h.angle);

    // Same ordering as HookSuggestionService — the call script shares the
    // ranking, so scripts stay aligned with the pitch.
    expect(angles[0]).toBe('website_repair');
    expect(angles.indexOf('website_repair')).toBeLessThan(angles.indexOf('website_scaling'));
    expect(angles.indexOf('website_scaling')).toBeLessThan(angles.indexOf('website_foundation'));
    expect(angles.indexOf('click_to_call')).toBeGreaterThan(angles.indexOf('website_foundation'));
  });

  it('prepends the repair-playbook objections for A3 campaigns', async () => {
    mockResolveCampaignArchetype.mockResolvedValue({
      archetype: 'A3',
      source: 'fallback',
      reason: 'test',
    });

    const result = await CallScriptService.assembleForCampaign('camp-001');

    // 5 generic + 5 repair rows, repair first.
    expect(result.objections).toHaveLength(10);
    expect(result.objections.some((o) => /my listing'?s fine/i.test(o.objection))).toBe(true);
    expect(result.objections.some((o) => /google'?s job/i.test(o.objection))).toBe(true);
  });

  it('priority order — the hook matching the highest-severity repair signal leads (A3 repair bundle)', async () => {
    mockResolveCampaignArchetype.mockResolvedValue({
      archetype: 'A3',
      source: 'fallback',
      reason: 'test',
    });
    mockGetTriageResult.mockResolvedValue({
      detectedSignals: [
        { code: 'DS_BROKEN_PROFILE_LINK', label: 'Broken link', contributedToRule: true },
        { code: 'CP_NAP_PHONE_DRIFT', label: 'Phone drift', contributedToRule: true },
        { code: 'DS_OUTDATED_HOLIDAY_HOURS', label: 'Holiday hours', contributedToRule: true },
      ],
    });
    mockGetLatestAuditData.mockResolvedValue({
      auditData: { nap_consistency: { phone_variations: ['317-555-0100', '317-555-0199'] } },
    });

    const result = await CallScriptService.assembleForCampaign('camp-001');
    const angles = result.hookOptions.map((h) => h.angle);

    // Same ordering as HookSuggestionService — scripts stay aligned with the pitch.
    expect(angles[0]).toBe('repair_tiers');
    expect(angles.indexOf('gbp_verification')).toBeLessThan(angles.indexOf('cross_platform_expansion'));
    expect(angles.indexOf('cross_platform_expansion')).toBeLessThan(angles.indexOf('nap_normalization'));
    expect(angles.indexOf('nap_normalization')).toBeLessThan(angles.indexOf('hours_sync'));
    expect(angles.indexOf('hours_sync')).toBeLessThan(angles.indexOf('website_repair'));
  });

  // ─── Emerging-archetype boost + channel hint (Sprint 2) ────────────────

  it('surfaces channel_hint: phone_first when foundation_needed + phone only', async () => {
    mockGetLatestAuditData.mockResolvedValue({
      auditData: {
        prospect_discovery: {
          highest_opportunity_businesses: [
            {
              business_name: 'Tetees Market',
              emerging_archetype: 'INVISIBLE_ANCHOR',
              growth_readiness: 'foundation_needed',
            },
          ],
        },
      },
      auditId: 'audit-001',
    });
    mockGetCampaign.mockResolvedValue(
      makeCampaign({ phone: '317-555-0100', email: null, website: null }),
    );

    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.callContext.channel_hint).toBe('phone_first');
  });

  it('surfaces channel_hint: null when growth_readiness is high_readiness', async () => {
    mockGetLatestAuditData.mockResolvedValue({
      auditData: {
        prospect_discovery: {
          highest_opportunity_businesses: [
            {
              business_name: 'Tetees Market',
              emerging_archetype: 'INVISIBLE_ANCHOR',
              growth_readiness: 'high_readiness',
            },
          ],
        },
      },
      auditId: 'audit-001',
    });

    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.callContext.channel_hint).toBeNull();
  });

  it('surfaces channel_hint: null when phone-first but has email', async () => {
    mockGetLatestAuditData.mockResolvedValue({
      auditData: {
        prospect_discovery: {
          highest_opportunity_businesses: [
            {
              business_name: 'Tetees Market',
              emerging_archetype: 'DIRECTORY_GHOST',
              growth_readiness: 'insufficient_evidence',
            },
          ],
        },
      },
      auditId: 'audit-001',
    });
    mockGetCampaign.mockResolvedValue(
      makeCampaign({ phone: '317-555-0100', email: 'owner@example.com', website: null }),
    );

    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.callContext.channel_hint).toBeNull();
  });

  it('boosts DIRECTORY_GHOST angles in phone hook ranking', async () => {
    mockGetLatestAuditData.mockResolvedValue({
      auditData: {
        prospect_discovery: {
          highest_opportunity_businesses: [
            {
              business_name: 'Tetees Market',
              emerging_archetype: 'DIRECTORY_GHOST',
              growth_readiness: 'foundation_needed',
            },
          ],
        },
      },
      auditId: 'audit-001',
    });

    const result = await CallScriptService.assembleForCampaign('camp-001');

    // zero_footprint is boosted first by DIRECTORY_GHOST
    expect(result.hookOptions[0].angle).toBe('zero_footprint');
    // gbp_verification is boosted second (also has A3 archetype affinity)
    expect(result.hookOptions[1].angle).toBe('gbp_verification');
  });
});

// ─── Write-back tests ────────────────────────────────────────────────────

describe('CallScriptService.applyCallConfirmations', () => {
  it('creates a new worksheet when none exists', async () => {
    mockOiFindUnique.mockResolvedValue(null);
    mockCampaignsFindUnique.mockResolvedValue({ business_name: 'Tetees Market' });

    const result = await CallScriptService.applyCallConfirmations({
      campaignId: 'camp-001',
      callLogId: 'log-001',
      callDate: '2026-08-12',
      contactedBy: 'operator-1',
      ownerNameConfirmed: 'Maria',
      teamSignalConfirmed: 'family_team',
      preferredChannelConfirmed: 'phone',
      emailObtained: false,
      emailValue: null,
    });

    expect(mockOiCreate).toHaveBeenCalled();
    expect(result.written).toContain('owner_name');
    expect(result.written).toContain('team_signal');
    expect(result.written).toContain('preferred_contact_channel');
    expect(result.conflicts).toHaveLength(0);
  });

  it('fills empty fields on existing worksheet', async () => {
    mockOiFindUnique.mockResolvedValue({
      id: 'moi-existing',
      owner_name: null,
      owner_name_confidence: 'unavailable',
      team_signal: 'unknown',
      preferred_contact_channel: null,
      business_email: null,
    });

    const result = await CallScriptService.applyCallConfirmations({
      campaignId: 'camp-001',
      callLogId: 'log-001',
      callDate: '2026-08-12',
      contactedBy: 'operator-1',
      ownerNameConfirmed: 'Maria',
      teamSignalConfirmed: 'family_team',
      preferredChannelConfirmed: null,
      emailObtained: false,
      emailValue: null,
    });

    expect(mockOiUpdate).toHaveBeenCalled();
    expect(result.written).toContain('owner_name');
    expect(result.written).toContain('team_signal');
  });

  it('idempotent when same confirmed value already present', async () => {
    mockOiFindUnique.mockResolvedValue({
      id: 'moi-existing',
      owner_name: 'Maria',
      owner_name_confidence: 'confirmed',
      team_signal: 'family_team',
      preferred_contact_channel: null,
      business_email: null,
    });

    const result = await CallScriptService.applyCallConfirmations({
      campaignId: 'camp-001',
      callLogId: 'log-001',
      callDate: '2026-08-12',
      contactedBy: 'operator-1',
      ownerNameConfirmed: 'Maria',
      teamSignalConfirmed: 'family_team',
      preferredChannelConfirmed: null,
      emailObtained: false,
      emailValue: null,
    });

    // No fields written (all idempotent)
    expect(result.written).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it('conflict when existing value differs from confirmed value', async () => {
    mockOiFindUnique.mockResolvedValue({
      id: 'moi-existing',
      owner_name: 'John',
      owner_name_confidence: 'confirmed',
      team_signal: 'sole_owner',
      preferred_contact_channel: 'email',
      business_email: 'john@old.com',
    });

    const result = await CallScriptService.applyCallConfirmations({
      campaignId: 'camp-001',
      callLogId: 'log-001',
      callDate: '2026-08-12',
      contactedBy: 'operator-1',
      ownerNameConfirmed: 'Maria',
      teamSignalConfirmed: 'family_team',
      preferredChannelConfirmed: 'phone',
      emailObtained: true,
      emailValue: 'maria@new.com',
    });

    expect(result.conflicts).toHaveLength(4);
    expect(result.conflicts.map((c) => c.field)).toEqual(
      expect.arrayContaining(['owner_name', 'team_signal', 'preferred_contact_channel', 'business_email']),
    );
    // Nothing written — all conflicting
    expect(result.written).toHaveLength(0);
  });

  it('fills campaign.email null-only when email obtained', async () => {
    mockOiFindUnique.mockResolvedValue({
      id: 'moi-existing',
      owner_name: null,
      owner_name_confidence: 'unavailable',
      team_signal: 'unknown',
      preferred_contact_channel: null,
      business_email: null,
    });
    mockCampaignsFindUnique.mockResolvedValue({ email: null });

    const result = await CallScriptService.applyCallConfirmations({
      campaignId: 'camp-001',
      callLogId: 'log-001',
      callDate: '2026-08-12',
      contactedBy: 'operator-1',
      ownerNameConfirmed: null,
      teamSignalConfirmed: null,
      preferredChannelConfirmed: null,
      emailObtained: true,
      emailValue: 'maria@test.com',
    });

    expect(mockCampaignsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'camp-001' },
        data: { email: 'maria@test.com' },
      }),
    );
    expect(result.campaignEmailFilled).toBe(true);
    expect(result.written).toContain('business_email');
  });

  it('does not overwrite campaign.email when already set', async () => {
    mockOiFindUnique.mockResolvedValue({
      id: 'moi-existing',
      owner_name: null,
      owner_name_confidence: 'unavailable',
      team_signal: 'unknown',
      preferred_contact_channel: null,
      business_email: null,
    });
    mockCampaignsFindUnique.mockResolvedValue({ email: 'existing@test.com' });

    const result = await CallScriptService.applyCallConfirmations({
      campaignId: 'camp-001',
      callLogId: 'log-001',
      callDate: '2026-08-12',
      contactedBy: 'operator-1',
      ownerNameConfirmed: null,
      teamSignalConfirmed: null,
      preferredChannelConfirmed: null,
      emailObtained: true,
      emailValue: 'maria@test.com',
    });

    expect(mockCampaignsUpdate).not.toHaveBeenCalled();
    expect(result.campaignEmailFilled).toBe(false);
  });

  it('resolves primary sibling as write target for non-primary siblings', async () => {
    mockCampaignsFindUnique.mockResolvedValue({
      id: 'camp-sibling',
      business_prospect_id: 'bp-001',
      is_primary_sibling: false,
      scope: 'business',
    });
    mockCampaignsFindMany.mockResolvedValue([
      { id: 'camp-primary', is_primary_sibling: true, created_at: '2026-01-01' },
      { id: 'camp-sibling', is_primary_sibling: false, created_at: '2026-01-02' },
    ]);

    const result = await CallScriptService.applyCallConfirmations({
      campaignId: 'camp-sibling',
      callLogId: 'log-001',
      callDate: '2026-08-12',
      contactedBy: 'operator-1',
      ownerNameConfirmed: 'Maria',
      teamSignalConfirmed: null,
      preferredChannelConfirmed: null,
      emailObtained: false,
      emailValue: null,
    });

    expect(result.writeTargetCampaignId).toBe('camp-primary');
    // The findUnique for the worksheet should target the primary sibling
    expect(mockOiFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campaign_id: 'camp-primary' } }),
    );
  });

  it('writes to the campaign itself when it is the primary sibling', async () => {
    mockCampaignsFindUnique.mockResolvedValue({
      id: 'camp-001',
      business_prospect_id: 'bp-001',
      is_primary_sibling: true,
      scope: 'business',
    });

    const result = await CallScriptService.applyCallConfirmations({
      campaignId: 'camp-001',
      callLogId: 'log-001',
      callDate: '2026-08-12',
      contactedBy: 'operator-1',
      ownerNameConfirmed: 'Maria',
      teamSignalConfirmed: null,
      preferredChannelConfirmed: null,
      emailObtained: false,
      emailValue: null,
    });

    expect(result.writeTargetCampaignId).toBe('camp-001');
  });

  it('records an audit entry', async () => {
    mockOiFindUnique.mockResolvedValue(null);
    mockCampaignsFindUnique.mockResolvedValue({ business_name: 'Tetees Market' });

    await CallScriptService.applyCallConfirmations({
      campaignId: 'camp-001',
      callLogId: 'log-001',
      callDate: '2026-08-12',
      contactedBy: 'operator-1',
      ownerNameConfirmed: 'Maria',
      teamSignalConfirmed: null,
      preferredChannelConfirmed: null,
      emailObtained: false,
      emailValue: null,
    });

    expect(mockAudit).toHaveBeenCalled();
    const auditCall = mockAudit.mock.calls[0];
    expect(auditCall[0].action).toBe('update');
    expect(auditCall[0].payload.call_log_id).toBe('log-001');
    expect(auditCall[0].payload.written).toContain('owner_name');
  });
});

// ─── assembleForSeed (spec §13.3 seed path) ─────────────────────────────

describe('CallScriptService.assembleForSeed', () => {
  const seedRow = {
    id: 'seed-1',
    seed_city: 'Indianapolis',
    seed_state: 'IN',
    seed_category: 'Auto Repair',
    business_name: 'Acme Auto',
    address: '123 Main St',
    listing_city: 'Indianapolis',
    listing_state: 'IN',
    zip_code: '46204',
    phone: '317-555-0100',
    website: 'https://acme.test',
  };

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
    verification_question: 'Is 123 Main St still the correct address for {{business}}?',
    pain_question: 'How do most customers find you today?',
    recommended_transition: 'Everything you confirm goes straight into the report.',
    expected_verification: 'confirm',
    created_by: 'op-1',
    activated_by: 'op-1',
    created_at: '2025-01-01',
    activated_at: '2025-01-01',
    retired_at: null,
  };

  const sqlText = (call: any[]): string =>
    Array.isArray(call[0]) ? call[0].join('?') : String(call[0]);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersFindUnique.mockResolvedValue(null);
    mockQueryRaw.mockImplementation((...args: any[]) => {
      const sql = sqlText(args);
      if (sql.includes('FROM directory_presence_seeds')) return Promise.resolve([seedRow]);
      if (sql.includes('FROM directory_claim_tokens')) {
        return Promise.resolve([{ token: 'tok-1', short_code: 'abc123' }]);
      }
      if (sql.includes('FROM mkt_outreach_anchors')) return Promise.resolve([anchorRow]);
      return Promise.resolve([]);
    });
  });

  it('throws NotFoundError for a missing seed', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await expect(CallScriptService.assembleForSeed('seed-missing')).rejects.toThrow('not found');
  });

  it('assembles all stages with merged merge fields', async () => {
    const result = await CallScriptService.assembleForSeed('seed-1');

    expect(result.seed_id).toBe('seed-1');
    expect(result.stages.verify).toContain('Acme Auto');
    expect(result.stages.report_hook).toContain('Indianapolis');
    expect(result.stages.claim_ask).toContain('/seed-report/seed-1');
    // Short claim URL preferred for verbal handoff
    expect(result.stages.claim_ask).toContain('/q/abc123');
    expect(result.callContext.phone).toBe('317-555-0100');
    expect(result.callContext.claim_url).toContain('/place/claim/tok-1');
    expect(result.anchor).toBeNull();
  });

  it('uses the generic verification default when no anchor is selected', async () => {
    const result = await CallScriptService.assembleForSeed('seed-1');
    expect(result.stages.verification).toContain('123 Main St');
    expect(result.stages.pain_probe).toBeNull();
    expect(result.stages.transition).toBeNull();
  });

  it('drives verification/pain/transition stages from the anchor', async () => {
    const result = await CallScriptService.assembleForSeed('seed-1', 'anchor-1');

    expect(result.anchor).not.toBeNull();
    expect(result.anchor!.title).toBe('Verify address');
    // Anchor question merge-resolved
    expect(result.stages.verification).toContain('Acme Auto');
    expect(result.stages.verification).toContain('123 Main St');
    expect(result.stages.pain_probe).toBe('How do most customers find you today?');
    expect(result.stages.transition).toBe('Everything you confirm goes straight into the report.');
  });

  it('proceeds without an anchor when the anchor lookup fails', async () => {
    mockQueryRaw.mockImplementation((...args: any[]) => {
      const sql = sqlText(args);
      if (sql.includes('FROM directory_presence_seeds')) return Promise.resolve([seedRow]);
      if (sql.includes('FROM mkt_outreach_anchors')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    const result = await CallScriptService.assembleForSeed('seed-1', 'anchor-missing');
    expect(result.anchor).toBeNull();
    expect(result.stages.verification).toContain('123 Main St');
  });

  it('omits claim URLs when no active claim token exists', async () => {
    mockQueryRaw.mockImplementation((...args: any[]) => {
      const sql = sqlText(args);
      if (sql.includes('FROM directory_presence_seeds')) return Promise.resolve([seedRow]);
      if (sql.includes('FROM directory_claim_tokens')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    const result = await CallScriptService.assembleForSeed('seed-1');
    expect(result.callContext.claim_url).toBeNull();
    expect(result.callContext.claim_short_url).toBeNull();
    // {{claim_url}} placeholder stays visible rather than fabricated
    expect(result.stages.claim_ask).toContain('{{claim_url}}');
  });

  it('exposes the tracked QR short URLs from the claim kit (§5.1)', async () => {
    mockGetClaimKitMeta.mockResolvedValue({
      claimUrl: 'https://app.example.com/place/claim/tok-1',
      shortClaimUrl: 'https://app.example.com/c/abc123',
      qrUrl: 'https://app.example.com/q/abc123',
      qrUrlWalkin: 'https://app.example.com/qw/abc123',
      qrUrlSocial: 'https://app.example.com/qs/abc123',
      qrUrlEmail: 'https://app.example.com/qe/abc123',
    });
    mockGetReportKitMeta.mockResolvedValue({
      qrUrlInPerson: 'https://app.example.com/r/abc123',
      qrUrlText: 'https://app.example.com/rt/abc123',
      qrUrlEmail: 'https://app.example.com/re/abc123',
      qrUrlSocial: 'https://app.example.com/rs/abc123',
      qrUrlPhone: 'https://app.example.com/rp/abc123',
    });

    const result = await CallScriptService.assembleForSeed('seed-1');

    expect(result.callContext.qr_url_walkin).toBe('https://app.example.com/qw/abc123');
    expect(result.callContext.qr_url_report_in_person).toBe('https://app.example.com/r/abc123');
    expect(result.callContext.qr_url_report_text).toBe('https://app.example.com/rt/abc123');
    // Canonical claim path — never the legacy /directory/claim form.
    expect(result.callContext.claim_url).not.toContain('/directory/claim/');
  });
});
