import { describe, it, expect, vi, beforeEach } from 'vitest';

// ====================
// MOCKS
// ====================

const {
  mockCampaigns,
  mockOutreachLog,
} = vi.hoisted(() => ({
  mockCampaigns: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  mockOutreachLog: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaigns,
    mkt_outreach_log: mockOutreachLog,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock MarketingOutreachService
const mockLogContact = vi.fn().mockResolvedValue({});
vi.mock('../MarketingOutreachService', () => ({
  MarketingOutreachService: {
    getInstance: () => ({ logContact: mockLogContact }),
  },
}));

import { ReviewCascadeService } from '../ReviewCascadeService';

// ====================
// FIXTURES
// ====================

const DAY_MS = 24 * 60 * 60 * 1000;

function makeCampaign(opts: {
  stageEnteredDaysAgo?: number;
  email?: string | null;
  phone?: string | null;
  socialProfiles?: any[] | null;
  cascadeConfig?: any;
  stage?: string;
}) {
  return {
    id: 'mcamp-1',
    business_name: 'Test Business',
    stage: opts.stage || 'preview_built',
    stage_entered_at: new Date(Date.now() - (opts.stageEnteredDaysAgo ?? 0) * DAY_MS),
    email: opts.email === undefined ? 'owner@test.com' : opts.email,
    phone: opts.phone === undefined ? '+1234567890' : opts.phone,
    social_profiles: opts.socialProfiles === undefined ? [{ platform: 'instagram', url: 'https://instagram.com/test' }] : opts.socialProfiles,
    cascade_config: opts.cascadeConfig ?? null,
    last_contacted_at: null,
  };
}

// ====================
// TESTS
// ====================

describe('ReviewCascadeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Cascade firing ─────────────────────────────────────────────

  describe('run — cascade firing', () => {
    it('fires Day 1 email when elapsed >= 1 day and no prior cascade contacts', async () => {
      mockCampaigns.findMany.mockResolvedValue([makeCampaign({ stageEnteredDaysAgo: 1 })]);
      mockOutreachLog.findFirst.mockResolvedValue(null); // no latest contact
      mockOutreachLog.findMany.mockResolvedValue([]); // no prior cascade contacts

      const result = await ReviewCascadeService.getInstance().run();

      expect(result.fired).toBe(1);
      expect(mockLogContact).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: 'mcamp-1',
          contactChannel: 'email',
          notes: expect.stringContaining('Day 1'),
        }),
        undefined,
      );
    });

    it('fires Day 2 SMS when 1 prior cascade contact and elapsed >= 2 days', async () => {
      mockCampaigns.findMany.mockResolvedValue([makeCampaign({ stageEnteredDaysAgo: 3 })]);
      mockOutreachLog.findFirst.mockResolvedValue({
        outcome: 'left_message',
        contact_channel: 'email',
      });
      mockOutreachLog.findMany.mockResolvedValue([
        { contact_date: new Date(Date.now() - 2 * DAY_MS) },
      ]);

      const result = await ReviewCascadeService.getInstance().run();

      expect(result.fired).toBe(1);
      expect(mockLogContact).toHaveBeenCalledWith(
        expect.objectContaining({
          contactChannel: 'phone',
          notes: expect.stringContaining('Day 2'),
        }),
        undefined,
      );
    });

    it('fires Day 4 DM when 2 prior cascade contacts and elapsed >= 4 days', async () => {
      mockCampaigns.findMany.mockResolvedValue([makeCampaign({ stageEnteredDaysAgo: 5 })]);
      mockOutreachLog.findFirst.mockResolvedValue({
        outcome: 'left_message',
        contact_channel: 'phone',
      });
      mockOutreachLog.findMany.mockResolvedValue([
        { contact_date: new Date(Date.now() - 4 * DAY_MS) },
        { contact_date: new Date(Date.now() - 3 * DAY_MS) },
      ]);

      const result = await ReviewCascadeService.getInstance().run();

      expect(result.fired).toBe(1);
      expect(mockLogContact).toHaveBeenCalledWith(
        expect.objectContaining({
          contactChannel: 'social',
          notes: expect.stringContaining('Day 4'),
        }),
        undefined,
      );
    });

    it('returns exhausted=true when all steps have been fired', async () => {
      mockCampaigns.findMany.mockResolvedValue([makeCampaign({ stageEnteredDaysAgo: 10 })]);
      mockOutreachLog.findFirst.mockResolvedValue({
        outcome: 'left_message',
        contact_channel: 'social',
      });
      mockOutreachLog.findMany.mockResolvedValue([
        { contact_date: new Date() },
        { contact_date: new Date() },
        { contact_date: new Date() },
      ]);

      const result = await ReviewCascadeService.getInstance().run();

      expect(result.fired).toBe(0);
      expect(result.exhausted).toBe(1);
      expect(mockLogContact).not.toHaveBeenCalled();
    });

    it('does not fire when latest contact was a response (reached/interested)', async () => {
      mockCampaigns.findMany.mockResolvedValue([makeCampaign({ stageEnteredDaysAgo: 1 })]);
      mockOutreachLog.findFirst.mockResolvedValue({
        outcome: 'reached',
        contact_channel: 'email',
      });
      mockOutreachLog.findMany.mockResolvedValue([]);

      const result = await ReviewCascadeService.getInstance().run();

      expect(result.fired).toBe(0);
      expect(mockLogContact).not.toHaveBeenCalled();
    });
  });

  // ─── Channel availability ───────────────────────────────────────

  describe('run — channel availability', () => {
    it('skips Day 2 SMS when phone is null (logs skipped step)', async () => {
      mockCampaigns.findMany.mockResolvedValue([
        makeCampaign({ stageEnteredDaysAgo: 3, phone: null }),
      ]);
      mockOutreachLog.findFirst.mockResolvedValue({
        outcome: 'left_message',
        contact_channel: 'email',
      });
      mockOutreachLog.findMany.mockResolvedValue([
        { contact_date: new Date(Date.now() - 2 * DAY_MS) },
      ]);

      const result = await ReviewCascadeService.getInstance().run();

      expect(result.fired).toBe(0);
      // Should log a SKIPPED contact so we don't re-evaluate every pass
      expect(mockLogContact).toHaveBeenCalledWith(
        expect.objectContaining({
          contactChannel: 'phone',
          notes: expect.stringContaining('SKIPPED'),
        }),
        undefined,
      );
    });

    it('skips Day 4 DM when social_profiles is empty', async () => {
      mockCampaigns.findMany.mockResolvedValue([
        makeCampaign({ stageEnteredDaysAgo: 5, socialProfiles: [] }),
      ]);
      mockOutreachLog.findFirst.mockResolvedValue({
        outcome: 'left_message',
        contact_channel: 'phone',
      });
      mockOutreachLog.findMany.mockResolvedValue([
        { contact_date: new Date() },
        { contact_date: new Date() },
      ]);

      const result = await ReviewCascadeService.getInstance().run();

      expect(result.fired).toBe(0);
      expect(mockLogContact).toHaveBeenCalledWith(
        expect.objectContaining({
          contactChannel: 'social',
          notes: expect.stringContaining('SKIPPED'),
        }),
        undefined,
      );
    });
  });

  // ─── Empty / no campaigns ───────────────────────────────────────

  it('returns zeros when no cascade-enabled campaigns', async () => {
    mockCampaigns.findMany.mockResolvedValue([]);

    const result = await ReviewCascadeService.getInstance().run();

    expect(result.fired).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.exhausted).toBe(0);
  });

  // ─── Admin operations ───────────────────────────────────────────

  describe('enableCascade', () => {
    it('enables cascade with default config when no config provided', async () => {
      mockCampaigns.update.mockResolvedValue({
        id: 'mcamp-1',
        cascade_enabled: true,
        cascade_config: null,
      });

      const result = await ReviewCascadeService.getInstance().enableCascade('mcamp-1');

      expect(result.cascade_enabled).toBe(true);
      expect(mockCampaigns.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mcamp-1' },
          data: { cascade_enabled: true, cascade_config: null },
        }),
      );
    });

    it('enables cascade with custom config when provided', async () => {
      const customConfig = {
        steps: [
          { day: 1, channel: 'email', label: 'Custom Day 1' },
          { day: 3, channel: 'phone', label: 'Custom Day 3' },
        ],
      };
      mockCampaigns.update.mockResolvedValue({
        id: 'mcamp-1',
        cascade_enabled: true,
        cascade_config: customConfig,
      });

      const result = await ReviewCascadeService.getInstance().enableCascade('mcamp-1', customConfig);

      expect(result.cascade_enabled).toBe(true);
      expect(mockCampaigns.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { cascade_enabled: true, cascade_config: customConfig },
        }),
      );
    });
  });

  describe('disableCascade', () => {
    it('disables cascade for a campaign', async () => {
      mockCampaigns.update.mockResolvedValue({
        id: 'mcamp-1',
        cascade_enabled: false,
        cascade_config: null,
      });

      const result = await ReviewCascadeService.getInstance().disableCascade('mcamp-1');

      expect(result.cascade_enabled).toBe(false);
      expect(mockCampaigns.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mcamp-1' },
          data: { cascade_enabled: false },
        }),
      );
    });
  });

  describe('getCascadeStatus', () => {
    it('returns cascade status with step counts', async () => {
      mockCampaigns.findUnique.mockResolvedValue({
        id: 'mcamp-1',
        cascade_enabled: true,
        cascade_config: null,
      });
      mockOutreachLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          contact_date: new Date(),
          contact_channel: 'email',
          outcome: 'left_message',
          notes: 'Review cascade — Day 1: Primary Email',
        },
      ]);

      const result = await ReviewCascadeService.getInstance().getCascadeStatus('mcamp-1');

      expect(result.cascadeEnabled).toBe(true);
      expect(result.stepsFired).toBe(1);
      expect(result.stepsRemaining).toBe(2);
      expect(result.totalSteps).toBe(3);
      expect(result.contacts).toHaveLength(1);
    });

    it('throws if campaign not found', async () => {
      mockCampaigns.findUnique.mockResolvedValue(null);

      await expect(ReviewCascadeService.getInstance().getCascadeStatus('nonexistent')).rejects.toThrow('not found');
    });
  });
});
