import { describe, it, expect, vi, beforeEach } from 'vitest';

// ====================
// MOCKS
// ====================

const { mockCampaigns, mockAudits, mockDisputeIntake, mockStageHistory, mockSeedLinks, mockChecklistProgress, mockChecklistSteps, prismaMock } = vi.hoisted(() => {
  const mockCampaigns = { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() };
  const mockAudits = { findMany: vi.fn() };
  const mockDisputeIntake = { findFirst: vi.fn() };
  const mockStageHistory = { create: vi.fn() };
  const mockSeedLinks = { findFirst: vi.fn() };
  const mockChecklistProgress = { findMany: vi.fn() };
  const mockChecklistSteps = { findMany: vi.fn() };
  const prismaMock: any = {
    mkt_campaigns_list: mockCampaigns,
    mkt_audits_list: mockAudits,
    mkt_dispute_intake: mockDisputeIntake,
    mkt_stage_history_list: mockStageHistory,
    directory_seed_campaign_links: mockSeedLinks,
    mkt_campaign_checklist_progress: mockChecklistProgress,
    mkt_playbook_checklist_steps: mockChecklistSteps,
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };
  // $transaction invokes the callback with the same mocked client as `tx`.
  prismaMock.$transaction = vi.fn((fn: any) => fn(prismaMock));
  return { mockCampaigns, mockAudits, mockDisputeIntake, mockStageHistory, mockSeedLinks, mockChecklistProgress, mockChecklistSteps, prismaMock };
});

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateCampaignId: () => 'mcamp-sibling-001',
  generateStageHistoryId: () => 'msh-sibling-001',
  generateBusinessProspectId: () => 'bp-001',
}));

vi.mock('../DisputeIntakeService', () => ({
  default: {
    generateIntakeLink: vi.fn().mockResolvedValue({
      intakeId: 'mdint-access-1',
      token: 'tok',
      url: 'http://localhost:3000/recovery/intake?token=tok',
      shortUrl: 'http://localhost:3000/i/ABC123',
    }),
  },
}));

import RepairFulfillmentService from '../RepairFulfillmentService';
import DisputeIntakeService from '../DisputeIntakeService';

// ====================
// FIXTURES
// ====================

const trackACampaign = (rf: Record<string, any> | null = null) => ({
  id: 'mcamp-track-a',
  campaign_category: 'profile_repair',
  repair_track: 'standard',
  stage: 'paid',
  business_name: 'Joe\'s Plumbing',
  category: 'plumber',
  city: 'Austin',
  state: 'TX',
  tenant_id: 'tid-1',
  business_prospect_id: 'bp-existing',
  repair_fulfillment: rf,
});

// ====================
// TESTS
// ====================

