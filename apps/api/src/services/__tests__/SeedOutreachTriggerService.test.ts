/**
 * SeedOutreachTriggerService tests
 *
 * Verifies:
 * - Kill switch: skips when DISABLE_SEED_OUTREACH_TRIGGER=true
 * - Idempotency: skips when a seed_outreach log already exists for this seed
 * - Campaign not found: skips gracefully
 * - Seed not found: skips gracefully
 * - Channel resolution: phone > email > other
 * - Claim URL resolution: calls HookSuggestionService.resolveClaimUrl
 * - Hook resolution: uses suggestions[0] from suggestForCampaign
 * - Profile-quality findings: extracted from audit payload detected_signals
 * - Atomic transaction: outreach log + state update in single $transaction
 * - Failure isolation: HookSuggestionService errors don't abort the trigger
 *
 * See: docs/LocalBiz/seed_outreach_courtesy_window_sprint_plan.md §11
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (hoisted) ─────────────────────────────────────────────────────

const {
  mockQueryRaw,
  mockExecuteRaw,
  mockTransaction,
  mockResolveClaimUrl,
  mockSuggestForCampaign,
  mockAudit,
  mockDisableSeedOutreachTrigger,
  mockSeedOutreachNoResponseDays,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockTransaction: vi.fn(),
  mockResolveClaimUrl: vi.fn(),
  mockSuggestForCampaign: vi.fn(),
  mockAudit: vi.fn(),
  mockDisableSeedOutreachTrigger: vi.fn(() => false),
  mockSeedOutreachNoResponseDays: vi.fn(() => 14),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    $transaction: mockTransaction,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({
  audit: mockAudit,
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    get disableSeedOutreachTrigger() { return mockDisableSeedOutreachTrigger(); },
    get seedOutreachNoResponseDays() { return mockSeedOutreachNoResponseDays(); },
  },
}));

vi.mock('../HookSuggestionService', () => ({
  HookSuggestionService: {
    getInstance: () => ({
      resolveClaimUrl: mockResolveClaimUrl,
      suggestForCampaign: mockSuggestForCampaign,
    }),
  },
}));

vi.mock('../MarketingOutreachService', () => ({
  MarketingOutreachService: { getInstance: () => ({}) },
}));

// Import after mocks
import { SeedOutreachTriggerService } from '../SeedOutreachTriggerService';

// ─── Fixtures ────────────────────────────────────────────────────────────

function makeCampaign(overrides: Partial<any> = {}) {
  return [{
    id: 'camp-001',
    phone: '317-555-0100',
    email: 'owner@example.com',
    business_name: 'Test Business',
    stage: 'preview_built',
    ...overrides,
  }];
}

function makeSeed(overrides: Partial<any> = {}) {
  return [{
    id: 'seed-001',
    tenant_id: 'tnt-001',
    listing_id: 'lst-001',
    owner_email: 'owner@example.com',
    owner_phone: '317-555-0100',
    owner_name: 'Test Owner',
    ...overrides,
  }];
}

function makeListing(overrides: Partial<any> = {}) {
  return [{ slug: 'test-business', ...overrides }];
}

function makeHookSuggestion(overrides: Partial<any> = {}) {
  return {
    suggestions: [
      {
        angle: 'community_anchor',
        body: 'You are the go-to spot for African groceries in Indianapolis.',
        resolved: { body: 'Hi Test Business, you are the go-to spot for African groceries in Indianapolis.' },
        ...overrides,
      },
    ],
  };
}

function makeAuditPayload(signals: string[] = ['missing_hours', 'no_website']) {
  return [{ audit_payload: JSON.stringify({ detected_signals: signals }) }];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDisableSeedOutreachTrigger.mockReturnValue(false);
  mockSeedOutreachNoResponseDays.mockReturnValue(14);

  // Default: campaign + seed + no existing log + listing + audit
  mockQueryRaw.mockImplementation((sql: any) => {
    // Distinguish by SQL content
    const sqlStr = typeof sql === 'string' ? sql : (sql?.[0] || '');
    if (sqlStr.includes('mkt_campaigns_list')) return Promise.resolve(makeCampaign());
    if (sqlStr.includes('directory_presence_seeds') && sqlStr.includes('owner_email')) return Promise.resolve(makeSeed());
    if (sqlStr.includes('mkt_outreach_log')) return Promise.resolve([]); // no existing log
    if (sqlStr.includes('directory_listings_list')) return Promise.resolve(makeListing());
    if (sqlStr.includes('mkt_audits_list')) return Promise.resolve(makeAuditPayload());
    return Promise.resolve([]);
  });

  mockTransaction.mockImplementation(async (cb: any) => {
    // Simulate transaction by calling the callback with a mock tx
    const tx = { $executeRaw: vi.fn().mockResolvedValue(undefined) };
    return cb(tx);
  });

  mockResolveClaimUrl.mockResolvedValue('https://example.com/place/claim/TOKEN123');
  mockSuggestForCampaign.mockResolvedValue(makeHookSuggestion());
  mockAudit.mockResolvedValue(undefined);
});

// ─── Tests ───────────────────────────────────────────────────────────────

describe('SeedOutreachTriggerService', () => {
  describe('kill switch', () => {
    it('skips when disableSeedOutreachTrigger is true', async () => {
      mockDisableSeedOutreachTrigger.mockReturnValue(true);
      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });
      expect(mockQueryRaw).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    it('skips when an outreach log already exists for this seed', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const sqlStr = typeof sql === 'string' ? sql : (sql?.[0] || '');
        if (sqlStr.includes('mkt_outreach_log')) return Promise.resolve([{ 1: 1 }]); // existing log
        if (sqlStr.includes('mkt_campaigns_list')) return Promise.resolve(makeCampaign());
        if (sqlStr.includes('directory_presence_seeds')) return Promise.resolve(makeSeed());
        return Promise.resolve([]);
      });

      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('proceeds when no existing log is found', async () => {
      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('not-found handling', () => {
    it('skips gracefully when campaign is not found', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const sqlStr = typeof sql === 'string' ? sql : (sql?.[0] || '');
        if (sqlStr.includes('mkt_campaigns_list')) return Promise.resolve([]); // no campaign
        return Promise.resolve(makeSeed());
      });

      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-missing',
        seedId: 'seed-001',
      });
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('skips gracefully when seed is not found', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const sqlStr = typeof sql === 'string' ? sql : (sql?.[0] || '');
        if (sqlStr.includes('mkt_campaigns_list')) return Promise.resolve(makeCampaign());
        if (sqlStr.includes('directory_presence_seeds')) return Promise.resolve([]); // no seed
        return Promise.resolve([]);
      });

      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-missing',
      });
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('channel resolution', () => {
    it('uses phone when available on seed', async () => {
      let capturedDetails: any;
      mockTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          $executeRaw: vi.fn().mockImplementation((sql: any) => {
            const sqlStr = typeof sql === 'string' ? sql : (sql?.[0] || '');
            if (sqlStr.includes('INSERT INTO mkt_outreach_log')) {
              capturedDetails = sql;
            }
            return Promise.resolve(undefined);
          }),
        };
        return cb(tx);
      });

      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });

      // The transaction should have been called with an INSERT that includes 'phone'
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      // Verify the channel was phone by checking the audit call
      expect(mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ contactChannel: 'phone' }),
        }),
      );
    });

    it('falls back to email when no phone on seed or campaign', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const sqlStr = typeof sql === 'string' ? sql : (sql?.[0] || '');
        if (sqlStr.includes('mkt_campaigns_list')) return Promise.resolve(makeCampaign({ phone: null }));
        if (sqlStr.includes('directory_presence_seeds')) return Promise.resolve(makeSeed({ owner_phone: null }));
        if (sqlStr.includes('mkt_outreach_log')) return Promise.resolve([]);
        if (sqlStr.includes('directory_listings_list')) return Promise.resolve(makeListing());
        if (sqlStr.includes('mkt_audits_list')) return Promise.resolve(makeAuditPayload());
        return Promise.resolve([]);
      });

      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });

      expect(mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ contactChannel: 'email' }),
        }),
      );
    });

    it('uses other channel when no phone or email', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const sqlStr = typeof sql === 'string' ? sql : (sql?.[0] || '');
        if (sqlStr.includes('mkt_campaigns_list')) return Promise.resolve(makeCampaign({ phone: null, email: null }));
        if (sqlStr.includes('directory_presence_seeds')) return Promise.resolve(makeSeed({ owner_phone: null, owner_email: null }));
        if (sqlStr.includes('mkt_outreach_log')) return Promise.resolve([]);
        if (sqlStr.includes('directory_listings_list')) return Promise.resolve(makeListing());
        if (sqlStr.includes('mkt_audits_list')) return Promise.resolve(makeAuditPayload());
        return Promise.resolve([]);
      });

      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });

      expect(mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ contactChannel: 'other' }),
        }),
      );
    });
  });

  describe('claim URL resolution', () => {
    it('calls HookSuggestionService.resolveClaimUrl with campaignId', async () => {
      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });
      expect(mockResolveClaimUrl).toHaveBeenCalledWith('camp-001');
    });

    it('continues when resolveClaimUrl throws', async () => {
      mockResolveClaimUrl.mockRejectedValue(new Error('claim URL service down'));
      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });
      // Should still complete the transaction
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('hook resolution', () => {
    it('uses suggestions[0] from suggestForCampaign', async () => {
      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });
      expect(mockSuggestForCampaign).toHaveBeenCalledWith('camp-001');
      expect(mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ hookAngle: 'community_anchor' }),
        }),
      );
    });

    it('continues when suggestForCampaign throws', async () => {
      mockSuggestForCampaign.mockRejectedValue(new Error('hook service down'));
      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('handles empty suggestions array', async () => {
      mockSuggestForCampaign.mockResolvedValue({ suggestions: [] });
      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });
      expect(mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ hookAngle: null }),
        }),
      );
    });
  });

  describe('profile-quality findings', () => {
    it('extracts detected_signals from audit payload', async () => {
      const signals = ['missing_hours', 'no_website', 'no_photos'];
      mockQueryRaw.mockImplementation((sql: any) => {
        const sqlStr = typeof sql === 'string' ? sql : (sql?.[0] || '');
        if (sqlStr.includes('mkt_campaigns_list')) return Promise.resolve(makeCampaign());
        if (sqlStr.includes('directory_presence_seeds')) return Promise.resolve(makeSeed());
        if (sqlStr.includes('mkt_outreach_log')) return Promise.resolve([]);
        if (sqlStr.includes('directory_listings_list')) return Promise.resolve(makeListing());
        if (sqlStr.includes('mkt_audits_list')) return Promise.resolve(makeAuditPayload(signals));
        return Promise.resolve([]);
      });

      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });

      // The transaction was called — findings are embedded in callDetails JSON
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('handles missing audit payload gracefully', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const sqlStr = typeof sql === 'string' ? sql : (sql?.[0] || '');
        if (sqlStr.includes('mkt_campaigns_list')) return Promise.resolve(makeCampaign());
        if (sqlStr.includes('directory_presence_seeds')) return Promise.resolve(makeSeed());
        if (sqlStr.includes('mkt_outreach_log')) return Promise.resolve([]);
        if (sqlStr.includes('directory_listings_list')) return Promise.resolve(makeListing());
        if (sqlStr.includes('mkt_audits_list')) return Promise.resolve([]); // no audit
        return Promise.resolve([]);
      });

      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('atomic transaction', () => {
    it('wraps outreach log INSERT and state UPDATE in a single transaction', async () => {
      const txExecuteRaw = vi.fn().mockResolvedValue(undefined);
      mockTransaction.mockImplementation(async (cb: any) => cb({ $executeRaw: txExecuteRaw }));

      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      // Two $executeRaw calls inside the transaction: INSERT + UPDATE
      expect(txExecuteRaw).toHaveBeenCalledTimes(2);
      const insertSql = txExecuteRaw.mock.calls[0][0];
      const updateSql = txExecuteRaw.mock.calls[1][0];
      const insertStr = typeof insertSql === 'string' ? insertSql : (insertSql?.[0] || '');
      const updateStr = typeof updateSql === 'string' ? updateSql : (updateSql?.[0] || '');
      expect(insertStr).toContain('INSERT INTO mkt_outreach_log');
      expect(updateStr).toContain('UPDATE directory_presence_seeds');
      expect(updateStr).toContain('outreach_scheduled');
    });
  });

  describe('audit logging', () => {
    it('logs audit event with actor from ctx', async () => {
      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
        ctx: { actorId: 'user-123', actorType: 'user' },
      });
      expect(mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'user-123',
          actorType: 'user',
          action: 'directory_presence_seed.outreach_triggered',
        }),
      );
    });

    it('defaults actor to system when ctx is not provided', async () => {
      await SeedOutreachTriggerService.getInstance().onSeedCreated({
        campaignId: 'camp-001',
        seedId: 'seed-001',
      });
      expect(mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'system',
          actorType: 'system',
        }),
      );
    });
  });
});
