/**
 * DirectoryPresenceSeedService — secondary shelf carry (queue → batch seed)
 *
 * The queue card writes the discovery scan's suggested_categories labels
 * (minus the resolved primary) into business_snapshot.secondary_categories.
 * The proving-ground preflight seeds straight from the queue entry (no
 * campaign leg), so it must read them onto the listing's
 * secondary_categories and stamp a matching provenance row.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecuteRaw, mockQueryRaw, mockAudit, mockLinkCampaign } = vi.hoisted(() => ({
  mockExecuteRaw: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockAudit: vi.fn(),
  mockLinkCampaign: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: { $executeRaw: mockExecuteRaw, $queryRaw: mockQueryRaw },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({ audit: mockAudit }));

vi.mock('../email-service', () => ({
  emailService: { send: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../DirectorySeedCampaignLinkService', () => ({
  default: { linkSeedToCampaign: vi.fn(), findPrimaryForCampaign: vi.fn(), linkCampaign: mockLinkCampaign },
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

vi.mock('../directory/SeedSeoComposer', () => ({
  buildSeedSeoPacket: vi.fn(() => ({})),
  buildSeoEnrichmentJson: vi.fn(() => ({})),
}));

vi.mock('../intelligence/IntelligenceProfileService', () => ({
  default: { getInstance: () => ({}) },
}));

import DirectoryPresenceSeedService from '../DirectoryPresenceSeedService';

/** Capture the seedInput the service hands to createSeed. */
async function captureSeedInput(entry: any) {
  const createSeedSpy = vi
    .spyOn(DirectoryPresenceSeedService, 'createSeed')
    .mockResolvedValue({ id: 'seed-new-1' } as any);
  vi.spyOn(DirectoryPresenceSeedService, 'publishSeed').mockResolvedValue(undefined as any);
  vi.spyOn(DirectoryPresenceSeedService, 'inviteSeed').mockResolvedValue({
    token: 'tok', expiresAt: new Date(), shortCode: null,
  } as any);

  // 1st $queryRaw: the queue entries. 2nd: the duplicate-seed guard.
  mockQueryRaw.mockResolvedValueOnce([entry]).mockResolvedValueOnce([]);

  await DirectoryPresenceSeedService.createSeedsForProvingGround(['pque-1'], 'pg-batch');

  const input = createSeedSpy.mock.calls[0][0] as any;
  createSeedSpy.mockRestore();
  return input;
}

const baseEntry = (overrides: Partial<any> = {}) => ({
  id: 'pque-1',
  business_name: 'Joe Pizza',
  title: 'Joe Pizza',
  city: 'Austin',
  state: 'TX',
  category: 'African Grocery Store',
  seed_id: null,
  source_campaign_id: null,
  proving_ground_id: null,
  seek_batch_id: null,
  identity_confidence: 'high',
  category_fit: 'verified',
  note: null,
  discovery_provenance: [],
  business_snapshot: {},
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(undefined);
  mockAudit.mockResolvedValue(undefined);
  mockLinkCampaign.mockResolvedValue(undefined);
});

describe('createSeedsForProvingGround — secondary category carry', () => {
  it('passes snapshot.secondary_categories onto the seed', async () => {
    const input = await captureSeedInput(
      baseEntry({ business_snapshot: { secondary_categories: ['Halal Grocery Store', 'International Grocery Store'] } }),
    );
    expect(input.secondaryCategories).toEqual(['Halal Grocery Store', 'International Grocery Store']);
  });

  it('excludes the resolved primary (case-insensitive) and dedupes', async () => {
    const input = await captureSeedInput(
      baseEntry({
        business_snapshot: {
          secondary_categories: ['african grocery store', 'Halal Grocery Store', 'Halal Grocery Store', '  '],
        },
      }),
    );
    expect(input.secondaryCategories).toEqual(['Halal Grocery Store']);
  });

  it('tolerates {category} object entries', async () => {
    const input = await captureSeedInput(
      baseEntry({
        business_snapshot: {
          secondary_categories: [{ category: 'Halal Grocery Store', confidence: 'high' }, 'Butcher Shop'],
        },
      }),
    );
    expect(input.secondaryCategories).toEqual(['Halal Grocery Store', 'Butcher Shop']);
  });

  it('leaves secondaryCategories undefined when none were captured', async () => {
    const input = await captureSeedInput(baseEntry({ business_snapshot: { address: '1 Main St' } }));
    expect(input.secondaryCategories).toBeUndefined();
  });
});

describe('createSeedsForProvingGround — secondary category provenance', () => {
  const secRow = (input: any) =>
    (input.provenance as any[]).find((p) => p.fieldKey === 'secondary_categories');

  it('cites the discovery scan at medium confidence, public', async () => {
    const input = await captureSeedInput(baseEntry({
      business_snapshot: { secondary_categories: ['Halal Grocery Store', 'Butcher Shop'] },
    }));
    expect(secRow(input)).toMatchObject({
      sourceName: 'discovery_scan',
      confidence: 'medium',
      showOnPublic: true,
      value: 'Halal Grocery Store, Butcher Shop',
    });
  });

  it('emits no secondary_categories provenance row when none were captured', async () => {
    const input = await captureSeedInput(baseEntry({ business_snapshot: {} }));
    expect(secRow(input)).toBeUndefined();
  });
});

describe('createSeedsFromBatch — secondary category carry', () => {
  async function captureBatchSeedInput(entry: any) {
    const createSeedSpy = vi
      .spyOn(DirectoryPresenceSeedService, 'createSeed')
      .mockResolvedValue({ id: 'seed-new-1' } as any);

    // 1st $queryRaw: the queue entries. 2nd: the duplicate-seed guard.
    mockQueryRaw.mockResolvedValueOnce([entry]).mockResolvedValueOnce([]);

    await DirectoryPresenceSeedService.createSeedsFromBatch(['pque-1'], 'batch-x');

    const input = createSeedSpy.mock.calls[0][0] as any;
    createSeedSpy.mockRestore();
    return input;
  }

  it('carries snapshot.secondary_categories onto the seed', async () => {
    const input = await captureBatchSeedInput(
      baseEntry({ business_snapshot: { secondary_categories: ['Halal Grocery Store'] } }),
    );
    expect(input.secondaryCategories).toEqual(['Halal Grocery Store']);
    expect(
      (input.provenance as any[]).find((p) => p.fieldKey === 'secondary_categories'),
    ).toMatchObject({ sourceName: 'discovery_scan', confidence: 'medium' });
  });
});