describe('RepairFulfillmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── updateRepairFulfillment (W2) ────────────────────────────────

  describe('updateRepairFulfillment', () => {
    it('rejects non-Track-A campaigns', async () => {
      mockCampaigns.findUnique.mockResolvedValue({
        ...trackACampaign(),
        campaign_category: 'review_management',
      });
      await expect(
        RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', { tier: 'standard' }),
      ).rejects.toThrow('Track A');
    });

    it('rejects escalated-track campaigns', async () => {
      mockCampaigns.findUnique.mockResolvedValue({
        ...trackACampaign(),
        repair_track: 'escalated',
      });
      await expect(
        RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', { tier: 'standard' }),
      ).rejects.toThrow('Track A');
    });

    it('rejects invalid tier and mode values', async () => {
      mockCampaigns.findUnique.mockResolvedValue(trackACampaign());
      await expect(
        RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', { tier: 'enterprise' as any }),
      ).rejects.toThrow('tier must be');
      await expect(
        RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', { mode: 'managed' as any }),
      ).rejects.toThrow("mode must be");
    });

    it('rejects DIY mode on premium tier', async () => {
      mockCampaigns.findUnique.mockResolvedValue(trackACampaign());
      await expect(
        RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', { tier: 'premium', mode: 'diy' }),
      ).rejects.toThrow('DFY-only');
    });

    it('rejects platforms outside the tier scope', async () => {
      mockCampaigns.findUnique.mockResolvedValue(trackACampaign());
      await expect(
        RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', {
          tier: 'standard',
          platforms: ['google', 'apple_maps'],
        }),
      ).rejects.toThrow('out of scope');
    });

    it('requires a tier before platforms', async () => {
      mockCampaigns.findUnique.mockResolvedValue(trackACampaign());
      await expect(
        RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', {
          platforms: ['google'],
        }),
      ).rejects.toThrow('Set a tier');
    });

    it('defaults platforms to tier scope ∩ audit affected_platforms', async () => {
      mockCampaigns.findUnique.mockResolvedValue(trackACampaign());
      mockAudits.findMany.mockResolvedValue([
        {
          platform: 'business_analysis',
          audit_data: { scope: { affected_platforms: ['Google', 'Yelp'] } },
        },
      ]);
      mockCampaigns.update.mockResolvedValue({});

      const result = await RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', {
        tier: 'standard',
        mode: 'diy',
      });

      expect(result.repair_fulfillment.platforms).toEqual(['google', 'yelp']);
      expect(result.repair_fulfillment.sla_hours).toBe(48);
    });

    it('falls back to full tier scope when the audit intersection is empty', async () => {
      mockCampaigns.findUnique.mockResolvedValue(trackACampaign());
      mockAudits.findMany.mockResolvedValue([]);
      mockCampaigns.update.mockResolvedValue({});

      const result = await RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', {
        tier: 'premium',
        mode: 'dfy',
      });

      expect(result.repair_fulfillment.platforms).toEqual(
        expect.arrayContaining(['google', 'facebook', 'yelp', 'bbb', 'apple_maps', 'bing_places']),
      );
      expect(result.repair_fulfillment.sla_hours).toBe(24);
    });

    it('deep-merges: adapter-owned keys survive a config PATCH', async () => {
      const existingRf = {
        tier: 'standard',
        mode: 'diy',
        platforms: ['google'],
        canonical_nap: { business_name: 'Joe\'s Plumbing', phone: '512-555-0100' },
        platform_status: { google: { status: 'verified', verified_at: '2026-01-01T00:00:00Z' } },
        access_intake_id: 'mdint-9',
        access_collected_at: '2026-01-01T00:00:00Z',
        sla_due_at: '2026-01-03T00:00:00Z',
        seed_id: 'seed-1',
        completion: { report_deliverable_id: 'md-1' },
      };
      mockCampaigns.findUnique.mockResolvedValue(trackACampaign(existingRf));
      mockAudits.findMany.mockResolvedValue([]);
      mockCampaigns.update.mockResolvedValue({});

      const result = await RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', {
        platforms: ['google', 'bbb'],
      });

      const rf = result.repair_fulfillment;
      expect(rf.platforms).toEqual(['google', 'bbb']);
      // Adapter-owned keys preserved
      expect(rf.canonical_nap).toEqual(existingRf.canonical_nap);
      expect(rf.platform_status).toEqual(existingRf.platform_status);
      expect(rf.access_intake_id).toBe('mdint-9');
      expect(rf.sla_due_at).toBe('2026-01-03T00:00:00Z');
      expect(rf.seed_id).toBe('seed-1');
      expect(rf.completion).toEqual({ report_deliverable_id: 'md-1' });
    });

    it('locks mode once access_collected_at is set', async () => {
      mockCampaigns.findUnique.mockResolvedValue(
        trackACampaign({
          tier: 'standard',
          mode: 'dfy',
          access_collected_at: '2026-01-01T00:00:00Z',
        }),
      );
      await expect(
        RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', { mode: 'diy' }),
      ).rejects.toThrow('mode_locked');
    });

    it('allows re-asserting the same mode after access collection', async () => {
      const rf = { tier: 'standard', mode: 'dfy', access_collected_at: '2026-01-01T00:00:00Z' };
      mockCampaigns.findUnique.mockResolvedValue(trackACampaign(rf));
      mockCampaigns.update.mockResolvedValue({});
      mockDisputeIntake.findFirst.mockResolvedValue({ id: 'mdint-access-1' });

      const result = await RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', { mode: 'dfy' });
      expect(result.repair_fulfillment.mode).toBe('dfy');
    });

    it('mints the DFY access intake opportunistically on mode=dfy', async () => {
      mockCampaigns.findUnique.mockResolvedValue(trackACampaign({ tier: 'standard' }));
      mockAudits.findMany.mockResolvedValue([]);
      mockCampaigns.update.mockResolvedValue({});
      mockDisputeIntake.findFirst.mockResolvedValue(null);

      const result = await RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', {
        mode: 'dfy',
      });

      expect(DisputeIntakeService.generateIntakeLink).toHaveBeenCalledWith(
        'mcamp-track-a', undefined, 'profile_repair_access',
      );
      expect(result.access_intake?.shortUrl).toBe('http://localhost:3000/i/ABC123');
      expect(result.repair_fulfillment.access_intake_id).toBe('mdint-access-1');
    });

    it('does not re-mint the access intake when one already exists', async () => {
      mockCampaigns.findUnique.mockResolvedValue(trackACampaign({ tier: 'standard' }));
      mockAudits.findMany.mockResolvedValue([]);
      mockCampaigns.update.mockResolvedValue({});
      mockDisputeIntake.findFirst.mockResolvedValue({ id: 'mdint-access-1' });

      await RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', { mode: 'dfy' });

      expect(DisputeIntakeService.generateIntakeLink).not.toHaveBeenCalled();
    });

    it('does not mint the access intake for DIY mode', async () => {
      mockCampaigns.findUnique.mockResolvedValue(trackACampaign({ tier: 'standard' }));
      mockAudits.findMany.mockResolvedValue([]);
      mockCampaigns.update.mockResolvedValue({});

      await RepairFulfillmentService.updateRepairFulfillment('mcamp-track-a', { mode: 'diy' });

      expect(DisputeIntakeService.generateIntakeLink).not.toHaveBeenCalled();
    });
  });

  // ─── updatePlatformStatus (W7b) ──────────────────────────────────

  describe('updatePlatformStatus', () => {
    it('rejects unknown status values', async () => {
      await expect(
        RepairFulfillmentService.updatePlatformStatus('mcamp-track-a', 'google', { status: 'bogus' as any }),
      ).rejects.toThrow('status must be one of');
    });

    it('stamps verified_at on first verification only', async () => {
      mockCampaigns.findUnique.mockResolvedValue(
        trackACampaign({ platform_status: { google: { status: 'in_progress' } } }),
      );
      mockCampaigns.update.mockResolvedValue({});

      const r1 = await RepairFulfillmentService.updatePlatformStatus('mcamp-track-a', 'google', { status: 'verified' });
      expect(r1.entry.status).toBe('verified');
      expect(r1.entry.verified_at).toBeTruthy();

      // Second verification keeps the original verified_at
      const firstStamp = r1.entry.verified_at;
      mockCampaigns.findUnique.mockResolvedValue(
        trackACampaign({ platform_status: { google: r1.entry } }),
      );
      const r2 = await RepairFulfillmentService.updatePlatformStatus('mcamp-track-a', 'google', { status: 'verified' });
      expect(r2.entry.verified_at).toBe(firstStamp);
    });

    it('merges note without clobbering other entry keys', async () => {
      mockCampaigns.findUnique.mockResolvedValue(
        trackACampaign({
          platform_status: { google: { status: 'access_granted', access_answer: 'granted' } },
        }),
      );
      mockCampaigns.update.mockResolvedValue({});

      const r = await RepairFulfillmentService.updatePlatformStatus('mcamp-track-a', 'google', {
        status: 'in_progress',
        note: 'Operator started fixes',
      });
      expect(r.entry.access_answer).toBe('granted');
      expect(r.entry.note).toBe('Operator started fixes');
      expect(r.entry.updated_at).toBeTruthy();
    });
  });

  // ─── escalatePlatform (W7c) ──────────────────────────────────────

  describe('escalatePlatform', () => {
    it('creates sibling + stamps parent platform atomically in one transaction', async () => {
      const parent = trackACampaign({ platform_status: { google: { status: 'blocked' } } });
      mockCampaigns.findUnique.mockResolvedValue(parent);
      mockCampaigns.create.mockResolvedValue({ id: 'mcamp-sibling-001' });
      mockCampaigns.update.mockResolvedValue({});
      mockStageHistory.create.mockResolvedValue({});

      const result = await RepairFulfillmentService.escalatePlatform('mcamp-track-a', 'google', {
        issueType: 'suspension',
        notes: 'Owner cannot access listing',
      });

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(mockCampaigns.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'mcamp-sibling-001',
            repair_track: 'escalated',
            repair_issue_type: 'suspension',
            stage: 'audit_identified',
            business_prospect_id: 'bp-existing',
            is_primary_sibling: false,
            tenant_id: 'tid-1',
          }),
        }),
      );
      // Parent platform_status stamped escalated in the same tx
      expect(result.platform_status.status).toBe('escalated');
      expect(result.platform_status.escalated_campaign_id).toBe('mcamp-sibling-001');
      // Sibling carries escalated_from for loop-back
      const createData = mockCampaigns.create.mock.calls[0][0].data;
      expect(createData.repair_fulfillment.escalated_from).toEqual(
        expect.objectContaining({ campaign_id: 'mcamp-track-a', platform: 'google' }),
      );
    });

    it('prevents double-spawn on an already-escalated platform', async () => {
      mockCampaigns.findUnique.mockResolvedValue(
        trackACampaign({
          platform_status: { google: { status: 'escalated', escalated_campaign_id: 'mcamp-prev' } },
        }),
      );

      await expect(
        RepairFulfillmentService.escalatePlatform('mcamp-track-a', 'google', { issueType: 'suspension' }),
      ).rejects.toThrow('already escalated');
      expect(mockCampaigns.create).not.toHaveBeenCalled();
    });

    it('mints a business_prospect_id when the parent lacks one', async () => {
      const parent = { ...trackACampaign({ platform_status: {} }), business_prospect_id: null };
      mockCampaigns.findUnique.mockResolvedValue(parent);
      mockCampaigns.create.mockResolvedValue({ id: 'mcamp-sibling-001' });
      mockCampaigns.update.mockResolvedValue({});
      mockStageHistory.create.mockResolvedValue({});

      await RepairFulfillmentService.escalatePlatform('mcamp-track-a', 'yelp', { issueType: 'duplicate_listing' });

      // First update stamps the prospect id + primary flag on the parent
      expect(mockCampaigns.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ business_prospect_id: 'bp-001', is_primary_sibling: true }),
        }),
      );
    });

    it('rejects escalation on non-Track-A campaigns', async () => {
      mockCampaigns.findUnique.mockResolvedValue({ ...trackACampaign(), repair_track: 'escalated' });
      await expect(
        RepairFulfillmentService.escalatePlatform('mcamp-track-a', 'google', { issueType: 'suspension' }),
      ).rejects.toThrow('Track A');
    });
  });

  // ─── buildCompletionReport (W8) ──────────────────────────────────

  describe('buildCompletionReport', () => {
    it('assembles platform outcomes + remaining actions + retainer pitch', async () => {
      mockCampaigns.findUnique.mockResolvedValue(
        trackACampaign({
          tier: 'standard',
          mode: 'dfy',
          sla_hours: 48,
          sla_due_at: '2026-01-03T00:00:00Z',
          platforms: ['google', 'yelp', 'bbb'],
          canonical_nap: { business_name: 'Joe\'s Plumbing', phone: '512-555-0100' },
          platform_status: {
            google: { status: 'verified', verified_at: '2026-01-02T00:00:00Z' },
            yelp: { status: 'escalated', escalated_campaign_id: 'mcamp-sib-9' },
            bbb: { status: 'awaiting_access' },
          },
        }),
      );
      mockChecklistProgress.findMany.mockResolvedValue([
        { step_id: 'step-1', completed_at: new Date('2026-01-02'), note: null },
      ]);
      mockChecklistSteps.findMany.mockResolvedValue([
        { id: 'step-1', title: 'Verify Google listing' },
      ]);
      mockDisputeIntake.findFirst.mockResolvedValue({ _count: { mkt_dispute_attachments: 2 } });

      const { content, remaining_actions } = await RepairFulfillmentService.buildCompletionReport('mcamp-track-a');

      expect(content).toContain('Package: STANDARD (DFY)');
      expect(content).toContain('Joe\'s Plumbing');
      expect(content).toContain('google — verified');
      expect(content).toContain('mcamp-sib-9');
      expect(content).toContain('Verify Google listing');
      expect(content).toContain('Evidence attachments on file: 2');
      expect(remaining_actions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('yelp'),
          expect.stringContaining('bbb'),
        ]),
      );
      expect(content).toContain('listing-synchronization retainer');
    });

    it('reports all-verified when no remaining actions', async () => {
      mockCampaigns.findUnique.mockResolvedValue(
        trackACampaign({
          mode: 'diy',
          platforms: ['google'],
          platform_status: { google: { status: 'done' } },
        }),
      );
      mockChecklistProgress.findMany.mockResolvedValue([]);
      mockChecklistSteps.findMany.mockResolvedValue([]);
      mockDisputeIntake.findFirst.mockResolvedValue(null);

      const { content, remaining_actions } = await RepairFulfillmentService.buildCompletionReport('mcamp-track-a');

      expect(remaining_actions).toEqual([]);
      expect(content).toContain('All in-scope platforms verified');
    });
  });

  // ─── stampCompletionReport (W8) ──────────────────────────────────

  describe('stampCompletionReport', () => {
    it('deep-merges completion into repair_fulfillment', async () => {
      mockCampaigns.findUnique.mockResolvedValue({
        repair_fulfillment: { tier: 'standard', platform_status: { google: { status: 'done' } } },
      });
      mockCampaigns.update.mockResolvedValue({});

      await RepairFulfillmentService.stampCompletionReport('mcamp-track-a', 'md-report-1', ['yelp: pending']);

      expect(mockCampaigns.update).toHaveBeenCalledWith({
        where: { id: 'mcamp-track-a' },
        data: {
          repair_fulfillment: expect.objectContaining({
            tier: 'standard',
            platform_status: { google: { status: 'done' } },
            completion: {
              report_deliverable_id: 'md-report-1',
              remaining_actions: ['yelp: pending'],
            },
          }),
        },
      });
    });
  });
});
