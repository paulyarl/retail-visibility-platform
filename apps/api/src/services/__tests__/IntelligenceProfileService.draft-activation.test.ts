/**
 * Draft listing + activation guards (bronze activation regression).
 *
 * A scan import (or a consumer write-back) on an already-established market
 * appends a DRAFT version for review. Those drafts are CANDIDATE POOLS for the
 * active profile, not profiles awaiting their first activation:
 *
 *   - listDrafts() marks them `awaiting_activation: false` so the admin
 *     surfaces stop presenting an already-activated profile as "ready to
 *     activate" after every scan.
 *   - activateDraft() refuses to activate a draft that is older than the
 *     version already active — the retire-active/activate-draft pair would
 *     otherwise roll the profile backwards (observed in prod: a stale v2
 *     draft activated after v3, retiring v3).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Prisma ──────────────────────────────────────────────────────────

const mockPrisma = {
  mkt_intelligence_profiles: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
  $queryRaw: vi.fn().mockResolvedValue([]),
  $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(mockPrisma)),
};

vi.mock('../BaseService', () => {
  class MockBaseService {
    get prisma() {
      return mockPrisma;
    }
    handleError(error: any, _ctx?: any) {
      return error;
    }
  }
  return { BaseService: MockBaseService };
});

vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { IntelligenceProfileService } from '../intelligence/IntelligenceProfileService';

const profileRow = (over: Record<string, any> = {}) => ({
  id: 'mip-milwaukee-bronze',
  category_key: 'african grocery store',
  category_name: 'African Grocery Store',
  version: 1,
  intelligence_focus: 'bronze_standards',
  reference_city: null,
  reference_state: null,
  reference_platform: null,
  configuration_json: {},
  status: 'draft',
  created_at: new Date(),
  updated_at: new Date(),
  ...over,
});

beforeEach(() => {
  mockPrisma.mkt_intelligence_profiles.findFirst.mockReset();
  mockPrisma.mkt_intelligence_profiles.findMany.mockReset();
  mockPrisma.mkt_intelligence_profiles.create.mockReset();
  mockPrisma.mkt_intelligence_profiles.update.mockReset();
  mockPrisma.mkt_intelligence_profiles.updateMany.mockReset();
  mockPrisma.mkt_intelligence_profiles.findUnique.mockReset();
  mockPrisma.$queryRaw.mockReset();
  mockPrisma.$queryRaw.mockResolvedValue([]);
});

describe('IntelligenceProfileService.listDrafts — awaiting_activation', () => {
  const service = IntelligenceProfileService.getInstance();

  it('marks a draft with nothing active at its scope as awaiting activation', async () => {
    mockPrisma.mkt_intelligence_profiles.findMany
      .mockResolvedValueOnce([profileRow({ version: 1 })])
      .mockResolvedValueOnce([]);

    const drafts = await service.listDrafts('bronze_standards');

    expect(drafts).toHaveLength(1);
    expect(drafts[0].awaiting_activation).toBe(true);
    // The active lookup carries the same focus filter as the draft lookup.
    expect(mockPrisma.mkt_intelligence_profiles.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { status: 'active', intelligence_focus: 'bronze_standards' },
      }),
    );
  });

  it('marks a draft as a candidate pool when an active profile covers the same scope', async () => {
    mockPrisma.mkt_intelligence_profiles.findMany
      .mockResolvedValueOnce([
        profileRow({ version: 4, reference_city: 'Milwaukee', reference_state: 'WI' }),
      ])
      .mockResolvedValueOnce([
        profileRow({
          version: 2,
          status: 'active',
          reference_city: 'Milwaukee',
          reference_state: 'WI',
        }),
      ]);

    const drafts = await service.listDrafts('bronze_standards');

    expect(drafts[0].awaiting_activation).toBe(false);
  });

  it('does not treat a different city/state/platform as covered', async () => {
    mockPrisma.mkt_intelligence_profiles.findMany
      .mockResolvedValueOnce([
        profileRow({ version: 4, reference_city: 'Milwaukee', reference_state: 'WI' }),
      ])
      .mockResolvedValueOnce([
        // Same category + focus, different market.
        profileRow({
          version: 12,
          status: 'active',
          reference_city: 'Indianapolis',
          reference_state: 'IN',
        }),
        // Same market, platform-scoped row (platform is part of the tuple).
        profileRow({
          version: 3,
          status: 'active',
          reference_city: 'Milwaukee',
          reference_state: 'WI',
          reference_platform: 'google',
        }),
      ]);

    const drafts = await service.listDrafts('bronze_standards');

    expect(drafts[0].awaiting_activation).toBe(true);
  });
});

describe('IntelligenceProfileService.activateDraft — regression guard', () => {
  const service = IntelligenceProfileService.getInstance();

  it('refuses to activate a draft older than the active version', async () => {
    mockPrisma.mkt_intelligence_profiles.findUnique.mockResolvedValueOnce(
      profileRow({ version: 2 }),
    );
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(
      profileRow({ version: 3, status: 'active' }),
    );

    await expect(service.activateDraft('mip-milwaukee-bronze', 2)).rejects.toThrow(
      /older than the active v3/,
    );

    expect(mockPrisma.mkt_intelligence_profiles.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.mkt_intelligence_profiles.update).not.toHaveBeenCalled();
  });

  it('activates a draft newer than the active version', async () => {
    mockPrisma.mkt_intelligence_profiles.findUnique.mockResolvedValueOnce(
      profileRow({ version: 4 }),
    );
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(null);
    mockPrisma.mkt_intelligence_profiles.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.mkt_intelligence_profiles.update.mockResolvedValueOnce(
      profileRow({ version: 4, status: 'active' }),
    );

    const result = await service.activateDraft('mip-milwaukee-bronze', 4);

    expect(result.status).toBe('active');
    expect(result.version).toBe(4);
    expect(mockPrisma.mkt_intelligence_profiles.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: 'active' }),
      data: { status: 'retired', updated_at: expect.any(Date) },
    });
  });
});
