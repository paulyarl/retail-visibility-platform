import { describe, it, expect, vi, beforeEach } from 'vitest';

// ====================
// MOCKS
// ====================

const {
  mockCampaigns,
  mockOutreachLog,
} = vi.hoisted(() => ({
  mockCampaigns: { findMany: vi.fn() },
  mockOutreachLog: { findMany: vi.fn(), create: vi.fn() },
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

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    webBaseUrl: 'http://localhost:3000',
  },
}));

// Mock MarketingOutreachService
const mockLogContact = vi.fn().mockResolvedValue({});
vi.mock('../MarketingOutreachService', () => ({
  MarketingOutreachService: {
    getInstance: () => ({ logContact: mockLogContact }),
  },
}));

import { RecoveryCascadeService } from '../RecoveryCascadeService';

// ====================
// FIXTURES
// ====================

const DAY_MS = 24 * 60 * 60 * 1000;

function makeCampaign(stageEnteredDaysAgo: number, opts: { hasIntake?: boolean } = {}) {
  return {
    id: 'mcamp-1',
    business_name: 'Test Business',
    stage_entered_at: new Date(Date.now() - stageEnteredDaysAgo * DAY_MS),
    email: 'owner@test.com',
    phone: '+1234567890',
    mkt_dispute_intake: opts.hasIntake === false ? null : {
      id: 'mdint-1',
      access_token: 'abc123',
    },
  };
}

// ====================
// TESTS
// ====================

describe('RecoveryCascadeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fires Day 1 email when elapsed >= 1 day and no prior cascade contacts', async () => {
    mockCampaigns.findMany.mockResolvedValue([makeCampaign(1)]);
    mockOutreachLog.findMany.mockResolvedValue([]); // no prior contacts

    const result = await RecoveryCascadeService.getInstance().run();

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

  it('fires Day 2 step when 1 prior contact and elapsed >= 2 days', async () => {
    mockCampaigns.findMany.mockResolvedValue([makeCampaign(2)]);
    mockOutreachLog.findMany.mockResolvedValue([
      { contact_date: new Date(Date.now() - 1 * DAY_MS) },
    ]);

    const result = await RecoveryCascadeService.getInstance().run();

    expect(result.fired).toBe(1);
    expect(mockLogContact).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: expect.stringContaining('Day 2'),
      }),
      undefined,
    );
  });

  it('fires Day 4 step when 2 prior contacts and elapsed >= 4 days', async () => {
    mockCampaigns.findMany.mockResolvedValue([makeCampaign(4)]);
    mockOutreachLog.findMany.mockResolvedValue([
      { contact_date: new Date(Date.now() - 3 * DAY_MS) },
      { contact_date: new Date(Date.now() - 2 * DAY_MS) },
    ]);

    const result = await RecoveryCascadeService.getInstance().run();

    expect(result.fired).toBe(1);
    expect(mockLogContact).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: expect.stringContaining('Day 4'),
      }),
      undefined,
    );
  });

  it('does not fire when cascade exhausted (3 prior contacts)', async () => {
    mockCampaigns.findMany.mockResolvedValue([makeCampaign(10)]);
    mockOutreachLog.findMany.mockResolvedValue([
      { contact_date: new Date() },
      { contact_date: new Date() },
      { contact_date: new Date() },
    ]);

    const result = await RecoveryCascadeService.getInstance().run();

    expect(result.fired).toBe(0);
    expect(mockLogContact).not.toHaveBeenCalled();
  });

  it('does not fire Day 1 when elapsed < 1 day', async () => {
    mockCampaigns.findMany.mockResolvedValue([makeCampaign(0)]); // 0 days
    mockOutreachLog.findMany.mockResolvedValue([]);

    const result = await RecoveryCascadeService.getInstance().run();

    expect(result.fired).toBe(0);
    expect(mockLogContact).not.toHaveBeenCalled();
  });

  it('skips campaigns with no intake record', async () => {
    mockCampaigns.findMany.mockResolvedValue([makeCampaign(1, { hasIntake: false })]);
    mockOutreachLog.findMany.mockResolvedValue([]);

    const result = await RecoveryCascadeService.getInstance().run();

    expect(result.fired).toBe(0);
    expect(mockLogContact).not.toHaveBeenCalled();
  });

  it('returns zero when no campaigns in awaiting_owner_intake', async () => {
    mockCampaigns.findMany.mockResolvedValue([]);

    const result = await RecoveryCascadeService.getInstance().run();

    expect(result.fired).toBe(0);
    expect(result.skipped).toBe(0);
  });
});
