import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────
// Prisma is mocked at the model level — mkt_prospect_queue gets the methods
// the service calls (findUnique, findFirst, findMany, create, update, count).
// mkt_campaigns_list is mocked for the parent-campaign lookup + the
// campaign-exists (AC84) check + the create-campaign ownership carry-forward
// update. The two derive services are mocked at the module level.

const {
  mockQueue,
  mockCampaigns,
} = vi.hoisted(() => ({
  mockQueue: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  mockCampaigns: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_prospect_queue: mockQueue,
    mkt_campaigns_list: mockCampaigns,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateProspectQueueId: () => 'pque-test-001',
}));

// Mock the two derive services the create-campaign path replays through.
// MarketingCampaignService is a default-export singleton instance.
vi.mock('../MarketingCampaignService', () => ({
  default: {
    deriveBusinessCampaign: vi.fn(),
    createCampaign: vi.fn(),
  },
}));

// MarketingHotProspectService is a named-export class with getInstance().
// The mock must return a STABLE singleton from getInstance() so the test's
// .mockResolvedValue is set on the same vi.fn() the service calls.
const hotProspectMock = {
  deriveBusinessCampaignFromScanBusiness: vi.fn(),
};
vi.mock('../MarketingHotProspectService', () => ({
  MarketingHotProspectService: {
    getInstance: () => hotProspectMock,
  },
}));

import MarketingProspectQueueService from '../MarketingProspectQueueService';
import MarketingCampaignService from '../MarketingCampaignService';
import { MarketingHotProspectService } from '../MarketingHotProspectService';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const PARENT_CAMPAIGN_ID = 'mcamp-parent-001';
const ACTING_USER_ID = 'uid-admin-001';

const parentCampaign = (overrides: Partial<any> = {}) => ({
  id: PARENT_CAMPAIGN_ID,
  scope: 'city',
  category: 'restaurant',
  city: 'Austin',
  state: 'TX',
  ...overrides,
});

const scanSnapshot = (overrides: Partial<any> = {}) => ({
  business_name: 'Joe Pizza',
  category: 'restaurant',
  detected_signals: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS'],
  platforms: { google: { rating: 4.2, total_reviews: 87 } },
  combined_review_metrics: { observable_total_reviews: 87 },
  ...overrides,
});

const thinSnapshot = (overrides: Partial<any> = {}) => ({
  business_name: 'Sushi Bar',
  rating: 4.5,
  review_count: 120,
  location: 'Downtown Austin',
  detected_signals: ['RA_NO_WEBSITE'],
  ...overrides,
});

