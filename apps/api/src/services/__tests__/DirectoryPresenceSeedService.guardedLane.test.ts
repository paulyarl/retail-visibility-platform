/**
 * createFromCampaign — guarded lane (spec §6).
 *
 * The Identity tab's Push passes `lane: 'guarded'` so the seed gate is evaluated
 * SERVER-SIDE. The manual lane (raw capability) deliberately bypasses it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCampaignsList, mockAuditsList, mockBuildForCampaign } = vi.hoisted(() => ({
  mockCampaignsList: { findUnique: vi.fn() },
  mockAuditsList: { findMany: vi.fn() },
  mockBuildForCampaign: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: { mkt_campaigns_list: mockCampaignsList, mkt_audits_list: mockAuditsList },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/marketing-audits', () => ({
  isStubBusinessAnalysisAudit: () => false,
}));

vi.mock('../IdentityPacketService', () => ({
  default: { buildForCampaign: mockBuildForCampaign },
}));

import DirectoryPresenceSeedService from '../DirectoryPresenceSeedService';

const blockedPacket = {
  score: {
    pushRecommended: false,
    gate: { decision: 'blocked', blockers: ['insufficient_dimensions'] },
    vetoes: [],
  },
};

const pushablePacket = {
  score: { pushRecommended: true, gate: { decision: 'earned', blockers: [] }, vetoes: [] },
};

describe('createFromCampaign — guarded lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignsList.findUnique.mockResolvedValue({ id: 'camp-1' });
    mockAuditsList.findMany.mockResolvedValue([
      { id: 'a1', audit_data: { audit_metadata: { identity_status: 'confirmed' } } },
    ]);
    mockBuildForCampaign.mockResolvedValue(blockedPacket);
  });

  it('rejects a blocked seed on the guarded lane and carries the gate', async () => {
    await expect(
      DirectoryPresenceSeedService.createFromCampaign('camp-1', { lane: 'guarded' }),
    ).rejects.toMatchObject({ message: 'gate_blocked', gate: { decision: 'blocked' } });
    expect(mockBuildForCampaign).toHaveBeenCalledWith('camp-1');
  });

  it('does not evaluate the gate on the manual lane', async () => {
    // Manual lane bypasses the gate by design. The method proceeds past the
    // guard and fails later for want of the full seed-creation mocks — but it
    // must never fail on the gate, and must never build the packet.
    let caught: any = null;
    try {
      await DirectoryPresenceSeedService.createFromCampaign('camp-1', { lane: 'manual' });
    } catch (e) {
      caught = e;
    }
    expect(caught?.message).not.toBe('gate_blocked');
    expect(mockBuildForCampaign).not.toHaveBeenCalled();
  });

  it('lets a pushable packet through the guarded lane', async () => {
    mockBuildForCampaign.mockResolvedValue(pushablePacket);
    let caught: any = null;
    try {
      await DirectoryPresenceSeedService.createFromCampaign('camp-1', { lane: 'guarded' });
    } catch (e) {
      caught = e;
    }
    expect(mockBuildForCampaign).toHaveBeenCalledWith('camp-1');
    expect(caught?.message).not.toBe('gate_blocked');
  });
});
