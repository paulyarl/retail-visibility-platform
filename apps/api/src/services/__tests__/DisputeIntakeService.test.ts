import { describe, it, expect, vi, beforeEach } from 'vitest';

// ====================
// MOCKS
// ====================

const { mockDisputeIntake, mockCampaignsList, mockStageHistory } = vi.hoisted(() => ({
  mockDisputeIntake: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  mockDisputeAttachments: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  mockCampaignsList: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  mockStageHistory: { create: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_dispute_intake: mockDisputeIntake,
    mkt_dispute_attachments: mockDisputeAttachments,
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
  generateDisputeIntakeId: () => 'mdint-test-001',
  generateDisputeAttachmentId: () => 'mdatt-test-001',
  generateDisputeToken: () => 'test-dispute-token-32chars-aaaa',
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    recoveryIntakeTokenTtlDays: 7,
    recoveryMaxAttachmentBytes: 10 * 1024 * 1024,
    recoveryAllowedAttachmentMimes: ['application/pdf', 'image/png', 'image/jpeg'],
    webUrl: 'http://localhost:3000',
    supabaseUrl: 'https://test.supabase.co',
    supabaseServiceRoleKey: 'test-key',
  },
}));

vi.mock('../MarketingCategoryToneService', () => ({
  default: { getPresetByCategory: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../MarketingServiceCategoryService', () => ({
  default: { getLabel: vi.fn().mockResolvedValue(null) },
}));

import DisputeIntakeService from '../DisputeIntakeService';

// ====================
// HELPERS
// ====================

const futureDate = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const pastDate = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const mockCampaign = {
  id: 'mcamp-1',
  stage: 'awaiting_owner_intake',
  campaign_category: 'recovery_management',
  tenant_id: 'tid-1',
  business_name: 'Test Biz',
  category: 'plumber',
  city: 'Austin',
};

const mockIntakeRecord = {
  id: 'mdint-1',
  campaign_id: 'mcamp-1',
  tenant_id: 'tid-1',
  access_token: 'valid-token-32chars-aaaaaaaaaaaa',
  expires_at: futureDate(7),
  owner_statement: null,
  service_date: null,
  proposed_resolution: null,
  status_flag: null,
  submitted_at: null,
  viewed_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  mkt_dispute_attachments: [],
};

// ====================
// TESTS
// ====================

describe('DisputeIntakeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStageHistory.create.mockResolvedValue({});
  });

  // ─── resolveIntake ──────────────────────────────────────────────

  describe('resolveIntake', () => {
    it('returns context for a valid, non-expired, unsubmitted token', async () => {
      mockDisputeIntake.findUnique.mockResolvedValue(mockIntakeRecord);
      mockDisputeIntake.update.mockResolvedValue({ ...mockIntakeRecord, viewed_at: new Date() });
      mockCampaignsList.findUnique.mockResolvedValue(mockCampaign);

      const result = await DisputeIntakeService.getInstance().resolveIntake('valid-token');

      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('expired');
      if (result && !('expired' in result)) {
        expect(result.campaignId).toBe('mcamp-1');
        expect(result.businessName).toBe('Test Biz');
        expect(result.alreadySubmitted).toBe(false);
        expect(result.expired).toBe(false);
      }
    });

    it('returns { expired: true } for an expired token', async () => {
      mockDisputeIntake.findUnique.mockResolvedValue({
        ...mockIntakeRecord,
        expires_at: pastDate(1),
      });

      const result = await DisputeIntakeService.getInstance().resolveIntake('expired-token');

      expect(result).toEqual({ expired: true });
    });

    it('returns null for an invalid token', async () => {
      mockDisputeIntake.findUnique.mockResolvedValue(null);

      const result = await DisputeIntakeService.getInstance().resolveIntake('invalid-token');

      expect(result).toBeNull();
    });

    it('stamps viewed_at on first resolve', async () => {
      mockDisputeIntake.findUnique.mockResolvedValue(mockIntakeRecord);
      mockDisputeIntake.update.mockResolvedValue({});
      mockCampaignsList.findUnique.mockResolvedValue(mockCampaign);

      await DisputeIntakeService.getInstance().resolveIntake('valid-token');

      expect(mockDisputeIntake.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mdint-1' },
          data: { viewed_at: expect.any(Date) },
        }),
      );
    });

    it('does not stamp viewed_at on second resolve', async () => {
      mockDisputeIntake.findUnique.mockResolvedValue({
        ...mockIntakeRecord,
        viewed_at: pastDate(1),
      });
      mockCampaignsList.findUnique.mockResolvedValue(mockCampaign);

      await DisputeIntakeService.getInstance().resolveIntake('valid-token');

      expect(mockDisputeIntake.update).not.toHaveBeenCalled();
    });

    it('marks alreadySubmitted=true when submitted_at is set', async () => {
      mockDisputeIntake.findUnique.mockResolvedValue({
        ...mockIntakeRecord,
        submitted_at: pastDate(1),
      });
      mockCampaignsList.findUnique.mockResolvedValue(mockCampaign);

      const result = await DisputeIntakeService.getInstance().resolveIntake('valid-token');

      if (result && !('expired' in result)) {
        expect(result.alreadySubmitted).toBe(true);
      }
    });
  });

  // ─── submitIntake ───────────────────────────────────────────────

  describe('submitIntake', () => {
    it('submits successfully and transitions campaign to intake_submitted', async () => {
      mockDisputeIntake.findUnique.mockResolvedValue(mockIntakeRecord);
      mockDisputeIntake.update.mockResolvedValue({
        ...mockIntakeRecord,
        owner_statement: 'Test statement',
        submitted_at: new Date(),
      });
      mockCampaignsList.findUnique.mockResolvedValue(mockCampaign);
      mockCampaignsList.update.mockResolvedValue({ ...mockCampaign, stage: 'intake_submitted' });

      const result = await DisputeIntakeService.getInstance().submitIntake({
        token: 'valid-token',
        ownerStatement: 'This is a test statement with enough characters.',
        proposedResolution: 'Full Refund',
        serviceDate: null,
        statusFlag: null,
        attachmentIds: [],
      });

      expect(result.alreadySubmitted).toBe(false);
      expect(result.stage).toBe('intake_submitted');
      expect(mockCampaignsList.update).toHaveBeenCalled();
    });

    it('is idempotent — double-submit returns original without re-transitioning', async () => {
      mockDisputeIntake.findUnique.mockResolvedValue({
        ...mockIntakeRecord,
        submitted_at: pastDate(1),
        owner_statement: 'Original statement',
      });
      mockCampaignsList.findUnique.mockResolvedValue({ ...mockCampaign, stage: 'intake_submitted' });

      const result = await DisputeIntakeService.getInstance().submitIntake({
        token: 'valid-token',
        ownerStatement: 'This is a different statement.',
        proposedResolution: 'Partial Refund',
        serviceDate: null,
        statusFlag: null,
        attachmentIds: [],
      });

      expect(result.alreadySubmitted).toBe(true);
      expect(result.stage).toBe('intake_submitted');
      // Campaign update (transition) should NOT be called
      expect(mockCampaignsList.update).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      mockDisputeIntake.findUnique.mockResolvedValue({
        ...mockIntakeRecord,
        expires_at: pastDate(1),
      });

      await expect(
        DisputeIntakeService.getInstance().submitIntake({
          token: 'expired-token',
          ownerStatement: 'This is a test statement with enough characters.',
          proposedResolution: 'Full Refund',
          serviceDate: null,
          statusFlag: null,
          attachmentIds: [],
        }),
      ).rejects.toThrow('expired');
    });

    it('rejects an invalid token', async () => {
      mockDisputeIntake.findUnique.mockResolvedValue(null);

      await expect(
        DisputeIntakeService.getInstance().submitIntake({
          token: 'invalid-token',
          ownerStatement: 'This is a test statement with enough characters.',
          proposedResolution: 'Full Refund',
          serviceDate: null,
          statusFlag: null,
          attachmentIds: [],
        }),
      ).rejects.toThrow('Invalid');
    });
  });

  // ─── generateIntakeLink ─────────────────────────────────────────

  describe('generateIntakeLink', () => {
    it('creates a new intake row when none exists', async () => {
      mockCampaignsList.findUnique.mockResolvedValue(mockCampaign);
      mockDisputeIntake.findUnique.mockResolvedValue(null); // no existing intake
      mockDisputeIntake.create.mockResolvedValue(mockIntakeRecord);

      const result = await DisputeIntakeService.getInstance().generateIntakeLink('mcamp-1');

      expect(result.intakeId).toBe('mdint-1');
      expect(result.token).toBeTruthy();
      expect(result.url).toContain('/recovery/intake?token=');
      expect(mockDisputeIntake.create).toHaveBeenCalled();
    });

    it('reissues token when an intake row already exists (no duplicate)', async () => {
      mockCampaignsList.findUnique.mockResolvedValue(mockCampaign);
      mockDisputeIntake.findUnique.mockResolvedValue(mockIntakeRecord);
      mockDisputeIntake.update.mockResolvedValue({
        ...mockIntakeRecord,
        access_token: 'new-token-32chars-bbbbbbbbbbbb',
      });

      const result = await DisputeIntakeService.getInstance().generateIntakeLink('mcamp-1');

      expect(result.token).toBe('new-token-32chars-bbbbbbbbbbbb');
      // Should NOT create a second row
      expect(mockDisputeIntake.create).not.toHaveBeenCalled();
      // Should update (reissue) the existing row
      expect(mockDisputeIntake.update).toHaveBeenCalled();
    });

    it('throws if campaign not found', async () => {
      mockCampaignsList.findUnique.mockResolvedValue(null);

      await expect(
        DisputeIntakeService.getInstance().generateIntakeLink('nonexistent'),
      ).rejects.toThrow('not found');
    });
  });

  // ─── reissueLink ────────────────────────────────────────────────

  describe('reissueLink', () => {
    it('reissues token for existing intake', async () => {
      mockDisputeIntake.findUnique.mockResolvedValue(mockIntakeRecord);
      mockDisputeIntake.update.mockResolvedValue({
        ...mockIntakeRecord,
        access_token: 'reissued-token-32chars-cccccccc',
      });

      const result = await DisputeIntakeService.getInstance().reissueLink('mcamp-1');

      expect(result.token).toBe('reissued-token-32chars-cccccccc');
      expect(mockDisputeIntake.update).toHaveBeenCalled();
    });

    it('generates fresh link if no existing intake', async () => {
      mockDisputeIntake.findUnique.mockResolvedValue(null);
      mockCampaignsList.findUnique.mockResolvedValue(mockCampaign);
      mockDisputeIntake.create.mockResolvedValue(mockIntakeRecord);

      const result = await DisputeIntakeService.getInstance().reissueLink('mcamp-1');

      expect(result.intakeId).toBe('mdint-1');
      expect(mockDisputeIntake.create).toHaveBeenCalled();
    });
  });
});
