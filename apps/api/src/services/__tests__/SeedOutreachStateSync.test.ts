/**
 * SeedOutreachStateSync tests
 *
 * Verifies:
 * - mapOutcomeToState: freshness_verified → freshness_verified
 * - mapOutcomeToState: freshness_failed → freshness_failed
 * - mapOutcomeToState: wrong_number → freshness_failed
 * - mapOutcomeToState: disconnected_number → freshness_failed
 * - mapOutcomeToState: reached + operating_status_confirmed → freshness_verified
 * - mapOutcomeToState: reached without confirmation → owner_contacted
 * - mapOutcomeToState: no_answer → owner_contacted
 * - mapOutcomeToState: left_message → owner_contacted
 * - mapOutcomeToState: seed_outreach_scheduled → null (no change)
 * - mapOutcomeToState: auto_follow_up_scheduled → null (no change)
 * - Terminal states: claimed/suppressed are not overridden
 * - No linked seed: no-op
 * - setOutreachState called with correct seedId + state
 *
 * See: docs/LocalBiz/seed_outreach_courtesy_window_sprint_plan.md §11
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (hoisted) ─────────────────────────────────────────────────────

const {
  mockQueryRaw,
  mockSetOutreachState,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockSetOutreachState: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../DirectoryPresenceSeedService', () => ({
  default: {
    setOutreachState: mockSetOutreachState,
  },
}));

// Import after mocks
import { SeedOutreachStateSync } from '../SeedOutreachStateSync';

// ─── Fixtures ────────────────────────────────────────────────────────────

function makeSeedLink(seedId: string = 'seed-001') {
  return [{ seed_id: seedId }];
}

function makeSeed(state: string = 'outreach_scheduled') {
  return [{ outreach_state: state }];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSetOutreachState.mockResolvedValue(undefined);

  // Default: linked seed found, in outreach_scheduled state
  mockQueryRaw.mockImplementation((sql: any) => {
    const sqlStr = typeof sql === 'string' ? sql : (sql?.[0] || '');
    if (sqlStr.includes('directory_seed_campaign_links')) return Promise.resolve(makeSeedLink());
    if (sqlStr.includes('directory_presence_seeds')) return Promise.resolve(makeSeed());
    return Promise.resolve([]);
  });
});

// ─── Tests ───────────────────────────────────────────────────────────────

describe('SeedOutreachStateSync', () => {
  describe('freshness outcomes', () => {
    it('maps freshness_verified → freshness_verified', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'freshness_verified',
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'freshness_verified',
        expect.any(Object),
      );
    });

    it('maps freshness_failed → freshness_failed', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'freshness_failed',
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'freshness_failed',
        expect.any(Object),
      );
    });

    it('maps wrong_number → freshness_failed', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'wrong_number',
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'freshness_failed',
        expect.any(Object),
      );
    });

    it('maps disconnected_number → freshness_failed', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'disconnected_number',
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'freshness_failed',
        expect.any(Object),
      );
    });
  });

  describe('reached outcomes', () => {
    it('maps reached + operating_status_confirmed → freshness_verified', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'reached',
        callDetails: { operating_status_confirmed: true },
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'freshness_verified',
        expect.any(Object),
      );
    });

    it('maps reached without confirmation → owner_contacted', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'reached',
        callDetails: { operating_status_confirmed: false },
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'owner_contacted',
        expect.any(Object),
      );
    });

    it('maps reached with no callDetails → owner_contacted', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'reached',
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'owner_contacted',
        expect.any(Object),
      );
    });
  });

  describe('contact outcomes', () => {
    it('maps no_answer → owner_contacted', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'no_answer',
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'owner_contacted',
        expect.any(Object),
      );
    });

    it('maps left_message → owner_contacted', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'left_message',
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'owner_contacted',
        expect.any(Object),
      );
    });

    it('maps callback_scheduled → owner_contacted', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'callback_scheduled',
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'owner_contacted',
        expect.any(Object),
      );
    });

    it('maps interested → owner_contacted', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'interested',
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'owner_contacted',
        expect.any(Object),
      );
    });

    it('maps not_interested → owner_contacted', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'not_interested',
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'owner_contacted',
        expect.any(Object),
      );
    });

    it('maps other → owner_contacted', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'other',
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'owner_contacted',
        expect.any(Object),
      );
    });
  });

  describe('system-generated outcomes (no state change)', () => {
    it('does not change state for seed_outreach_scheduled', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'seed_outreach_scheduled',
      });
      expect(mockSetOutreachState).not.toHaveBeenCalled();
    });

    it('does not change state for auto_follow_up_scheduled', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'auto_follow_up_scheduled',
      });
      expect(mockSetOutreachState).not.toHaveBeenCalled();
    });
  });

  describe('terminal states', () => {
    it('does not override claimed state', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const sqlStr = typeof sql === 'string' ? sql : (sql?.[0] || '');
        if (sqlStr.includes('directory_seed_campaign_links')) return Promise.resolve(makeSeedLink());
        if (sqlStr.includes('directory_presence_seeds')) return Promise.resolve(makeSeed('claimed'));
        return Promise.resolve([]);
      });

      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'reached',
      });
      expect(mockSetOutreachState).not.toHaveBeenCalled();
    });

    it('does not override suppressed state', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const sqlStr = typeof sql === 'string' ? sql : (sql?.[0] || '');
        if (sqlStr.includes('directory_seed_campaign_links')) return Promise.resolve(makeSeedLink());
        if (sqlStr.includes('directory_presence_seeds')) return Promise.resolve(makeSeed('suppressed'));
        return Promise.resolve([]);
      });

      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'freshness_failed',
      });
      expect(mockSetOutreachState).not.toHaveBeenCalled();
    });
  });

  describe('no linked seed', () => {
    it('is a no-op when campaign has no primary-linked seed', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const sqlStr = typeof sql === 'string' ? sql : (sql?.[0] || '');
        if (sqlStr.includes('directory_seed_campaign_links')) return Promise.resolve([]); // no link
        return Promise.resolve([]);
      });

      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'reached',
      });
      expect(mockSetOutreachState).not.toHaveBeenCalled();
    });
  });

  describe('context passthrough', () => {
    it('passes actorId from ctx to setOutreachState', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'reached',
        ctx: { actorId: 'user-456', actorType: 'user' },
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'owner_contacted',
        { actorId: 'user-456', actorType: 'user' },
      );
    });

    it('passes userId as actorId fallback', async () => {
      await SeedOutreachStateSync.getInstance().syncFromLog({
        campaignId: 'camp-001',
        outcome: 'reached',
        ctx: { userId: 'user-789', actorType: 'user' },
      });
      expect(mockSetOutreachState).toHaveBeenCalledWith(
        'seed-001',
        'owner_contacted',
        { actorId: 'user-789', actorType: 'user' },
      );
    });
  });
});
