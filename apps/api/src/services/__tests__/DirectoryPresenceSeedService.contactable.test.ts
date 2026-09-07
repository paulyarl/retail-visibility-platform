/**
 * DirectoryPresenceSeedService.createSeed — contactable derivation (W9)
 *
 * Verifies the seed-funnel analytics spec §7 gap 1:
 * - A seed with a listing phone OR owner phone is derived as 'contactable'
 * - A seed with neither is derived as 'contact_unverified' (never 'unreachable')
 * - contact_status_derived_at is stamped at ingest
 *
 * See: docs/LocalBiz/seed_funnel_benchmark_gates_and_analytics_spec.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockQueryRawUnsafe, mockExecuteRaw, mockExecuteRawUnsafe, mockAudit } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockQueryRawUnsafe: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockExecuteRawUnsafe: vi.fn(),
  mockAudit: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $queryRawUnsafe: mockQueryRawUnsafe,
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

// Prisma tagged-template literals (prisma.$executeRaw`...`) call the mock with
// the cooked string fragments as an array in arg[0] and the interpolated values
// as the remaining args. This helper joins the fragments for substring asserts.
function sqlOf(call: any[]): string {
  const first = call[0];
  if (typeof first === 'string') return first;
  if (Array.isArray(first)) return first.join('');
  return '';
}

beforeEach(() => {
  vi.clearAllMocks();
  // createSeed queries for slug uniqueness before inserting
  mockQueryRaw.mockResolvedValue([]);
  // listSeeds (called at the end of createSeed) uses $queryRawUnsafe
  mockQueryRawUnsafe.mockResolvedValue([]);
  mockExecuteRaw.mockResolvedValue(1);
  mockExecuteRawUnsafe.mockResolvedValue(1);
});

describe('createSeed — contactable derivation (spec §7 gap 1)', () => {
  it('derives contactable when a listing phone is present', async () => {
    await DirectoryPresenceSeedService.createSeed({
      businessName: 'Test Market',
      address: '100 State St',
      city: 'Madison',
      state: 'WI',
      phone: '555-0001',
      primaryCategory: 'Indian Grocery Store',
      seedBatch: 'test-batch',
      identityConfidence: 'high',
      categoryFit: 'verified',
    });

    // Find the INSERT INTO directory_presence_seeds call
    const seedInsert = mockExecuteRaw.mock.calls.find(
      (c: any[]) => sqlOf(c).includes('INSERT INTO directory_presence_seeds'),
    );
    expect(seedInsert).toBeDefined();

    // The contactStatus value is bound as a parameter after the seoEnrichment
    // jsonb. Locate it among the interpolated args.
    const insertSql = sqlOf(seedInsert);
    expect(insertSql).toContain('contact_status');
    expect(insertSql).toContain('contact_status_derived_at');

    // The 'contactable' string is interpolated as a parameter — find it
    const args = (seedInsert as any[]).slice(1);
    expect(args).toContain('contactable');
  });

  it('derives contactable when only an owner phone is present (no listing phone)', async () => {
    await DirectoryPresenceSeedService.createSeed({
      businessName: 'Test Market',
      address: '100 State St',
      city: 'Madison',
      state: 'WI',
      ownerPhone: '555-0002',
      primaryCategory: 'Indian Grocery Store',
      seedBatch: 'test-batch',
      identityConfidence: 'high',
      categoryFit: 'verified',
    });

    const seedInsert = mockExecuteRaw.mock.calls.find(
      (c: any[]) => sqlOf(c).includes('INSERT INTO directory_presence_seeds'),
    );
    expect(seedInsert).toBeDefined();
    const args = (seedInsert as any[]).slice(1);
    expect(args).toContain('contactable');
  });

  it('derives contact_unverified when neither listing phone nor owner phone is present', async () => {
    await DirectoryPresenceSeedService.createSeed({
      businessName: 'No-Phone Market',
      address: '200 State St',
      city: 'Madison',
      state: 'WI',
      primaryCategory: 'Indian Grocery Store',
      seedBatch: 'test-batch',
      identityConfidence: 'medium',
      categoryFit: 'probable',
    });

    const seedInsert = mockExecuteRaw.mock.calls.find(
      (c: any[]) => sqlOf(c).includes('INSERT INTO directory_presence_seeds'),
    );
    expect(seedInsert).toBeDefined();
    const args = (seedInsert as any[]).slice(1);
    expect(args).toContain('contact_unverified');
    // Never 'unreachable' — that state is not in the spec
    expect(args).not.toContain('unreachable');
  });

  it('derives contactable when both listing phone and owner phone are present', async () => {
    await DirectoryPresenceSeedService.createSeed({
      businessName: 'Dual-Phone Market',
      address: '300 State St',
      city: 'Madison',
      state: 'WI',
      phone: '555-0001',
      ownerPhone: '555-0002',
      primaryCategory: 'Indian Grocery Store',
      seedBatch: 'test-batch',
      identityConfidence: 'high',
      categoryFit: 'verified',
    });

    const seedInsert = mockExecuteRaw.mock.calls.find(
      (c: any[]) => sqlOf(c).includes('INSERT INTO directory_presence_seeds'),
    );
    const args = (seedInsert as any[]).slice(1);
    expect(args).toContain('contactable');
  });
});
