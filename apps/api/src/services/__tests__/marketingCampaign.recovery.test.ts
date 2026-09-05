import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma + logger + id-generator + dependencies so we can test the
// transition logic in isolation without a DB.
const { mockCampaignsList, mockStageHistory } = vi.hoisted(() => ({
  mockCampaignsList: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  mockStageHistory: { create: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_stage_history_list: mockStageHistory,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateCampaignId: () => 'mcamp-test-001',
  generateStageHistoryId: () => 'msh-test-001',
}));

vi.mock('../MarketingCategoryToneService', () => ({
  default: { getPresetByCategory: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../MarketingServiceCategoryService', () => ({
  default: { getLabel: vi.fn().mockResolvedValue(null) },
}));

import MarketingCampaignService, {
  transitionsFor,
  CAMPAIGN_CATEGORY_DEFAULT,
} from '../MarketingCampaignService';

// MarketingCampaignService default export is already the singleton instance
// (export default MarketingCampaignService.getInstance() at the bottom of the file)
const service = MarketingCampaignService;

// ====================
// REVIEW TRACK REGRESSION
// ====================
// The actual map from MarketingCampaignService.ts — must not change when
// recovery transitions are added. Includes the `closed` stage and one-way
// `lost → seek` / `dead → seek` resurrection paths.

describe('review track transitions (regression)', () => {
  it('transitionsFor(review_management) returns the existing map unchanged', () => {
    const map = transitionsFor('review_management');
    expect(map).toEqual({
      seek:             ['preview_built', 'dead'],
      preview_built:    ['shown', 'dead'],
      shown:            ['paid', 'lost', 'tenant_onboarded'],
      paid:             ['delivered', 'tenant_onboarded', 'gbp_intake_submitted', 'review_setup_submitted'],
      delivered:        ['retainer_pitched', 'closed', 'tenant_onboarded', 'gbp_intake_submitted', 'review_setup_submitted'],
      // Registry-driven intake submitted stages — flow back to delivered
      gbp_intake_submitted:   ['delivered', 'tenant_onboarded'],
      review_setup_submitted: ['delivered', 'tenant_onboarded'],
      retainer_pitched: ['retainer_won', 'closed'],
      retainer_won:     ['lost', 'tenant_onboarded'],
      lost:             ['seek', 'tenant_onboarded'],
      dead:             ['seek', 'tenant_onboarded'],
    });
  });

  it('transitionsFor() defaults to review_management', () => {
    expect(transitionsFor()).toEqual(transitionsFor('review_management'));
  });

  it('CAMPAIGN_CATEGORY_DEFAULT is review_management', () => {
    expect(CAMPAIGN_CATEGORY_DEFAULT).toBe('review_management');
  });

  it('isValidTransition uses review map by default', () => {
    expect(service.isValidTransition('seek', 'preview_built')).toBe(true);
    expect(service.isValidTransition('seek', 'paid')).toBe(false);
    expect(service.isValidTransition('delivered', 'closed')).toBe(true);
    expect(service.isValidTransition('lost', 'seek')).toBe(true);
    expect(service.isValidTransition('dead', 'seek')).toBe(true);
    // one-way resurrection: seek cannot go back to lost
    expect(service.isValidTransition('seek', 'lost')).toBe(false);
  });

  it('isValidTransition(null, anything) is true (initial transition)', () => {
    expect(service.isValidTransition(null, 'seek')).toBe(true);
    expect(service.isValidTransition(null, 'audit_identified')).toBe(true);
  });
});

// ====================
// RECOVERY TRACK
// ====================

describe('recovery track transitions', () => {
  it('transitionsFor(recovery_management) returns the recovery map', () => {
    const map = transitionsFor('recovery_management');
    expect(map).toEqual({
      audit_identified:            ['framework_preview_generated', 'dead'],
      framework_preview_generated: ['outreach_dispatched', 'dead'],
      outreach_dispatched:         ['awaiting_owner_intake', 'dead'],
      awaiting_owner_intake:       ['intake_submitted', 'outreach_dispatched', 'dead'],
      intake_submitted:            ['final_resolution_drafted'],
      final_resolution_drafted:    ['owner_approved'],
      owner_approved:              ['resolved_and_closed'],
      resolved_and_closed:         [],
      dead:                        ['audit_identified'],
    });
  });

  it('isValidTransition uses recovery map when category is passed', () => {
    // Happy path from the spec's state machine
    expect(service.isValidTransition('audit_identified', 'framework_preview_generated', 'recovery_management')).toBe(true);
    expect(service.isValidTransition('framework_preview_generated', 'outreach_dispatched', 'recovery_management')).toBe(true);
    expect(service.isValidTransition('outreach_dispatched', 'awaiting_owner_intake', 'recovery_management')).toBe(true);
    expect(service.isValidTransition('awaiting_owner_intake', 'intake_submitted', 'recovery_management')).toBe(true);
    expect(service.isValidTransition('intake_submitted', 'final_resolution_drafted', 'recovery_management')).toBe(true);
    expect(service.isValidTransition('final_resolution_drafted', 'owner_approved', 'recovery_management')).toBe(true);
    expect(service.isValidTransition('owner_approved', 'resolved_and_closed', 'recovery_management')).toBe(true);
  });

  it('awaiting_owner_intake can re-dispatch to outreach_dispatched (token expiry / cascade re-touch)', () => {
    expect(service.isValidTransition('awaiting_owner_intake', 'outreach_dispatched', 'recovery_management')).toBe(true);
  });

  it('awaiting_owner_intake can go to dead (cascade exhaustion / timeout)', () => {
    expect(service.isValidTransition('awaiting_owner_intake', 'dead', 'recovery_management')).toBe(true);
  });

  it('dead resurrects to audit_identified (re-engage after cooldown)', () => {
    expect(service.isValidTransition('dead', 'audit_identified', 'recovery_management')).toBe(true);
  });

  it('resolved_and_closed is terminal (no outgoing transitions)', () => {
    expect(service.isValidTransition('resolved_and_closed', 'audit_identified', 'recovery_management')).toBe(false);
    expect(service.isValidTransition('resolved_and_closed', 'dead', 'recovery_management')).toBe(false);
  });

  it('rejects illegal recovery jumps', () => {
    // Cannot skip stages
    expect(service.isValidTransition('audit_identified', 'intake_submitted', 'recovery_management')).toBe(false);
    expect(service.isValidTransition('outreach_dispatched', 'final_resolution_drafted', 'recovery_management')).toBe(false);
    expect(service.isValidTransition('intake_submitted', 'owner_approved', 'recovery_management')).toBe(false);
    // Cannot go backwards (except dead → audit_identified and awaiting_owner_intake → outreach_dispatched)
    expect(service.isValidTransition('intake_submitted', 'awaiting_owner_intake', 'recovery_management')).toBe(false);
    expect(service.isValidTransition('final_resolution_drafted', 'intake_submitted', 'recovery_management')).toBe(false);
    expect(service.isValidTransition('owner_approved', 'final_resolution_drafted', 'recovery_management')).toBe(false);
  });

  it('rejects review-track stages on the recovery map', () => {
    expect(service.isValidTransition('audit_identified', 'seek', 'recovery_management')).toBe(false);
    expect(service.isValidTransition('audit_identified', 'paid', 'recovery_management')).toBe(false);
  });

  it('rejects recovery-track stages on the review map', () => {
    expect(service.isValidTransition('seek', 'audit_identified')).toBe(false);
    expect(service.isValidTransition('paid', 'intake_submitted')).toBe(false);
  });
});

// ====================
// transitionStage uses campaign_category from the loaded row
// ====================

describe('transitionStage reads campaign_category', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStageHistory.create.mockResolvedValue({});
  });

  it('allows recovery transitions for a recovery_management campaign', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({
      id: 'mcamp-1',
      stage: 'audit_identified',
      campaign_category: 'recovery_management',
    });
    mockCampaignsList.update.mockImplementation(({ where, data }) =>
      Promise.resolve({ id: where.id, ...data }),
    );

    const result = await service.transitionStage({
      campaignId: 'mcamp-1',
      toStage: 'framework_preview_generated',
      triggerType: 'manual',
    });

    expect(result.stage).toBe('framework_preview_generated');
    expect(mockCampaignsList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mcamp-1' },
        data: expect.objectContaining({ stage: 'framework_preview_generated' }),
      }),
    );
  });

  it('rejects recovery transitions for a review_management campaign', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({
      id: 'mcamp-2',
      stage: 'seek',
      campaign_category: 'review_management',
    });

    await expect(
      service.transitionStage({
        campaignId: 'mcamp-2',
        toStage: 'audit_identified',
        triggerType: 'manual',
      }),
    ).rejects.toThrow('Invalid stage transition');

    expect(mockCampaignsList.update).not.toHaveBeenCalled();
  });

  it('defaults to review_management when campaign_category is null (legacy rows)', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({
      id: 'mcamp-3',
      stage: 'seek',
      campaign_category: null,
    });

    await expect(
      service.transitionStage({
        campaignId: 'mcamp-3',
        toStage: 'audit_identified',
        triggerType: 'manual',
      }),
    ).rejects.toThrow('Invalid stage transition');
  });

  it('allows review transitions for a review_management campaign', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({
      id: 'mcamp-4',
      stage: 'seek',
      campaign_category: 'review_management',
    });
    mockCampaignsList.update.mockImplementation(({ where, data }) =>
      Promise.resolve({ id: where.id, ...data }),
    );

    const result = await service.transitionStage({
      campaignId: 'mcamp-4',
      toStage: 'preview_built',
      triggerType: 'manual',
    });

    expect(result.stage).toBe('preview_built');
  });
});

