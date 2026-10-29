/**
 * DirectorySeedCleanupService.resolveDuplicates — suppression coupling.
 *
 * The cleanup panel's duplicate resolve wrote status='suppressed' on the
 * loser seed but left its listing is_published = true — a suppressed seed
 * that still served on every read that only checks the listing flag.
 * Suppression now unpublishes the loser's listing + directory settings in
 * the same transaction (same contract updateStatus enforces).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockQueryRaw,
  mockExecuteRaw,
  mockTransaction,
  mockRecordVerdict,
  mockDismissForVerdict,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockTransaction: vi.fn(),
  mockRecordVerdict: vi.fn(),
  mockDismissForVerdict: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    $transaction: mockTransaction,
    mkt_audits_list: { findMany: vi.fn() },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../audit', () => ({ audit: vi.fn() }));
vi.mock('../../lib/id-generator', () => ({
  generateDirectoryFieldProvenanceId: vi.fn(() => 'dfp-test'),
}));
vi.mock('../DirectoryPresenceSeedService', () => ({ default: {} }));
vi.mock('../DirectorySeedCampaignLinkService', () => ({ default: {} }));
vi.mock('../ProvingGroundDedupService', () => ({
  default: { recordVerdict: mockRecordVerdict },
}));
vi.mock('../DirectoryChainService', () => ({
  default: { dismissForVerdict: mockDismissForVerdict },
  computeChainSignals: vi.fn(() => null),
}));
vi.mock('../directory/listingAttributes', () => ({
  normalizeAttributeEntry: vi.fn((a: any) => a),
}));
vi.mock('../directory/SeedSeoComposer', () => ({
  buildSeoEnrichmentJson: vi.fn(() => ({})),
  DISCLOSURE_SENTENCE: '',
}));

import DirectorySeedCleanupService from '../DirectorySeedCleanupService';

const sqlText = (a: any) => (Array.isArray(a) ? a.join('') : String(a));
const calls = () => mockExecuteRaw.mock.calls.map((c) => sqlText(c[0]));

const KEEP = {
  id: 'seed-keep',
  status: 'published',
  phone: '(317) 555-0100',
  address: '1435 W 86th St',
  city: 'Indianapolis',
};
const LOSER = {
  id: 'seed-lose',
  status: 'published',
  phone: '(317) 555-0100',
  address: '1435 W 86th St',
  city: 'Indianapolis',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(1);
  mockRecordVerdict.mockResolvedValue(undefined);
  mockDismissForVerdict.mockResolvedValue(undefined);
  // Run the callback against a tx stub sharing the execute mock so the
  // in-transaction writes are observable.
  mockTransaction.mockImplementation((fn: any) =>
    fn({ $executeRaw: mockExecuteRaw, $queryRaw: mockQueryRaw }),
  );
});

describe('resolveDuplicates suppression coupling', () => {
  it('unpublishes the loser listing + settings inside the suppression transaction', async () => {
    mockQueryRaw.mockResolvedValueOnce([KEEP, LOSER]);

    const result = await DirectorySeedCleanupService.resolveDuplicates({
      keepSeedId: 'seed-keep',
      suppressSeedIds: ['seed-lose'],
      matchKey: 'phone',
    });

    expect(result.suppressed).toEqual(['seed-lose']);
    const sql = calls();
    expect(sql.some((s) => s.includes("SET status = 'suppressed'"))).toBe(true);
    expect(
      sql.some((s) => s.includes('UPDATE directory_listings_list') && s.includes('is_published = false')),
    ).toBe(true);
    expect(
      sql.some((s) => s.includes('UPDATE directory_settings_list') && s.includes('is_published = false')),
    ).toBe(true);
    // Claim tokens still revoked in the same transaction.
    expect(sql.some((s) => s.includes('UPDATE directory_claim_tokens'))).toBe(true);
  });

  it('records the same_entity verdict on both satisfied match keys', async () => {
    mockQueryRaw.mockResolvedValueOnce([KEEP, LOSER]);

    await DirectorySeedCleanupService.resolveDuplicates({
      keepSeedId: 'seed-keep',
      suppressSeedIds: ['seed-lose'],
      matchKey: 'phone',
    });

    const keys = mockRecordVerdict.mock.calls.map((c) => c[0].matchKey).sort();
    expect(keys).toEqual(['address_city', 'phone']);
  });

  it('refuses to suppress a claimed seed before any write', async () => {
    mockQueryRaw.mockResolvedValueOnce([KEEP, { ...LOSER, status: 'claimed' }]);

    await expect(
      DirectorySeedCleanupService.resolveDuplicates({
        keepSeedId: 'seed-keep',
        suppressSeedIds: ['seed-lose'],
        matchKey: 'phone',
      }),
    ).rejects.toThrow(/claimed_seed_cannot_suppress/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
