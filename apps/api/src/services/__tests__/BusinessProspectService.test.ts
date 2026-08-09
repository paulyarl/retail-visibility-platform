/**
 * BusinessProspectService — sibling creation, listing, cycling tests
 *
 * Tests the core multi-archetype sibling campaign operations:
 *   - initializeProspectFromCampaign: backfills business_prospect_id
 *   - createSiblingCampaign: creates sibling with copied identity fields
 *   - listSiblings: returns all siblings for a prospect
 *   - cycleToNextEngagement: increments engagement_cycle + resets stage
 *
 * Spec: docs/LocalBiz/marketing_ops_multi_archetype_campaign_sprint_plan.md
 * Sprint 1 — S1.9 + S1.16.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCampaignsList,
  mockStageHistory,
  mockTriageResults,
} = vi.hoisted(() => ({
  mockCampaignsList: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockStageHistory: { create: vi.fn() },
  mockTriageResults: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_stage_history_list: mockStageHistory,
    mkt_campaign_triage_results: mockTriageResults,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateCampaignId: () => 'mkt-sibling-001',
  generateBusinessProspectId: () => 'bp-test001',
  generateStageHistoryId: () => 'msh-test001',
  generateCampaignTriageId: () => 'mct-sibling-001',
}));

vi.mock('../MarketingPlaybookCatalogService', () => ({
  default: {
    getPlaybookByCode: vi.fn().mockResolvedValue({
      id: 'pbk-pb01',
      code: 'PB-01',
      category: 'profile_repair',
      archetype: 'A3',
      fitdDefaultFeeCents: 14900,
      matchingRules: { any: [], all: [], none: [], dual: null, confidence: 0.85 },
    }),
  },
}));

import { BusinessProspectService } from '../BusinessProspectService';

// ─── Fixtures ────────────────────────────────────────────────────────────

const sourceCampaign = {
  id: 'mkt-source-001',
  scope: 'business',
  campaign_category: 'review_management',
  repair_track: null,
  business_name: 'Test Biz',
  category: 'plumber',
  city: 'Denver',
  neighborhood: 'Cap Hill',
  contact_method: 'email',
  contact_info: 'owner@test.com',
  phone: '555-1234',
  email: 'owner@test.com',
  website_url: 'https://test.com',
  social_profiles: [],
  owner_names: ['John Doe'],
  phones: [],
  address_line1: '123 Main St',
  address_line2: null,
  address_city: 'Denver',
  address_state: 'CO',
  address_zip: '80202',
  address_country: 'US',
  directory_profiles: [],
  gbp_claimed: true,
  unaddressed_reviews: 5,
  last_review_date: null,
  has_website: 'yes',
  nap_consistent: null,
  estimated_tier: null,
  pain_score: 3,
  tone: null,
  attributes: [],
  assigned_to: 'operator-1',
  parent_campaign_id: null,
  customer_id: 'cust-001',
  business_prospect_id: 'bp-existing-001',
  is_primary_sibling: true,
  engagement_cycle: 1,
  stage: 'shown',
  estimated_fee_cents: 19900,
  amount_paid_cents: 19900,
  created_at: new Date('2025-01-01'),
};

// ─── initializeProspectFromCampaign ──────────────────────────────────────

describe('initializeProspectFromCampaign', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns existing prospect_id if campaign already has one', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({ ...sourceCampaign });

    const result = await BusinessProspectService.getInstance().initializeProspectFromCampaign('mkt-source-001');

    expect(result).toBe('bp-existing-001');
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
  });

  it('generates + persists a new prospect_id if campaign has none', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({ ...sourceCampaign, business_prospect_id: null });
    mockCampaignsList.update.mockResolvedValue({});

    const result = await BusinessProspectService.getInstance().initializeProspectFromCampaign('mkt-source-001');

    expect(result).toBe('bp-test001');
    expect(mockCampaignsList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mkt-source-001' },
        data: expect.objectContaining({
          business_prospect_id: 'bp-test001',
          is_primary_sibling: true,
        }),
      }),
    );
  });

  it('throws NotFoundError if campaign does not exist', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(null);

    await expect(
      BusinessProspectService.getInstance().initializeProspectFromCampaign('nonexistent'),
    ).rejects.toThrow('not found');
  });
});

// ─── createSiblingCampaign ───────────────────────────────────────────────

describe('createSiblingCampaign', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a sibling with copied business identity + profile_repair category', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({ ...sourceCampaign });
    mockCampaignsList.findMany.mockResolvedValue([]); // no existing siblings with same playbook
    mockCampaignsList.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...data, id: 'mkt-sibling-001' }),
    );
    mockStageHistory.create.mockResolvedValue({});
    mockTriageResults.findUnique.mockResolvedValue(null); // no source triage
    mockTriageResults.create.mockResolvedValue({});

    const result = await BusinessProspectService.getInstance().createSiblingCampaign({
      sourceCampaignId: 'mkt-source-001',
      archetype: 'A3',
      playbookCode: 'PB-01',
    });

    expect(mockCampaignsList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'mkt-sibling-001',
          business_prospect_id: 'bp-existing-001',
          is_primary_sibling: false,
          engagement_cycle: 1,
          campaign_category: 'profile_repair',
          playbook_code: 'PB-01',
          repair_track: 'standard',
          stage: 'seek',
          business_name: 'Test Biz',
          city: 'Denver',
          customer_id: 'cust-001',
        }),
      }),
    );
    expect(result.id).toBe('mkt-sibling-001');
  });

  it('creates a pre-accepted triage result for triage-driven siblings', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({ ...sourceCampaign });
    mockCampaignsList.findMany.mockResolvedValue([]);
    mockCampaignsList.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...data, id: 'mkt-sibling-001' }),
    );
    mockStageHistory.create.mockResolvedValue({});
    mockTriageResults.findUnique.mockResolvedValue({
      detected_signals: [{ code: 'CP_NAP_NAME_DRIFT', label: 'NAP Name Drift', contributedToRule: true }],
      source_audit_id: 'audit-001',
    });
    mockTriageResults.create.mockResolvedValue({});

    await BusinessProspectService.getInstance().createSiblingCampaign({
      sourceCampaignId: 'mkt-source-001',
      archetype: 'A3',
      playbookCode: 'PB-01',
    });

    // Verify a pre-accepted triage result was created for the sibling
    expect(mockTriageResults.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'mct-sibling-001',
          campaign_id: 'mkt-sibling-001',
          recommended_playbook_id: 'pbk-pb01',
          is_operator_accepted: true,
          overridden_playbook_id: null,
          source_audit_id: 'audit-001',
        }),
      }),
    );
  });

  it('does NOT create a triage result for manually-created siblings (no playbookCode)', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({ ...sourceCampaign });
    mockCampaignsList.create.mockResolvedValue({ id: 'mkt-sibling-001' });
    mockStageHistory.create.mockResolvedValue({});

    await BusinessProspectService.getInstance().createSiblingCampaign({
      sourceCampaignId: 'mkt-source-001',
      archetype: 'A3',
      campaignCategory: 'profile_repair',
      repairTrack: 'standard',
    });

    expect(mockTriageResults.create).not.toHaveBeenCalled();
  });

  it('throws ConflictError if a sibling with the same playbook already exists', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({ ...sourceCampaign });
    // Existing sibling already using PB-01 → conflict on playbook_code
    mockCampaignsList.findMany.mockResolvedValue([
      { ...sourceCampaign, id: 'mkt-existing-sibling', playbook_code: 'PB-01', business_name: 'Test Biz' },
    ]);

    await expect(
      BusinessProspectService.getInstance().createSiblingCampaign({
        sourceCampaignId: 'mkt-source-001',
        archetype: 'A3',
        playbookCode: 'PB-01',
      }),
    ).rejects.toThrow(/playbook 'PB-01'/);
  });

  it('allows coexistence of profile_repair siblings with different playbooks (PB-01 vs PB-03)', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({ ...sourceCampaign });
    // Existing sibling using PB-01 — creating a PB-03 sibling must NOT conflict
    mockCampaignsList.findMany.mockResolvedValue([]);
    mockCampaignsList.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...data, id: 'mkt-sibling-pb03' }),
    );
    mockStageHistory.create.mockResolvedValue({});
    mockTriageResults.findUnique.mockResolvedValue(null);
    mockTriageResults.create.mockResolvedValue({});

    const result = await BusinessProspectService.getInstance().createSiblingCampaign({
      sourceCampaignId: 'mkt-source-001',
      archetype: 'A4',
      playbookCode: 'PB-03',
    });

    expect(mockCampaignsList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaign_category: 'profile_repair',
          playbook_code: 'PB-03',
          repair_track: 'standard',
        }),
      }),
    );
    expect(result.id).toBe('mkt-sibling-pb03');
  });

  it('auto-initializes prospect_id on source campaign if missing', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({ ...sourceCampaign, business_prospect_id: null });
    mockCampaignsList.findMany.mockResolvedValue([]);
    mockCampaignsList.create.mockResolvedValue({ id: 'mkt-sibling-001' });
    mockStageHistory.create.mockResolvedValue({});

    await BusinessProspectService.getInstance().createSiblingCampaign({
      sourceCampaignId: 'mkt-source-001',
      archetype: 'A3',
      campaignCategory: 'profile_repair',
      repairTrack: 'standard',
    });

    // update called once for initialize, once for create is via create() not update()
    expect(mockCampaignsList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mkt-source-001' },
        data: expect.objectContaining({
          business_prospect_id: 'bp-test001',
          is_primary_sibling: true,
        }),
      }),
    );
  });
});

// ─── listSiblings ────────────────────────────────────────────────────────

describe('listSiblings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns siblings sorted with primary first', async () => {
    const siblingA = { ...sourceCampaign, id: 'mkt-a', is_primary_sibling: false, created_at: new Date('2025-01-02') };
    const siblingB = { ...sourceCampaign, id: 'mkt-b', is_primary_sibling: true, created_at: new Date('2025-01-03') };
    mockCampaignsList.findMany.mockResolvedValue([siblingA, siblingB]);

    const result = await BusinessProspectService.getInstance().listSiblings('bp-existing-001');

    expect(result.length).toBe(2);
    expect(result[0].id).toBe('mkt-b'); // primary first
    expect(result[1].id).toBe('mkt-a');
  });

  it('returns empty array when no siblings exist', async () => {
    mockCampaignsList.findMany.mockResolvedValue([]);
    const result = await BusinessProspectService.getInstance().listSiblings('bp-empty');
    expect(result).toEqual([]);
  });
});

// ─── cycleToNextEngagement ───────────────────────────────────────────────

describe('cycleToNextEngagement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('increments engagement_cycle and resets stage to seek', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({ ...sourceCampaign, engagement_cycle: 1, stage: 'delivered' });
    mockCampaignsList.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...sourceCampaign, ...data }),
    );
    mockStageHistory.create.mockResolvedValue({});

    const result = await BusinessProspectService.getInstance().cycleToNextEngagement({
      campaignId: 'mkt-source-001',
    });

    expect(mockCampaignsList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mkt-source-001' },
        data: expect.objectContaining({
          engagement_cycle: 2,
          stage: 'seek',
          amount_paid_cents: 0,
          retainer_status: 'not_pitched',
        }),
      }),
    );
    expect(result.engagement_cycle).toBe(2);
  });

  it('logs a cycle_started stage history entry', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({ ...sourceCampaign, engagement_cycle: 2, stage: 'delivered' });
    mockCampaignsList.update.mockResolvedValue({ ...sourceCampaign, engagement_cycle: 3 });
    mockStageHistory.create.mockResolvedValue({});

    await BusinessProspectService.getInstance().cycleToNextEngagement({
      campaignId: 'mkt-source-001',
      notes: 'cycle 3 start',
    });

    expect(mockStageHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          from_stage: 'delivered',
          to_stage: 'seek',
          notes: expect.stringContaining('Engagement cycle 2→3'),
        }),
      }),
    );
  });

  it('throws NotFoundError if campaign does not exist', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(null);

    await expect(
      BusinessProspectService.getInstance().cycleToNextEngagement({ campaignId: 'nonexistent' }),
    ).rejects.toThrow('not found');
  });
});
