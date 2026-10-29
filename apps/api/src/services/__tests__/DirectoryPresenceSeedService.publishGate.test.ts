/**
 * DirectoryPresenceSeedService publish gate (§4.8).
 *
 * The first seed wave published NAP-template copy, and Google crawled it as
 * thin content. `publishSeed` must now refuse template copy, junk NAP, missing
 * categories, and live duplicates. Owner-submitted seeds bypass the gate
 * explicitly (`{ force: true }`), so this suite also pins that the default is
 * closed.
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

const DISCLOSURE = 'Listed on VisibleShelf from public information (address, phone).';

const templateSeed = {
  status: 'draft',
  category: 'African Grocery Store',
  business_name: 'Royal African Market LLC',
  description: `Royal African Market LLC is a African Grocery Store. ${DISCLOSURE}`,
  address: '3071 N High School Rd, Indianapolis, IN 46224',
  city: 'Indianapolis',
  phone: '(317) 371-0837',
};

const enrichedSeed = {
  ...templateSeed,
  business_name: 'Manna African Caribbean Market',
  description: `Family-owned Fort Wayne market specializing in African and Caribbean groceries, with a fresh meat counter and imported staples. ${DISCLOSURE}`,
  address: '1732 Lake Ave, Fort Wayne, IN 46805',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(1);
});

describe('getSeedPublishReadiness', () => {
  it('blocks the first-wave template copy', async () => {
    mockQueryRaw.mockResolvedValueOnce([templateSeed]);

    const readiness = await DirectoryPresenceSeedService.getSeedPublishReadiness('seed-1');

    expect(readiness.publishable).toBe(false);
    expect(readiness.blockers).toContain('template_description');
  });

  it('blocks a live duplicate of an enriched seed', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([enrichedSeed])
      .mockResolvedValueOnce([{ slug: 'manna-african-caribbean-market-2' }]);

    const readiness = await DirectoryPresenceSeedService.getSeedPublishReadiness('seed-2');

    expect(readiness.publishable).toBe(false);
    expect(readiness.blockers).toContain('duplicate_seed');
    expect(readiness.duplicateOf).toBe('manna-african-caribbean-market-2');
  });

  it('passes an enriched, unique seed', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([enrichedSeed])
      .mockResolvedValueOnce([]);

    const readiness = await DirectoryPresenceSeedService.getSeedPublishReadiness('seed-3');

    expect(readiness.publishable).toBe(true);
    expect(readiness.blockers).toEqual([]);
  });

  it('scopes the duplicate check to the seed listing (regression: missing dll alias)', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([enrichedSeed])
      .mockResolvedValueOnce([]);

    await DirectoryPresenceSeedService.getSeedPublishReadiness('seed-4');

    const duplicateSql = String(mockQueryRaw.mock.calls[1][0]);
    expect(duplicateSql).toContain('WITH self AS');
    expect(duplicateSql).toContain('CROSS JOIN self');
    expect(duplicateSql).toContain('self.phone');
    expect(duplicateSql).toContain('self.address');
    expect(duplicateSql).toContain('self.city');
  });
});

describe('publishSeed', () => {
  it('refuses template copy by default', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ tenant_id: 'ten-1', listing_id: 'lst-1', status: 'draft' }])
      .mockResolvedValueOnce([templateSeed]);

    await expect(DirectoryPresenceSeedService.publishSeed('seed-1')).rejects.toThrow(
      /seed_not_publishable:.*template_description/,
    );
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('lets an explicit force bypass the gate for owner-submitted seeds', async () => {
    const readinessSpy = vi.spyOn(
      DirectoryPresenceSeedService,
      'getSeedPublishReadiness',
    );
    vi.spyOn(DirectoryPresenceSeedService as any, 'resolveIntakeTickets').mockResolvedValue(undefined);
    vi.spyOn(DirectoryPresenceSeedService as any, 'notifyOwnerSeedPublished').mockResolvedValue(undefined);

    mockQueryRaw
      .mockResolvedValueOnce([{ tenant_id: 'ten-1', listing_id: 'lst-1', status: 'draft' }])
      .mockResolvedValue([]);

    await DirectoryPresenceSeedService.publishSeed('seed-1', undefined, { force: true });

    expect(readinessSpy).not.toHaveBeenCalled();
    expect(
      mockExecuteRaw.mock.calls.some((c) =>
        String(c[0]).includes('UPDATE directory_listings_list'),
      ),
    ).toBe(true);
  });
});
