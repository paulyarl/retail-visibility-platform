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

const { mockQueryRaw, mockExecuteRaw, mockExecuteRawUnsafe, mockAudit, mockRefreshReport } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockExecuteRawUnsafe: vi.fn(),
  mockAudit: vi.fn(),
  mockRefreshReport: vi.fn(),
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

// The report refresh is a §5.1 trigger — mocked so the suite asserts the
// call rather than running the builder against stubbed substrate rows.
vi.mock('../intelligence/SeedIntelligenceReportService.js', () => ({
  SeedIntelligenceReportService: {
    getInstance: () => ({ refreshReport: mockRefreshReport }),
  },
}));

import DirectoryPresenceSeedService from '../DirectoryPresenceSeedService';

// Prisma tagged-template literals (prisma.$executeRaw`...`) call the mock with
// the cooked string fragments as an array in arg[0] and the interpolated values
// as the remaining args. Plain $executeRawUnsafe calls pass a string in arg[0].
// This helper normalizes either shape to the joined SQL string for substring
// assertions.
function sqlOf(call: any[]): string {
  const first = call[0];
  if (typeof first === 'string') return first;
  if (Array.isArray(first)) return first.join('');
  return '';
}

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
      .map((c: any[]) => sqlOf(c))
      .find((sql: string) => sql.includes('directory_seed_nap_verifications'));
    expect(insertSql).toBeDefined();

    // The diff JSON is bound as a parameter; locate it among the call args of
    // the INSERT ($executeRaw template args follow the SQL string fragments).
    const insertCall = mockExecuteRaw.mock.calls.find((c: any[]) =>
      sqlOf(c).includes('directory_seed_nap_verifications'),
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
      .map((c: any[]) => sqlOf(c))
      .find((sql: string) => sql.includes('nap_owner_corrected = TRUE'));
    expect(flagSql).toBeDefined();
  });

  it('does not record a verification when nothing NAP-related changed', async () => {
    mockQueryRaw.mockResolvedValue([claimedSeedRow]);

    await DirectoryPresenceSeedService.updateFields('seed-test', { snapEbtReported: true });

    const verificationSql = mockExecuteRaw.mock.calls
      .map((c: any[]) => sqlOf(c))
      .find((sql: string) => sql.includes('directory_seed_nap_verifications'));
    expect(verificationSql).toBeUndefined();
  });

  it('does not record a verification for unclaimed seeds', async () => {
    mockQueryRaw.mockResolvedValue([{ ...claimedSeedRow, seed_status: 'published' }]);

    await DirectoryPresenceSeedService.updateFields('seed-test', { phone: '555-9999' });

    const verificationSql = mockExecuteRaw.mock.calls
      .map((c: any[]) => sqlOf(c))
      .find((sql: string) => sql.includes('directory_seed_nap_verifications'));
    expect(verificationSql).toBeUndefined();
  });

  it('excludes no-op writes from the diff (same value submitted)', async () => {
    mockQueryRaw.mockResolvedValue([claimedSeedRow]);

    await DirectoryPresenceSeedService.updateFields('seed-test', { phone: '555-0001' });

    const verificationSql = mockExecuteRaw.mock.calls
      .map((c: any[]) => sqlOf(c))
      .find((sql: string) => sql.includes('directory_seed_nap_verifications'));
    expect(verificationSql).toBeUndefined();
  });
});

// ─── Provenance + report refresh on identity edits ──────────────────────
//
// The minted intelligence report renders business_identity from the resolved
// listing + directory_field_provenance. A seed edit that moves a NAP field
// must (a) write an operator_override provenance row and (b) re-version the
// report — otherwise a printed/delivered report stays stale forever
// (Report QR Kit staleness regression).

describe('updateFields — identity provenance + report refresh', () => {
  it('writes an operator_override provenance row for a changed NAP field on an unclaimed seed', async () => {
    mockQueryRaw.mockResolvedValue([{ ...claimedSeedRow, seed_status: 'published' }]);

    await DirectoryPresenceSeedService.updateFields('seed-test', { address: '200 New Ave' });

    const provInserts = mockExecuteRaw.mock.calls.filter((c: any[]) =>
      sqlOf(c).includes('directory_field_provenance'),
    );
    expect(provInserts).toHaveLength(1);
    const args = provInserts[0].slice(1);
    expect(args).toContain('address');
    expect(args).toContain('200 New Ave');
    expect(args).toContain('operator_override');
  });

  it('re-versions the report when an unclaimed seed identity field changes', async () => {
    mockQueryRaw.mockResolvedValue([{ ...claimedSeedRow, seed_status: 'published' }]);

    await DirectoryPresenceSeedService.updateFields('seed-test', { address: '200 New Ave' });

    expect(mockRefreshReport).toHaveBeenCalledTimes(1);
    expect(mockRefreshReport.mock.calls[0][0]).toBe('seed-test');
  });

  it('does not refresh the report for non-identity edits', async () => {
    mockQueryRaw.mockResolvedValue([{ ...claimedSeedRow, seed_status: 'published' }]);

    await DirectoryPresenceSeedService.updateFields('seed-test', { snapEbtReported: true });

    expect(mockRefreshReport).not.toHaveBeenCalled();
    const provInserts = mockExecuteRaw.mock.calls.filter((c: any[]) =>
      sqlOf(c).includes('directory_field_provenance'),
    );
    expect(provInserts).toHaveLength(0);
  });

  it('caller-supplied provenance wins over the auto row for the same field', async () => {
    mockQueryRaw.mockResolvedValue([{ ...claimedSeedRow, seed_status: 'published' }]);

    await DirectoryPresenceSeedService.updateFields(
      'seed-test',
      { phone: '555-9999' },
      [{ fieldKey: 'phone', value: '555-9999', sourceName: 'owner_claim', confidence: 'high' }],
    );

    const provInserts = mockExecuteRaw.mock.calls.filter((c: any[]) =>
      sqlOf(c).includes('directory_field_provenance'),
    );
    expect(provInserts).toHaveLength(1);
    expect(provInserts[0].slice(1)).toContain('owner_claim');
    expect(provInserts[0].slice(1)).not.toContain('operator_override');
  });

  it('still fires the claimed-seed refresh after provenance writes (ordering)', async () => {
    mockQueryRaw.mockResolvedValue([claimedSeedRow]);

    await DirectoryPresenceSeedService.updateFields('seed-test', { phone: '555-9999' });

    expect(mockRefreshReport).toHaveBeenCalledTimes(1);
    // The provenance INSERT must land BEFORE the refresh call reads it back —
    // cross-mock invocation order is what pins that sequencing.
    const provIdx = mockExecuteRaw.mock.calls.findIndex((c: any[]) =>
      sqlOf(c).includes('directory_field_provenance'),
    );
    expect(provIdx).toBeGreaterThanOrEqual(0);
    expect(mockRefreshReport.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockExecuteRaw.mock.invocationCallOrder[provIdx],
    );
  });
});