const queueRow = (overrides: Partial<any> = {}) => ({
  id: 'pque-test-001',
  business_name: 'Joe Pizza',
  category: 'restaurant',
  city: 'Austin',
  state: 'TX',
  source_kind: 'scan_unmatched',
  source_scope: 'city',
  source_campaign_id: PARENT_CAMPAIGN_ID,
  source_audit_id: 'maud-001',
  source_execution_id: 'mexec-001',
  audit_date: new Date('2026-07-28'),
  business_snapshot: scanSnapshot(),
  detected_signals: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS'],
  signal_count: 2,
  rating: 4.2,
  review_count: 87,
  status: 'queued',
  priority: 'normal',
  note: null,
  queued_by: ACTING_USER_ID,
  assigned_to: null,
  assigned_at: null,
  processed_campaign_id: null,
  processed_at: null,
  dismissed_reason: null,
  created_at: new Date('2026-08-03'),
  updated_at: new Date('2026-08-03'),
  ...overrides,
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('MarketingProspectQueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing queue entry, no existing campaign, parent exists.
    mockQueue.findFirst.mockResolvedValue(null);
    mockCampaigns.findFirst.mockResolvedValue(null);
    mockCampaigns.findUnique.mockResolvedValue(parentCampaign());
    mockQueue.count.mockResolvedValue(0);
  });

  // ─── addToQueue ────────────────────────────────────────────────────────

  describe('addToQueue', () => {
    it('creates a queue entry and denormalizes signals/rating from the snapshot', async () => {
      mockQueue.create.mockImplementation(({ data }: any) =>
        Promise.resolve(queueRow({ ...data, id: 'pque-test-001' })),
      );

      const result = await MarketingProspectQueueService.addToQueue({
        business_name: 'Joe Pizza',
        source_kind: 'scan_unmatched',
        source_campaign_id: PARENT_CAMPAIGN_ID,
        business_snapshot: scanSnapshot(),
        queuedBy: ACTING_USER_ID,
      });

      expect(result.kind).toBe('created');
      expect(result.created).toBe(true);
      expect(mockQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'pque-test-001',
            business_name: 'Joe Pizza',
            source_scope: 'city',
            detected_signals: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS'],
            signal_count: 2,
            rating: 4.2,
            review_count: 87,
            status: 'queued',
            priority: 'normal',
            queued_by: ACTING_USER_ID,
          }),
        }),
      );
    });

    it('returns the existing entry (created: false) when a queued row already exists for the triple', async () => {
      const existing = queueRow({ id: 'pque-existing-001' });
      mockQueue.findFirst.mockResolvedValue(existing);

      const result = await MarketingProspectQueueService.addToQueue({
        business_name: 'Joe Pizza',
        source_kind: 'scan_unmatched',
        source_campaign_id: PARENT_CAMPAIGN_ID,
        business_snapshot: scanSnapshot(),
      });

      expect(result.kind).toBe('already_queued');
      expect(result.created).toBe(false);
      expect(mockQueue.create).not.toHaveBeenCalled();
    });

    it('returns campaign_exists when a business-scope campaign already exists (AC84)', async () => {
      mockCampaigns.findFirst.mockResolvedValue({ id: 'mcamp-existing-001' });

      const result = await MarketingProspectQueueService.addToQueue({
        business_name: 'Joe Pizza',
        source_kind: 'scan_unmatched',
        source_campaign_id: PARENT_CAMPAIGN_ID,
        business_snapshot: scanSnapshot(),
      });

      expect(result.kind).toBe('campaign_exists');
      expect((result as any).campaignId).toBe('mcamp-existing-001');
      expect(mockQueue.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the source campaign does not exist', async () => {
      mockCampaigns.findUnique.mockResolvedValue(null);

      await expect(
        MarketingProspectQueueService.addToQueue({
          business_name: 'Joe Pizza',
          source_kind: 'scan_unmatched',
          source_campaign_id: 'mcamp-missing',
          business_snapshot: scanSnapshot(),
        }),
      ).rejects.toThrow(/not found/i);
    });

    it('inherits category/city/state from the parent when not supplied', async () => {
      mockQueue.create.mockImplementation(({ data }: any) =>
        Promise.resolve(queueRow({ ...data })),
      );

      await MarketingProspectQueueService.addToQueue({
        business_name: 'Joe Pizza',
        source_kind: 'scan_unmatched',
        source_campaign_id: PARENT_CAMPAIGN_ID,
        business_snapshot: scanSnapshot(),
      });

      expect(mockQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'restaurant',
            city: 'Austin',
            state: 'TX',
            source_scope: 'city',
          }),
        }),
      );
    });
  });

  // ─── list ──────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns entries ordered by status, priority, signal_count, created_at and includes queuedCount', async () => {
      const rows = [queueRow({ id: 'pque-1' }), queueRow({ id: 'pque-2', priority: 'high' })];
      mockQueue.findMany.mockResolvedValue(rows);
      mockQueue.count.mockResolvedValue(2);

      const result = await MarketingProspectQueueService.list({});

      expect(result.entries).toHaveLength(2);
      expect(result.queuedCount).toBe(2);
      expect(mockQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { status: 'asc' },
            { priority: 'desc' },
            { signal_count: 'desc' },
            { created_at: 'asc' },
          ],
          take: 100,
        }),
      );
    });

    it('queuedCount reflects only status=queued regardless of the status filter', async () => {
      mockQueue.findMany.mockResolvedValue([]);
      mockQueue.count.mockResolvedValue(5);

      const result = await MarketingProspectQueueService.list({ status: ['campaign_created'] });

      expect(result.queuedCount).toBe(5);
      expect(mockQueue.count).toHaveBeenCalledWith({ where: { status: 'queued' } });
    });

    it('passes includeCampaigns through to the Prisma include when set', async () => {
      mockQueue.findMany.mockResolvedValue([]);

      await MarketingProspectQueueService.list({ includeCampaigns: true });

      expect(mockQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            mkt_campaigns_list_mkt_prospect_queue_processed_campaign_idTomkt_campaigns_list: {
              select: {
                id: true,
                stage: true,
                category: true,
                repair_track: true,
                is_hot_prospect: true,
                stage_entered_at: true,
              },
            },
          },
        }),
      );
    });

    it('resolves assigned_to=unassigned to a null filter', async () => {
      mockQueue.findMany.mockResolvedValue([]);

      await MarketingProspectQueueService.list({ assigned_to: 'unassigned' });

      expect(mockQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ assigned_to: null }) }),
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────

  describe('update', () => {
    it('patches priority, note, and assigned_to on a queued entry', async () => {
      mockQueue.findUnique.mockResolvedValue(queueRow());
      mockQueue.update.mockImplementation(({ where, data }: any) =>
        Promise.resolve(queueRow({ ...data, id: where.id })),
      );

      const updated = await MarketingProspectQueueService.update('pque-test-001', {
        priority: 'high',
        note: 'call after Tuesday',
        assigned_to: ACTING_USER_ID,
      });

      expect(updated.priority).toBe('high');
      expect(updated.note).toBe('call after Tuesday');
      expect(mockQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pque-test-001' },
          data: expect.objectContaining({
            priority: 'high',
            note: 'call after Tuesday',
            assigned_to: ACTING_USER_ID,
            assigned_at: expect.any(Date),
          }),
        }),
      );
    });

    it('clears assigned_to and assigned_at when assigned_to is null', async () => {
      mockQueue.findUnique.mockResolvedValue(queueRow({ assigned_to: ACTING_USER_ID }));
      mockQueue.update.mockResolvedValue(queueRow({ assigned_to: null }));

      await MarketingProspectQueueService.update('pque-test-001', { assigned_to: null });

      expect(mockQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assigned_to: null, assigned_at: null }),
        }),
      );
    });

    it('throws ConflictError when the entry is not in queued status', async () => {
      mockQueue.findUnique.mockResolvedValue(queueRow({ status: 'campaign_created' }));

      await expect(
        MarketingProspectQueueService.update('pque-test-001', { priority: 'high' }),
      ).rejects.toThrow(/not editable/i);
    });

    it('throws NotFoundError when the entry does not exist', async () => {
      mockQueue.findUnique.mockResolvedValue(null);

      await expect(
        MarketingProspectQueueService.update('pque-missing', { priority: 'high' }),
      ).rejects.toThrow(/not found/i);
    });
  });

  // ─── createCampaignFromQueue ───────────────────────────────────────────

  describe('createCampaignFromQueue', () => {
    it('replays a scan_unmatched entry through deriveBusinessCampaignFromScanBusiness and marks it processed', async () => {
      const entry = queueRow({ source_kind: 'scan_unmatched', assigned_to: ACTING_USER_ID });
      mockQueue.findUnique.mockResolvedValue(entry);
      const newCampaign = { id: 'mcamp-child-001', assigned_to: null };
      (MarketingHotProspectService as any).getInstance().deriveBusinessCampaignFromScanBusiness.mockResolvedValue({
        campaign: newCampaign,
        created: true,
      });
      mockQueue.update.mockImplementation(({ where, data }: any) =>
        Promise.resolve({ ...entry, ...data, id: where.id }),
      );

      const result = await MarketingProspectQueueService.createCampaignFromQueue({
        queueEntryId: 'pque-test-001',
        actingUserId: ACTING_USER_ID,
      });

      expect(result.created).toBe(true);
      expect(result.campaign.id).toBe('mcamp-child-001');
      // Ownership carried forward: entry had an assignee → campaign updated.
      expect(mockCampaigns.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mcamp-child-001' },
          data: { assigned_to: ACTING_USER_ID },
        }),
      );
      // Entry marked processed.
      expect(mockQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pque-test-001' },
          data: expect.objectContaining({
            status: 'campaign_created',
            processed_campaign_id: 'mcamp-child-001',
            processed_at: expect.any(Date),
          }),
        }),
      );
    });

    it('replays a category_analysis entry through deriveBusinessCampaign (thin path)', async () => {
      const entry = queueRow({
        business_name: 'Sushi Bar',
        source_kind: 'category_analysis',
        business_snapshot: thinSnapshot(),
        detected_signals: ['RA_NO_WEBSITE'],
        signal_count: 1,
        rating: 4.5,
        review_count: 120,
        assigned_to: null,
      });
      mockQueue.findUnique.mockResolvedValue(entry);
      const newCampaign = { id: 'mcamp-child-002', assigned_to: ACTING_USER_ID };
      (MarketingCampaignService as any).deriveBusinessCampaign.mockResolvedValue(newCampaign);
      mockQueue.update.mockResolvedValue({ ...entry, status: 'campaign_created', processed_campaign_id: 'mcamp-child-002' });

      const result = await MarketingProspectQueueService.createCampaignFromQueue({
        queueEntryId: 'pque-test-001',
        actingUserId: ACTING_USER_ID,
      });

      expect(result.campaign.id).toBe('mcamp-child-002');
      expect(MarketingCampaignService.deriveBusinessCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: PARENT_CAMPAIGN_ID,
          businessName: 'Sushi Bar',
          rating: 4.5,
          reviewCount: 120,
          detectedSignals: ['RA_NO_WEBSITE'],
          assignedTo: ACTING_USER_ID, // entry unassigned → falls back to acting user
        }),
        undefined,
      );
    });

    it('is idempotent — returns the existing campaign on repeat calls', async () => {
      const entry = queueRow({
        status: 'campaign_created',
        processed_campaign_id: 'mcamp-child-001',
      });
      mockQueue.findUnique.mockResolvedValue(entry);
      mockCampaigns.findUnique.mockResolvedValue({ id: 'mcamp-child-001', stage: 'seek' });

      const result = await MarketingProspectQueueService.createCampaignFromQueue({
        queueEntryId: 'pque-test-001',
        actingUserId: ACTING_USER_ID,
      });

      expect(result.created).toBe(false);
      expect(result.campaign.id).toBe('mcamp-child-001');
      // No derive service called, no update.
      expect((MarketingHotProspectService as any).getInstance().deriveBusinessCampaignFromScanBusiness).not.toHaveBeenCalled();
      expect(mockQueue.update).not.toHaveBeenCalled();
    });

    it('still marks the entry processed when the derive service returns created:false (AC84 collision)', async () => {
      const entry = queueRow({ source_kind: 'scan_unmatched', assigned_to: null });
      mockQueue.findUnique.mockResolvedValue(entry);
      const existingCampaign = { id: 'mcamp-preexisting-001', assigned_to: null };
      (MarketingHotProspectService as any).getInstance().deriveBusinessCampaignFromScanBusiness.mockResolvedValue({
        campaign: existingCampaign,
        created: false,
      });
      mockQueue.update.mockResolvedValue({ ...entry, status: 'campaign_created', processed_campaign_id: 'mcamp-preexisting-001' });

      const result = await MarketingProspectQueueService.createCampaignFromQueue({
        queueEntryId: 'pque-test-001',
        actingUserId: ACTING_USER_ID,
      });

      expect(result.created).toBe(false);
      expect(result.campaign.id).toBe('mcamp-preexisting-001');
      expect(mockQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'campaign_created',
            processed_campaign_id: 'mcamp-preexisting-001',
          }),
        }),
      );
    });

    it('treats source_campaign_id=null as a manual entry (no parent) and creates a business-scope campaign', async () => {
      // The manual path intentionally handles null source_campaign_id — there
      // is no parent to derive from, so the campaign is seeded from the queue
      // entry's own fields. This is the "manually queued prospect" flow.
      const entry = queueRow({
        source_kind: 'manual',
        source_campaign_id: null,
        source_scope: null,
        detected_signals: [],
        signal_count: 0,
        note: null,
      });
      mockQueue.findUnique.mockResolvedValue(entry);
      const newCampaign = { id: 'mcamp-manual-003' };
      (MarketingCampaignService as any).createCampaign.mockResolvedValue(newCampaign);
      mockQueue.update.mockImplementation(({ where, data }: any) =>
        Promise.resolve({ ...entry, ...data, id: where.id }),
      );

      const result = await MarketingProspectQueueService.createCampaignFromQueue({
        queueEntryId: 'pque-test-001',
        actingUserId: ACTING_USER_ID,
      });

      expect(result.created).toBe(true);
      expect(result.campaign.id).toBe('mcamp-manual-003');
      expect(MarketingCampaignService.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'business', businessName: 'Joe Pizza' }),
        undefined,
      );
    });

    // ─── operator note carryover ────────────────────────────────────────
    // The queue entry's `note` field (operator-entered at queue time) must
    // be carried forward into the campaign's `notes` on every spawn path.

    it('carries the operator note into the campaign on the manual path (no parent)', async () => {
      const entry = queueRow({
        source_kind: 'manual',
        source_campaign_id: null,
        source_scope: null,
        city: 'Indianapolis',
        category: 'African Grocery Store',
        detected_signals: [],
        signal_count: 0,
        note: 'Owner mentioned they are closing soon.',
      });
      mockQueue.findUnique.mockResolvedValue(entry);
      const newCampaign = { id: 'mcamp-manual-001', notes: '' };
      (MarketingCampaignService as any).createCampaign.mockResolvedValue(newCampaign);
      mockQueue.update.mockImplementation(({ where, data }: any) =>
        Promise.resolve({ ...entry, ...data, id: where.id }),
      );

      await MarketingProspectQueueService.createCampaignFromQueue({
        queueEntryId: 'pque-test-001',
        actingUserId: ACTING_USER_ID,
      });

      expect(MarketingCampaignService.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'business',
          businessName: 'Joe Pizza',
          notes: expect.stringContaining('Operator note: Owner mentioned they are closing soon.'),
        }),
        undefined,
      );
    });

    it('does not add an operator note line on the manual path when note is null', async () => {
      const entry = queueRow({
        source_kind: 'manual',
        source_campaign_id: null,
        source_scope: null,
        detected_signals: [],
        signal_count: 0,
        note: null,
      });
      mockQueue.findUnique.mockResolvedValue(entry);
      (MarketingCampaignService as any).createCampaign.mockResolvedValue({ id: 'mcamp-manual-002' });
      mockQueue.update.mockImplementation(({ where, data }: any) =>
        Promise.resolve({ ...entry, ...data, id: where.id }),
      );

      await MarketingProspectQueueService.createCampaignFromQueue({
        queueEntryId: 'pque-test-001',
        actingUserId: ACTING_USER_ID,
      });

      const callArgs = (MarketingCampaignService as any).createCampaign.mock.calls[0][0];
      expect(callArgs.notes).not.toContain('Operator note');
    });

    it('passes the operator note through to deriveBusinessCampaign on the thin path', async () => {
      const entry = queueRow({
        business_name: 'Sushi Bar',
        source_kind: 'category_analysis',
        business_snapshot: thinSnapshot(),
        detected_signals: ['RA_NO_WEBSITE'],
        signal_count: 1,
        note: 'Prefers email contact.',
      });
      mockQueue.findUnique.mockResolvedValue(entry);
      (MarketingCampaignService as any).deriveBusinessCampaign.mockResolvedValue({ id: 'mcamp-thin-001' });
      mockQueue.update.mockResolvedValue({ ...entry, status: 'campaign_created', processed_campaign_id: 'mcamp-thin-001' });

      await MarketingProspectQueueService.createCampaignFromQueue({
        queueEntryId: 'pque-test-001',
        actingUserId: ACTING_USER_ID,
      });

      expect(MarketingCampaignService.deriveBusinessCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: PARENT_CAMPAIGN_ID,
          businessName: 'Sushi Bar',
          note: 'Prefers email contact.',
        }),
        undefined,
      );
    });

    it('passes the operator note through to deriveBusinessCampaignFromScanBusiness on the scan path', async () => {
      const entry = queueRow({
        source_kind: 'scan_unmatched',
        note: 'High-intent — requested callback.',
      });
      mockQueue.findUnique.mockResolvedValue(entry);
      (MarketingHotProspectService as any).getInstance().deriveBusinessCampaignFromScanBusiness.mockResolvedValue({
        campaign: { id: 'mcamp-scan-001', assigned_to: null },
        created: true,
      });
      mockQueue.update.mockImplementation(({ where, data }: any) =>
        Promise.resolve({ ...entry, ...data, id: where.id }),
      );

      await MarketingProspectQueueService.createCampaignFromQueue({
        queueEntryId: 'pque-test-001',
        actingUserId: ACTING_USER_ID,
      });

      expect((MarketingHotProspectService as any).getInstance().deriveBusinessCampaignFromScanBusiness).toHaveBeenCalledWith(
        PARENT_CAMPAIGN_ID,
        scanSnapshot(),
        undefined,
        { note: 'High-intent — requested callback.' },
      );
    });
  });

  // ─── dismiss ───────────────────────────────────────────────────────────

  describe('dismiss', () => {
    it('sets status dismissed with a reason and processed_at', async () => {
      mockQueue.findUnique.mockResolvedValue(queueRow());
      mockQueue.update.mockImplementation(({ where, data }: any) =>
        Promise.resolve(queueRow({ ...data, id: where.id })),
      );

      const result = await MarketingProspectQueueService.dismiss({
        queueEntryId: 'pque-test-001',
        reason: 'bad_fit',
      });

      expect(result.status).toBe('dismissed');
      expect(result.dismissed_reason).toBe('bad_fit');
      expect(mockQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pque-test-001' },
          data: expect.objectContaining({
            status: 'dismissed',
            dismissed_reason: 'bad_fit',
            processed_at: expect.any(Date),
          }),
        }),
      );
    });

    it('is idempotent — dismissing an already-dismissed entry just updates the reason', async () => {
      mockQueue.findUnique.mockResolvedValue(queueRow({ status: 'dismissed', dismissed_reason: 'bad_fit' }));
      mockQueue.update.mockResolvedValue(queueRow({ status: 'dismissed', dismissed_reason: 'duplicate' }));

      const result = await MarketingProspectQueueService.dismiss({
        queueEntryId: 'pque-test-001',
        reason: 'duplicate',
      });

      expect(result.dismissed_reason).toBe('duplicate');
    });

    it('throws NotFoundError when the entry does not exist', async () => {
      mockQueue.findUnique.mockResolvedValue(null);

      await expect(
        MarketingProspectQueueService.dismiss({ queueEntryId: 'pque-missing' }),
      ).rejects.toThrow(/not found/i);
    });
  });
});
