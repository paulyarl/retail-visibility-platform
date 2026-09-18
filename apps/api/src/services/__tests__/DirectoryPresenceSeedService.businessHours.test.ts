/**
 * DirectoryPresenceSeedService — verified business hours carry (migration 296)
 *
 * The proving-ground preflight seeds straight from the queue entry (no
 * campaign leg), so it must read the hours the verification call captured on
 * the snapshot. This locks that carry: `snapshot.hours` wins, with
 * `snapshot.verified_nap.hours` as the fallback.
 *
 * See: database/migrations/296_mkt_campaign_business_hours.sql
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

const HOURS = {
  monday: { open: '09:00', close: '17:00', closed: false },
  sunday: { open: '09:00', close: '18:00', closed: true },
};

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
  category: 'restaurant',
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

describe('createSeedsForProvingGround — verified hours carry', () => {
  it('passes snapshot.hours onto the seed', async () => {
    const input = await captureSeedInput(
      baseEntry({ business_snapshot: { address: '1 Main St', hours: HOURS } }),
    );
    expect(input.businessHours).toEqual(HOURS);
  });

  it('falls back to snapshot.verified_nap.hours', async () => {
    const input = await captureSeedInput(
      baseEntry({ business_snapshot: { address: '1 Main St', verified_nap: { hours: HOURS } } }),
    );
    expect(input.businessHours).toEqual(HOURS);
  });

  it('leaves businessHours undefined when no hours were captured', async () => {
    const input = await captureSeedInput(baseEntry({ business_snapshot: { address: '1 Main St' } }));
    expect(input.businessHours).toBeUndefined();
  });
});
