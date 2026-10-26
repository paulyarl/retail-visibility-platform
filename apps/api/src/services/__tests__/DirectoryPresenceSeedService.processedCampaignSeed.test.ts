/**
 * createSeedsForProvingGround — campaign-first ordering heal.
 *
 * A queue entry can graduate to its business campaign BEFORE the
 * proving-ground preflight seeds it: createCampaignFromQueue's link +
 * seek→seed graduation only runs when queue.seed_id was already stamped
 * at promote time. The PG seeding path must converge the processed
 * campaign itself — 'sibling' link ('primary' stays with the producing
 * scan campaign) plus the preflight graduation — or the campaign never
 * learns about its seed ("Push draft seed" on a live listing).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecuteRaw, mockQueryRaw, mockAudit, mockLinkCampaign, mockGraduate, mockScheduleAnnounce } = vi.hoisted(() => ({
  mockExecuteRaw: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockAudit: vi.fn(),
  mockLinkCampaign: vi.fn(),
  mockGraduate: vi.fn(),
  mockScheduleAnnounce: vi.fn(),
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
  default: { linkCampaign: mockLinkCampaign },
}));

vi.mock('../MarketingCampaignService', () => ({
  default: { graduateCampaignForPreflightSeed: mockGraduate, createCampaign: vi.fn() },
}));

vi.mock('../SeedOutreachTriggerService', () => ({
  SeedOutreachTriggerService: { getInstance: () => ({ onSeedCreated: vi.fn() }) },
}));

vi.mock('../SeedAnnounceService.js', () => ({
  default: { scheduleForSeed: mockScheduleAnnounce },
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

const sqlText = (a: any) => (Array.isArray(a) ? a.join('') : String(a));

const baseEntry = (overrides: Partial<any> = {}) => ({
  id: 'pque-1',
  business_name: 'Joe Pizza',
  title: 'Joe Pizza',
  city: 'Austin',
  state: 'TX',
  category: 'restaurant',
  seed_id: null,
  processed_campaign_id: null,
  source_campaign_id: 'mcamp-src',
  proving_ground_id: null,
  seek_batch_id: null,
  identity_confidence: 'high',
  category_fit: 'verified',
  note: null,
  discovery_provenance: [],
  business_snapshot: {},
  ...overrides,
});

/**
 * Route the raw queries by content: queue entries, the campaign→seed
 * link lookups (live-link heal check vs the helper's pair check), and
 * the same-business duplicate guard.
 */
function mockRawQueries(opts: { entries: any[]; liveLinkedSeed?: any[]; pairLink?: any[] }) {
  mockQueryRaw.mockImplementation(async (strings: any) => {
    const q = sqlText(strings);
    if (q.includes('SELECT link_role')) return opts.pairLink ?? [];
    if (q.includes('directory_seed_campaign_links')) return opts.liveLinkedSeed ?? [];
    if (q.includes('mkt_prospect_queue')) return opts.entries;
    if (q.includes('directory_presence_seeds')) return [];
    return [];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(undefined);
  mockAudit.mockResolvedValue(undefined);
  mockLinkCampaign.mockResolvedValue({ link: null });
  mockGraduate.mockResolvedValue({ advanced: true });
  vi.spyOn(DirectoryPresenceSeedService, 'createSeed').mockResolvedValue({ id: 'seed-new-1' } as any);
  vi.spyOn(DirectoryPresenceSeedService, 'publishSeed').mockResolvedValue(undefined as any);
  vi.spyOn(DirectoryPresenceSeedService, 'inviteSeed').mockResolvedValue({
    token: 'tok', expiresAt: new Date(), shortCode: null,
  } as any);
});

describe('createSeedsForProvingGround — processed-campaign heal', () => {
  it('links the minted seed to an already-graduated business campaign and graduates it', async () => {
    mockRawQueries({
      entries: [baseEntry({ processed_campaign_id: 'mcamp-proc' })],
    });

    const result = await DirectoryPresenceSeedService.createSeedsForProvingGround(['pque-1'], 'pg-batch');

    expect(result.created).toEqual([{ queueEntryId: 'pque-1', seedId: 'seed-new-1', claimToken: 'tok' }]);
    // Producing scan campaign keeps 'primary'; the processed business
    // campaign attaches as 'sibling' (never 'primary' — single-primary
    // guard + non_primary_sibling rule).
    expect(mockLinkCampaign).toHaveBeenCalledWith('seed-new-1', 'mcamp-src', 'primary', undefined);
    expect(mockLinkCampaign).toHaveBeenCalledWith('seed-new-1', 'mcamp-proc', 'sibling', undefined);
    expect(mockGraduate).toHaveBeenCalledWith(
      'mcamp-proc',
      'seed-new-1',
      expect.objectContaining({ region: 'us-east-1' }),
    );
  });

  it('heals a missing processed-campaign link for an already-seeded entry', async () => {
    mockRawQueries({
      entries: [baseEntry({ seed_id: 'dps-existing', processed_campaign_id: 'mcamp-proc' })],
      pairLink: [],
    });

    const result = await DirectoryPresenceSeedService.createSeedsForProvingGround(['pque-1'], 'pg-batch');

    expect(result.skipped).toEqual([{ queueEntryId: 'pque-1', reason: 'already_seeded' }]);
    expect(DirectoryPresenceSeedService.createSeed).not.toHaveBeenCalled();
    expect(mockLinkCampaign).toHaveBeenCalledWith('dps-existing', 'mcamp-proc', 'sibling', undefined);
    expect(mockGraduate).toHaveBeenCalledWith('mcamp-proc', 'dps-existing', expect.objectContaining({ region: 'us-east-1' }));
  });

  it('does not rewrite an existing link row but still graduates the campaign', async () => {
    mockRawQueries({
      entries: [baseEntry({ seed_id: 'dps-existing', processed_campaign_id: 'mcamp-proc' })],
      pairLink: [{ link_role: 'primary' }],
    });

    await DirectoryPresenceSeedService.createSeedsForProvingGround(['pque-1'], 'pg-batch');

    // An existing link row must never be re-written — linkCampaign's
    // upsert would demote 'primary' to 'sibling'.
    expect(mockLinkCampaign).not.toHaveBeenCalled();
    expect(mockGraduate).toHaveBeenCalledWith('mcamp-proc', 'dps-existing', expect.objectContaining({ region: 'us-east-1' }));
  });

  it('leaves entries without a processed campaign untouched by the heal', async () => {
    mockRawQueries({
      entries: [baseEntry({ seed_id: 'dps-existing' })],
    });

    const result = await DirectoryPresenceSeedService.createSeedsForProvingGround(['pque-1'], 'pg-batch');

    expect(result.skipped).toEqual([{ queueEntryId: 'pque-1', reason: 'already_seeded' }]);
    expect(mockLinkCampaign).not.toHaveBeenCalled();
    expect(mockGraduate).not.toHaveBeenCalled();
  });
});
