/**
 * DirectoryPresenceSeedService.updateStatus — status/visibility coupling.
 *
 * Seed status is the listing's visibility contract: the tenant directory
 * unpublish endpoint writes settings + listing is_published in lockstep, and
 * the seed flow must do the same. Before this coupling, a published→draft
 * flip left directory_listings_list.is_published = true, so the direct
 * /directory/:slug URL kept serving a "draft" seed.
 *
 * 'published' is delegated to publishSeed (readiness gate + published_at +
 * settings sync) rather than a bare status write — the raw write produced
 * the inverse inconsistency: status='published' with is_published=false.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockExecuteRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $queryRawUnsafe: vi.fn(),
    $executeRaw: mockExecuteRaw,
    $executeRawUnsafe: vi.fn(),
    business_hours_list: { upsert: vi.fn() },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../audit', () => ({ audit: vi.fn() }));
vi.mock('../email-service', () => ({
  emailService: { send: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../DirectorySeedCampaignLinkService', () => ({
  default: { linkSeedToCampaign: vi.fn(), findPrimaryForCampaign: vi.fn() },
}));
vi.mock('../SeedOutreachTriggerService', () => ({
  SeedOutreachTriggerService: { getInstance: () => ({ onSeedCreated: vi.fn() }) },
}));
vi.mock('../../utils/slug', () => ({ isReservedPlaceSlug: vi.fn(() => false) }));
vi.mock('../../lib/id-generator', () => ({
  generateDirectoryListingId: vi.fn(() => 'lst-test'),
  generateDirectoryPresenceSeedId: vi.fn(() => 'seed-test'),
  generateDirectoryFieldProvenanceId: vi.fn(() => 'prov-test'),
  generateDirectoryClaimTokenId: vi.fn(() => 'ct-test'),
  generateDirectoryClaimTokenString: vi.fn(() => 'token-string'),
  generateDirectoryEnrichmentTokenId: vi.fn(() => 'et-test'),
  generateDirectoryEnrichmentTokenString: vi.fn(() => 'enrich-token'),
  generateTenantId: vi.fn(() => 'tnt-test'),
}));
vi.mock('../intelligence/IntelligenceProfileService', () => ({
  default: { getInstance: () => ({}) },
}));
vi.mock('../directory/SeedSeoComposer', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    buildSeedSeoPacket: vi.fn(() => ({})),
    buildSeoEnrichmentJson: vi.fn(() => ({})),
  };
});

import DirectoryPresenceSeedService from '../DirectoryPresenceSeedService';

const publishedSeed = {
  tenant_id: 'ten-1',
  listing_id: 'lst-1',
  status: 'published',
};

const calls = () => mockExecuteRaw.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(1);
});

describe('updateStatus → draft', () => {
  it('unpublishes the listing and directory settings, keeping the write in lockstep', async () => {
    mockQueryRaw.mockResolvedValueOnce([publishedSeed]);

    await DirectoryPresenceSeedService.updateStatus('seed-1', 'draft');

    const sql = calls();
    expect(sql.some((s) => s.includes('UPDATE directory_presence_seeds'))).toBe(true);
    const listingWrite = sql.find((s) => s.includes('UPDATE directory_listings_list'));
    expect(listingWrite).toBeTruthy();
    expect(listingWrite).toContain('is_published = false');
    const settingsWrite = sql.find((s) => s.includes('UPDATE directory_settings_list'));
    expect(settingsWrite).toBeTruthy();
    expect(settingsWrite).toContain('is_published = false');
  });

  it('unpublishes on suppressed too — a retired listing must not stay live', async () => {
    mockQueryRaw.mockResolvedValueOnce([publishedSeed]);

    await DirectoryPresenceSeedService.updateStatus('seed-1', 'suppressed');

    const sql = calls();
    expect(sql.some((s) => s.includes('UPDATE directory_listings_list') && s.includes('is_published = false'))).toBe(true);
  });
});

describe('updateStatus → invited', () => {
  it('stays bookkeeping-only — the invite flow manages the listing flag', async () => {
    mockQueryRaw.mockResolvedValueOnce([publishedSeed]);

    await DirectoryPresenceSeedService.updateStatus('seed-1', 'invited');

    const sql = calls();
    expect(sql.some((s) => s.includes('UPDATE directory_presence_seeds'))).toBe(true);
    expect(sql.some((s) => s.includes('UPDATE directory_listings_list'))).toBe(false);
    expect(sql.some((s) => s.includes('UPDATE directory_settings_list'))).toBe(false);
  });
});

describe('updateStatus → published', () => {
  it('delegates to publishSeed instead of a bare status write', async () => {
    const publishSpy = vi
      .spyOn(DirectoryPresenceSeedService, 'publishSeed')
      .mockResolvedValue(undefined);

    await DirectoryPresenceSeedService.updateStatus('seed-1', 'published', {
      actorId: 'op-1',
      actorType: 'user',
    } as any);

    expect(publishSpy).toHaveBeenCalledWith('seed-1', {
      actorId: 'op-1',
      actorType: 'user',
    });
    // The bare write path must not run — publishSeed owns the whole publish.
    expect(mockExecuteRaw).not.toHaveBeenCalled();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('propagates the readiness gate refusal', async () => {
    vi.spyOn(DirectoryPresenceSeedService, 'publishSeed').mockRejectedValue(
      new Error('seed_not_publishable:template_description'),
    );

    await expect(
      DirectoryPresenceSeedService.updateStatus('seed-1', 'published'),
    ).rejects.toThrow(/seed_not_publishable:template_description/);
  });
});

describe('updateStatus guards', () => {
  it('rejects an unknown status', async () => {
    await expect(
      DirectoryPresenceSeedService.updateStatus('seed-1', 'archived'),
    ).rejects.toThrow('invalid_status');
  });

  it('throws seed_not_found for a missing seed', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);

    await expect(
      DirectoryPresenceSeedService.updateStatus('seed-missing', 'draft'),
    ).rejects.toThrow('seed_not_found');
  });
});
