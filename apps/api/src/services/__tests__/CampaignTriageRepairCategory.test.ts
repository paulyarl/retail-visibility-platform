/**
 * CampaignTriageService — profile_repair category + repair_track tests
 *
 * Verifies that acceptTriage and overrideTriage correctly set repair_track
 * to 'standard' when the playbook category is 'profile_repair', and clear
 * repair_track (null) for non-profile_repair categories.
 *
 * Spec: docs/LocalBiz/marketing_ops_multi_archetype_campaign_sprint_plan.md
 * Sprint 1 — C2 (repair_track on accept/override).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCampaignsList,
  mockTriageResults,
  mockAudits,
  mockPlaybookCatalog,
} = vi.hoisted(() => ({
  mockCampaignsList: { findUnique: vi.fn(), update: vi.fn() },
  mockTriageResults: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  mockAudits: { findMany: vi.fn() },
  mockPlaybookCatalog: { findMany: vi.fn(), findUnique: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_campaign_triage_results: mockTriageResults,
    mkt_audits_list: mockAudits,
    mkt_playbook_catalog: mockPlaybookCatalog,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateCampaignTriageId: () => 'mct-test-001',
}));

// Mock MarketingPlaybookCatalogService — static methods used by CampaignTriageService
vi.mock('../MarketingPlaybookCatalogService', () => ({
  default: {
    listActivePlaybooksOrdered: vi.fn().mockResolvedValue([]),
    getPlaybookByCode: vi.fn(),
    getInstance: () => ({
      getPlaybookByCode: vi.fn(),
    }),
  },
}));

import CampaignTriageService from '../CampaignTriageService';

// ─── Fixtures ────────────────────────────────────────────────────────────

const profileRepairPlaybook = {
  id: 'pbk-pb01',
  code: 'PB-01',
  name: 'NAP & Listing Drift Repair',
  category: 'profile_repair',
  archetype: 'A3',
  archetype_label: 'A3_LISTING_DRIFT',
  description: null,
  matching_rules: { any: ['CP_NAP_NAME_DRIFT'], all: [], none: [], dual: null, confidence: 0.85 },
  priority_rank: 3,
  fitd_offer_title: 'FITD',
  fitd_default_fee_cents: 14900,
  retainer_pitch_title: 'Retainer',
  retainer_fee_cents: 29900,
  opener_prompt_template_id: null,
  preview_deliverable_type: 'nap_audit',
  is_active: true,
};

const reviewManagementPlaybook = {
  ...profileRepairPlaybook,
  id: 'pbk-pb02',
  code: 'PB-02',
  name: 'Review Gap Builder',
  category: 'review_management',
  archetype: 'A1',
  archetype_label: 'A1_REVIEW_GAP',
  fitd_default_fee_cents: 19900,
};

const triageResultRow = (playbook: any) => ({
  id: 'mct-test-001',
  campaign_id: 'mkt-001',
  recommended_playbook_id: playbook.id,
  confidence_score: 0.85,
  triage_reasoning: 'test',
  detected_signals: [],
  is_operator_accepted: null,
  overridden_playbook_id: null,
  source_audit_id: null,
  evaluated_at: new Date(),
  playbook: playbook, // included relation
  overridden_playbook: null,
});

// ─── acceptTriage ────────────────────────────────────────────────────────

describe('acceptTriage — repair_track for profile_repair', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets repair_track to standard when accepting a profile_repair playbook', async () => {
    mockTriageResults.findUnique.mockResolvedValue(triageResultRow(profileRepairPlaybook));
    mockTriageResults.update.mockResolvedValue(triageResultRow(profileRepairPlaybook));
    mockCampaignsList.update.mockResolvedValue({});

    await CampaignTriageService.getInstance().acceptTriage({ campaignId: 'mkt-001' });

    expect(mockCampaignsList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mkt-001' },
        data: expect.objectContaining({
          campaign_category: 'profile_repair',
          repair_track: 'standard',
        }),
      }),
    );
  });

  it('clears repair_track (null) when accepting a review_management playbook', async () => {
    mockTriageResults.findUnique.mockResolvedValue(triageResultRow(reviewManagementPlaybook));
    mockTriageResults.update.mockResolvedValue(triageResultRow(reviewManagementPlaybook));
    mockCampaignsList.update.mockResolvedValue({});

    await CampaignTriageService.getInstance().acceptTriage({ campaignId: 'mkt-001' });

    expect(mockCampaignsList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mkt-001' },
        data: expect.objectContaining({
          campaign_category: 'review_management',
          repair_track: null,
        }),
      }),
    );
  });

  it('applies the playbook FITD fee on accept', async () => {
    mockTriageResults.findUnique.mockResolvedValue(triageResultRow(profileRepairPlaybook));
    mockTriageResults.update.mockResolvedValue(triageResultRow(profileRepairPlaybook));
    mockCampaignsList.update.mockResolvedValue({});

    await CampaignTriageService.getInstance().acceptTriage({ campaignId: 'mkt-001' });

    expect(mockCampaignsList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estimated_fee_cents: profileRepairPlaybook.fitd_default_fee_cents,
        }),
      }),
    );
  });
});

// ─── overrideTriage ──────────────────────────────────────────────────────

describe('overrideTriage — repair_track for profile_repair', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets repair_track to standard when overriding to a profile_repair playbook', async () => {
    const { MarketingPlaybookCatalogService } = await import('../MarketingPlaybookCatalogService');
    (MarketingPlaybookCatalogService as any).getPlaybookByCode.mockResolvedValue(profileRepairPlaybook);

    mockTriageResults.findUnique.mockResolvedValue(triageResultRow(reviewManagementPlaybook));
    mockTriageResults.update.mockResolvedValue(triageResultRow(profileRepairPlaybook));
    mockCampaignsList.update.mockResolvedValue({});

    await CampaignTriageService.getInstance().overrideTriage({
      campaignId: 'mkt-001',
      playbookCode: 'PB-01',
      reason: 'operator override',
    });

    expect(mockCampaignsList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mkt-001' },
        data: expect.objectContaining({
          campaign_category: 'profile_repair',
          repair_track: 'standard',
        }),
      }),
    );
  });

  it('clears repair_track (null) when overriding to a review_management playbook', async () => {
    const { MarketingPlaybookCatalogService } = await import('../MarketingPlaybookCatalogService');
    (MarketingPlaybookCatalogService as any).getPlaybookByCode.mockResolvedValue(reviewManagementPlaybook);

    mockTriageResults.findUnique.mockResolvedValue(triageResultRow(profileRepairPlaybook));
    mockTriageResults.update.mockResolvedValue(triageResultRow(reviewManagementPlaybook));
    mockCampaignsList.update.mockResolvedValue({});

    await CampaignTriageService.getInstance().overrideTriage({
      campaignId: 'mkt-001',
      playbookCode: 'PB-02',
      reason: 'switching to review',
    });

    expect(mockCampaignsList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mkt-001' },
        data: expect.objectContaining({
          campaign_category: 'review_management',
          repair_track: null,
        }),
      }),
    );
  });
});