// ====================
// createCampaign sets initial stage based on category
// ====================

describe('createCampaign sets initial stage by category', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStageHistory.create.mockResolvedValue({});
    mockCampaignsList.findFirst.mockResolvedValue(null);
    mockCampaignsList.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...data, id: data.id }),
    );
  });

  it('creates a review campaign with stage=seek by default', async () => {
    const result = await service.createCampaign({
      category: 'plumber',
      city: 'Austin',
    });

    expect(result.stage).toBe('seek');
    expect(result.campaign_category).toBe('review_management');
    expect(mockStageHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ to_stage: 'seek' }),
      }),
    );
  });

  it('creates a recovery campaign with stage=audit_identified', async () => {
    const result = await service.createCampaign({
      category: 'plumber',
      city: 'Austin',
      campaignCategory: 'recovery_management',
    });

    expect(result.stage).toBe('audit_identified');
    expect(result.campaign_category).toBe('recovery_management');
    expect(mockStageHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ to_stage: 'audit_identified' }),
      }),
    );
  });
});

// ====================
// Structural-duplicate guardrail
// ====================
// The operator must not be able to create a second active campaign with the
// same structural signature (scope + category + kind + focus + platform +
// geo, or the per-scope equivalent). Re-running an existing campaign
// produces a versioned output instead. Inactive (dead/lost/closed)
// campaigns do not block.

