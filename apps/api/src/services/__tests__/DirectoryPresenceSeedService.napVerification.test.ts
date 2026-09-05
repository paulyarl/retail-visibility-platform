/**
 * DirectoryPresenceSeedService.updateFields — NAP owner-correction capture
 *
 * Verifies the seed-funnel analytics plumbing (spec §7 gap 2):
 * - A NAP change on a CLAIMED seed inserts a directory_seed_nap_verifications
 *   row with the field-level diff and flags the seed nap_owner_corrected
 * - Non-NAP changes on claimed seeds do NOT create verification rows
 * - NAP changes on unclaimed seeds do NOT create verification rows
 * - Only actually-changed fields appear in the diff (no-op writes excluded)
 *
 * See: docs/LocalBiz/seed_funnel_benchmark_gates_and_analytics_spec.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockExecuteRaw, mockExecuteRawUnsafe, mockAudit } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockExecuteRawUnsafe: vi.fn(),
  mockAudit: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    $executeRawUnsafe: mockExecuteRawUnsafe,
    business_hours_list: { upsert: vi.fn() },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({
  audit: mockAudit,
}));

vi.mock('../email-service', () => ({
  emailService: { send: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../DirectorySeedCampaignLinkService', () => ({
  default: { linkSeedToCampaign: vi.fn(), findPrimaryForCampaign: vi.fn() },
}));

vi.mock('../SeedOutreachTriggerService', () => ({
  SeedOutreachTriggerService: { getInstance: () => ({ onSeedCreated: vi.fn() }) },
}));

vi.mock('../../utils/slug', () => ({
  isReservedPlaceSlug: vi.fn(() => false),
}));

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

const claimedSeedRow = {
  tenant_id: 'tnt-test',
  listing_id: 'lst-test',
  seed_status: 'claimed',
  phone: '555-0001',
  address: '100 State St',
  city: 'Madison',
  state: 'WI',
  zip_code: '53703',
  website: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateFields — NAP owner-correction capture', () => {
  it('records a verification row with the field-level diff when a claimed seed changes its phone', async () => {
    mockQueryRaw.mockResolvedValue([claimedSeedRow]);

    await DirectoryPresenceSeedService.updateFields('seed-test', {
      phone: '555-9999',
      snapEbtReported: true,
    });

    const insertSql = mockExecuteRaw.mock.calls
      .map((c: any[]) => (typeof c[0] === 'string' ? c[0] : ''))
      .find((sql: string) => sql.includes('directory_seed_nap_verifications'));
    expect(insertSql).toBeDefined();

    // The diff JSON is bound as a parameter; locate it among the call args of
    // the INSERT ($executeRaw template args follow the SQL string).
    const insertCall = mockExecuteRaw.mock.calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('directory_seed_nap_verifications'),
    );
    const diffArg = (insertCall as any[]).slice(1).find((a) => typeof a === 'string' && a.includes('"phone"'));
    expect(diffArg).toBeDefined();
    const diff = JSON.parse(diffArg);
    expect(diff.phone).toEqual({ from: '555-0001', to: '555-9999' });
    expect(Object.keys(diff)).toEqual(['phone']);
  });

  it('flags the seed nap_owner_corrected after a claimed NAP change', async () => {
    mockQueryRaw.mockResolvedValue([claimedSeedRow]);

    await DirectoryPresenceSeedService.updateFields('seed-test', { phone: '555-9999' });

    const flagSql = mockExecuteRaw.mock.calls
      .map((c: any[]) => (typeof c[0] === 'string' ? c[0] : ''))
      .find((sql: string) => sql.includes('nap_owner_corrected = TRUE'));
    expect(flagSql).toBeDefined();
  });

  it('does not record a verification when nothing NAP-related changed', async () => {
    mockQueryRaw.mockResolvedValue([claimedSeedRow]);

    await DirectoryPresenceSeedService.updateFields('seed-test', { snapEbtReported: true });

    const verificationSql = mockExecuteRaw.mock.calls
      .map((c: any[]) => (typeof c[0] === 'string' ? c[0] : ''))
      .find((sql: string) => sql.includes('directory_seed_nap_verifications'));
    expect(verificationSql).toBeUndefined();
  });

  it('does not record a verification for unclaimed seeds', async () => {
    mockQueryRaw.mockResolvedValue([{ ...claimedSeedRow, seed_status: 'published' }]);

    await DirectoryPresenceSeedService.updateFields('seed-test', { phone: '555-9999' });

    const verificationSql = mockExecuteRaw.mock.calls
      .map((c: any[]) => (typeof c[0] === 'string' ? c[0] : ''))
      .find((sql: string) => sql.includes('directory_seed_nap_verifications'));
    expect(verificationSql).toBeUndefined();
  });

  it('excludes no-op writes from the diff (same value submitted)', async () => {
    mockQueryRaw.mockResolvedValue([claimedSeedRow]);

    await DirectoryPresenceSeedService.updateFields('seed-test', { phone: '555-0001' });

    const verificationSql = mockExecuteRaw.mock.calls
      .map((c: any[]) => (typeof c[0] === 'string' ? c[0] : ''))
      .find((sql: string) => sql.includes('directory_seed_nap_verifications'));
    expect(verificationSql).toBeUndefined();
  });
});
