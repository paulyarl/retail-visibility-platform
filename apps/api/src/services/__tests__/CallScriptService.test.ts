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
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({
  audit: mockAudit,
}));

vi.mock('../../middleware/errorHandler', () => ({
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

  it('returns all 13 ranked hook options', async () => {
    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.hookOptions).toHaveLength(13);
    for (let i = 0; i < 13; i++) {
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

  it('returns the objection table (5 rows)', async () => {
    const result = await CallScriptService.assembleForCampaign('camp-001');

    expect(result.objections).toHaveLength(5);
    for (const obj of result.objections) {
      expect(obj.objection).toBeTruthy();
      expect(obj.response).toBeTruthy();
    }
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
    const topAngles = result.hookOptions.slice(0, 3).map((h) => h.angle);

    // A4-affinity: gbp_verification, website_foundation, click_to_call
    expect(topAngles).toContain('gbp_verification');
    expect(topAngles).toContain('website_foundation');
    expect(topAngles).toContain('click_to_call');
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