describe('createCampaign structural-duplicate guardrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStageHistory.create.mockResolvedValue({});
    mockCampaignsList.findFirst.mockResolvedValue(null);
    mockCampaignsList.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...data, id: data.id }),
    );
  });

  it('blocks a duplicate intelligence establishment / gold_standards campaign (all platforms, nationwide)', async () => {
    mockCampaignsList.findFirst.mockResolvedValueOnce({
      id: 'mcamp-existing-001',
      display_id: 'MC-0001',
      scope: 'intelligence',
      campaign_category: 'review_management',
      category: 'Indian Grocery Store',
      city: null,
      state: null,
      business_name: null,
      stage: 'seek',
      intelligence_campaign_kind: 'establishment',
      intelligence_focus: 'gold_standards',
      intelligence_platform: null,
    });

    await expect(
      service.createCampaign({
        scope: 'intelligence',
        category: 'Indian Grocery Store',
        intelligenceCampaignKind: 'establishment',
        intelligenceFocus: 'gold_standards',
        intelligencePlatform: null,
      }),
    ).rejects.toThrow(/same structural signature already exists/);

    expect(mockCampaignsList.create).not.toHaveBeenCalled();
  });

  it('treats explicit "all" platform the same as null platform (nationwide signature match)', async () => {
    mockCampaignsList.findFirst.mockResolvedValueOnce({
      id: 'mcamp-existing-002',
      display_id: null,
      scope: 'intelligence',
      campaign_category: 'review_management',
      category: 'Indian Grocery Store',
      city: null,
      state: null,
      business_name: null,
      stage: 'seek',
      intelligence_campaign_kind: 'establishment',
      intelligence_focus: 'gold_standards',
      intelligence_platform: null,
    });

    await expect(
      service.createCampaign({
        scope: 'intelligence',
        category: 'Indian Grocery Store',
        intelligenceCampaignKind: 'establishment',
        intelligenceFocus: 'gold_standards',
        intelligencePlatform: 'all',
      }),
    ).rejects.toThrow(/same structural signature already exists/);
  });

  it('allows a campaign when the only existing match is inactive (dead)', async () => {
    // findFirst returns null because the INACTIVE_STAGES filter excludes the
    // dead campaign — simulate the post-filter result (no active match).
    mockCampaignsList.findFirst.mockResolvedValueOnce(null);

    const result = await service.createCampaign({
      scope: 'intelligence',
      category: 'Indian Grocery Store',
      intelligenceCampaignKind: 'establishment',
      intelligenceFocus: 'gold_standards',
      intelligencePlatform: null,
    });

    expect(result.stage).toBe('seek');
    expect(mockCampaignsList.create).toHaveBeenCalled();
  });

  it('blocks a duplicate business-scope campaign (same business + category + city)', async () => {
    mockCampaignsList.findFirst.mockResolvedValueOnce({
      id: 'mcamp-existing-003',
      display_id: 'MC-0099',
      scope: 'business',
      campaign_category: 'review_management',
      category: 'plumber',
      city: 'Austin',
      state: 'TX',
      business_name: 'Joe Plumbing',
      stage: 'shown',
      intelligence_campaign_kind: null,
      intelligence_focus: null,
      intelligence_platform: null,
    });

    await expect(
      service.createCampaign({
        scope: 'business',
        businessName: 'Joe Plumbing',
        category: 'plumber',
        city: 'Austin',
        state: 'TX',
      }),
    ).rejects.toThrow(/same structural signature already exists/);

    expect(mockCampaignsList.create).not.toHaveBeenCalled();
  });

  it('allows a business-scope campaign for a different business in the same category/city', async () => {
    mockCampaignsList.findFirst.mockResolvedValueOnce(null);

    const result = await service.createCampaign({
      scope: 'business',
      businessName: 'Another Plumbing Co',
      category: 'plumber',
      city: 'Austin',
      state: 'TX',
    });

    expect(result.id).toBeDefined();
    expect(mockCampaignsList.create).toHaveBeenCalled();
  });

  it('blocks a duplicate discovery campaign with the same focus + platform + geo', async () => {
    mockCampaignsList.findFirst.mockResolvedValueOnce({
      id: 'mcamp-existing-004',
      display_id: null,
      scope: 'intelligence',
      campaign_category: 'review_management',
      category: 'Indian Grocery Store',
      city: 'Jersey City',
      state: 'NJ',
      business_name: null,
      stage: 'preview_built',
      intelligence_campaign_kind: 'discovery',
      intelligence_focus: 'emerging',
      intelligence_platform: 'google',
    });

    await expect(
      service.createCampaign({
        scope: 'intelligence',
        category: 'Indian Grocery Store',
        city: 'Jersey City',
        state: 'NJ',
        intelligenceCampaignKind: 'discovery',
        intelligenceFocus: 'emerging',
        intelligencePlatform: 'google',
      }),
    ).rejects.toThrow(/same structural signature already exists/);
  });

  it('allows creation when the duplicate-check query itself errors (best-effort guardrail)', async () => {
    mockCampaignsList.findFirst.mockRejectedValueOnce(new Error('db connection lost'));

    const result = await service.createCampaign({
      scope: 'intelligence',
      category: 'Indian Grocery Store',
      intelligenceCampaignKind: 'establishment',
      intelligenceFocus: 'gold_standards',
      intelligencePlatform: null,
    });

    expect(result.id).toBeDefined();
    expect(mockCampaignsList.create).toHaveBeenCalled();
  });
});
