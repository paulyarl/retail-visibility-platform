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

describe('createSeedsForProvingGround — hours provenance', () => {
  const hoursRow = (input: any) =>
    (input.provenance as any[]).find((p) => p.fieldKey === 'hours');

  it('verification-captured hours cite the verification call at high confidence', async () => {
    const input = await captureSeedInput(baseEntry({
      business_snapshot: { address: '1 Main St', hours: HOURS, verified_nap: { hours: HOURS } },
    }));
    expect(hoursRow(input)).toMatchObject({
      sourceName: 'verification_call',
      confidence: 'high',
      showOnPublic: true,
    });
    expect(JSON.parse(hoursRow(input).value)).toEqual(HOURS);
  });

  it('scan-captured hours cite the discovery source listing hours evidence', async () => {
    const input = await captureSeedInput(baseEntry({
      business_snapshot: { address: '1 Main St', hours: HOURS },
      discovery_provenance: [
        { source: 'Loc8NearMe', role: 'mainstream_directory', url: 'https://loc8.example/x', accessed_at: '2026-09-10', evidence_types: ['address', 'phone', 'hours'] },
        { source: 'SOS registry', role: 'certification', evidence_types: ['entity'] },
      ],
    }));
    expect(hoursRow(input)).toMatchObject({
      sourceName: 'Loc8NearMe',
      sourceUrl: 'https://loc8.example/x',
      confidence: 'medium',
      showOnPublic: true,
    });
    expect(hoursRow(input).accessedAt).toEqual(new Date('2026-09-10'));
  });

  it('scan-captured hours without an hours-cited source fall back to discovery_scan', async () => {
    const input = await captureSeedInput(baseEntry({
      business_snapshot: { address: '1 Main St', hours: HOURS },
      discovery_provenance: [
        { source: 'Google', role: 'directory', evidence_types: ['address'] },
      ],
    }));
    expect(hoursRow(input)).toMatchObject({
      sourceName: 'discovery_scan',
      confidence: 'medium',
      showOnPublic: true,
    });
  });

  it('emits no hours provenance row when no hours were captured', async () => {
    const input = await captureSeedInput(baseEntry({
      business_snapshot: { address: '1 Main St' },
      discovery_provenance: [{ source: 'Google', role: 'directory', evidence_types: ['hours'] }],
    }));
    expect(hoursRow(input)).toBeUndefined();
  });
});
