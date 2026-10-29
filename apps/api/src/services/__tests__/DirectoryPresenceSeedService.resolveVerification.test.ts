/**
 * DirectoryPresenceSeedService.resolveVerification — the seed-scoped record
 * verification (the cockpit's Verify record modal, POST
 * /presence-seeds/:id/resolve-verification).
 *
 * Covers:
 *   - verified NAP lands on the NAP ledger + provenance with source
 *     'seed_verification' and owner_* evidence_state (shared
 *     applyVerificationBackfill helper)
 *   - corrected fields write back to the public listing
 *   - social/directory profile URLs MERGE into directory_listings_list.same_as
 *   - owner contact lands on dps.owner_* and upgrades contact_status
 *   - a connected call stamps outreach_status and logs a touch
 *   - 'unreachable' logs only the touch — no verified facts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockQueryRaw,
  mockExecuteRaw,
  mockExecuteRawUnsafe,
  mockAudit,
  mockRefreshReport,
  mockComputeFidelity,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockExecuteRawUnsafe: vi.fn(),
  mockAudit: vi.fn(),
  mockRefreshReport: vi.fn(),
  mockComputeFidelity: vi.fn(),
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

vi.mock('../intelligence/SeedIntelligenceReportService.js', () => ({
  SeedIntelligenceReportService: {
    getInstance: () => ({ refreshReport: mockRefreshReport }),
  },
}));

vi.mock('../seed-fidelity.js', () => ({
  computeAndStoreSeedFidelity: mockComputeFidelity,
}));

import DirectoryPresenceSeedService from '../DirectoryPresenceSeedService';

function sqlOf(call: any[]): string {
  const first = call[0];
  if (typeof first === 'string') return first;
  if (Array.isArray(first)) return first.join('');
  return '';
}

const seedRow = {
  tenant_id: 'tnt-test',
  listing_id: 'lst-test',
  contact_status: 'contact_unverified',
  same_as: ['https://facebook.com/theshop'],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Content-addressed $queryRaw — resolveVerification reads the seed row
  // (with same_as), the back-fill re-reads tenant/listing ids, then the
  // current provenance, then the touch's tenant lookup.
  mockQueryRaw.mockImplementation((strings: any) => {
    const sql = Array.isArray(strings) ? strings.join('') : String(strings);
    if (sql.includes('dl.same_as')) return Promise.resolve([seedRow]);
    if (sql.includes('directory_field_provenance')) {
      return Promise.resolve([{ field_key: 'phone', value: '555-0001' }]);
    }
    if (sql.includes('FROM directory_presence_seeds')) {
      return Promise.resolve([{ tenant_id: 'tnt-test', listing_id: 'lst-test' }]);
    }
    return Promise.resolve([]);
  });
  mockExecuteRaw.mockResolvedValue(1);
  mockExecuteRawUnsafe.mockResolvedValue(1);
  mockRefreshReport.mockResolvedValue(undefined);
  mockComputeFidelity.mockResolvedValue(null);
});

describe('resolveVerification', () => {
  it('writes verified NAP to the ledger, provenance, and listing; merges same_as; lands owner contact; logs the touch', async () => {
    await DirectoryPresenceSeedService.resolveVerification('seed-test', {
      outcome: 'operational',
      verifiedPhone: '555-9999',
      verifiedSocialProfiles: [
        { platform: 'instagram', url: 'https://instagram.com/theshop' },
        { platform: 'facebook', url: 'https://facebook.com/theshop' },
      ],
      verifiedOwnerPhone: '555-0199',
      verifiedOwnerEmail: 'owner@theshop.com',
      callNotes: 'Owner confirmed on the call',
    });

    // NAP ledger — phone differs from current provenance → owner_corrected row.
    const napInsert = mockExecuteRaw.mock.calls.find((c: any[]) =>
      sqlOf(c).includes('directory_seed_nap_verifications'),
    );
    expect(napInsert).toBeDefined();
    const diffArg = (napInsert as any[])
      .slice(1)
      .find((a) => typeof a === 'string' && a.includes('"phone"'));
    expect(JSON.parse(diffArg).phone.corrected).toBe('555-9999');

    // Provenance upsert — seed_verification source, owner_corrected state.
    const provInsert = mockExecuteRaw.mock.calls.find((c: any[]) =>
      sqlOf(c).includes('INSERT INTO directory_field_provenance'),
    );
    expect(provInsert).toBeDefined();
    const provArgs = (provInsert as any[]).slice(1);
    expect(provArgs).toContain('seed_verification');
    expect(provArgs).toContain('owner_corrected');
    expect(provArgs).toContain('555-9999');

    // Corrected field writes back to the public listing.
    const listingUpdate = mockExecuteRawUnsafe.mock.calls
      .map((c: any[]) => sqlOf(c))
      .find((sql: string) => sql.includes('UPDATE directory_listings_list SET phone'));
    expect(listingUpdate).toBeDefined();

    // same_as merge — the new instagram URL joins the existing facebook one.
    const sameAsUpdate = mockExecuteRaw.mock.calls.find((c: any[]) =>
      sqlOf(c).includes('SET same_as'),
    );
    expect(sameAsUpdate).toBeDefined();
    const merged = (sameAsUpdate as any[])
      .slice(1)
      .find((a) => Array.isArray(a));
    expect(merged).toEqual([
      'https://facebook.com/theshop',
      'https://instagram.com/theshop',
    ]);

    // Owner contact + contact_status upgrade + verified_by_call milestone.
    const ownerUpdate = mockExecuteRawUnsafe.mock.calls
      .map((c: any[]) => sqlOf(c))
      .find((sql: string) => sql.includes('owner_email'));
    expect(ownerUpdate).toBeDefined();
    expect(ownerUpdate).toContain("contact_status = 'contactable'");
    expect(ownerUpdate).toContain('verified_by_call');

    // The call itself is a touch.
    const touchInsert = mockExecuteRaw.mock.calls.find((c: any[]) =>
      sqlOf(c).includes('directory_seed_outreach_touches'),
    );
    expect(touchInsert).toBeDefined();
    const touchArgs = (touchInsert as any[]).slice(1);
    expect(touchArgs).toContain('call');
    expect(touchArgs).toContain('connected');

    // Report + fidelity recompute ride the shared back-fill.
    expect(mockRefreshReport).toHaveBeenCalledWith('seed-test');
    expect(mockComputeFidelity).toHaveBeenCalledWith('seed-test');
  });

  it('logs only the touch on an unreachable outcome — no verified facts', async () => {
    await DirectoryPresenceSeedService.resolveVerification('seed-test', {
      outcome: 'unreachable',
      verifiedPhone: '555-9999',
      verifiedOwnerEmail: 'owner@theshop.com',
    });

    const napInsert = mockExecuteRaw.mock.calls.find((c: any[]) =>
      sqlOf(c).includes('directory_seed_nap_verifications'),
    );
    expect(napInsert).toBeUndefined();

    const provInsert = mockExecuteRaw.mock.calls.find((c: any[]) =>
      sqlOf(c).includes('INSERT INTO directory_field_provenance'),
    );
    expect(provInsert).toBeUndefined();

    const touchInsert = mockExecuteRaw.mock.calls.find((c: any[]) =>
      sqlOf(c).includes('directory_seed_outreach_touches'),
    );
    expect(touchInsert).toBeDefined();
    expect((touchInsert as any[]).slice(1)).toContain('no_answer');
  });

  it('does not rewrite same_as when every submitted URL is already listed', async () => {
    await DirectoryPresenceSeedService.resolveVerification('seed-test', {
      outcome: 'operational',
      verifiedSocialProfiles: [{ platform: 'facebook', url: 'https://facebook.com/theshop' }],
    });

    const sameAsUpdate = mockExecuteRaw.mock.calls.find((c: any[]) =>
      sqlOf(c).includes('SET same_as'),
    );
    expect(sameAsUpdate).toBeUndefined();
  });

  it('rejects with seed_not_found for an unknown seed', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await expect(
      DirectoryPresenceSeedService.resolveVerification('nope', { outcome: 'operational' }),
    ).rejects.toThrow('seed_not_found');
  });
});
