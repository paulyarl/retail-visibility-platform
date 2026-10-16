/**
 * refreshSeedFidelityIfStale — spec D5 lazy refresh.
 *
 * The stored verdict has TWO invalidating inputs:
 *   - a newer source business_analysis audit (the original rule), and
 *   - a NAP verification/correction — nap_verified_at / nap_owner_corrected are
 *     verdict inputs, because an attested NAP makes the listing authoritative
 *     over the audit canonical (see evaluateSeedFidelity).
 *
 * The second rule is the regression: a seed verified AFTER its publish-time
 * verdict used to keep that verdict forever, so a stale 'misaligned' kept
 * degrading every claim surface (QR kits, claim links, report CTAs) to the
 * inquiry path. Repro: dps-329R-nf8nmoao — verdict written 2026-10-13,
 * campaign verification confirmed the NAP 2026-10-15, QR kit 404'd
 * `no_active_claim_token` until the verdict was recomputed.
 *
 * Queries are matched on their SQL rather than call order so the fixture does
 * not silently break when a read is added ahead of another.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockExecuteRaw, mockCampaignsList, mockAuditsList } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockCampaignsList: { findUnique: vi.fn() },
  mockAuditsList: { findMany: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    mkt_campaigns_list: mockCampaignsList,
    mkt_audits_list: mockAuditsList,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { refreshSeedFidelityIfStale } from '../seed-fidelity';

const SEED_ID = 'dps-329R-nf8nmoao';

/** The verified-but-sparse listing from the production incident. */
const LISTING_ROW = {
  id: SEED_ID,
  nap_verified_at: new Date('2026-10-15T22:13:33Z'),
  nap_owner_corrected: true,
  business_name: 'Arsema G Food Mart LLC',
  address: '6667 W Washington St, Unit A',
  city: 'Indianapolis',
  state: 'IN',
  phone: '(317) 603-3274',
  product_count: 0,
  business_hours: { monday: { open: '10:00', close: '21:30' } },
};

const CAMPAIGN = {
  id: 'mcamp-uvcasj3e',
  business_name: 'Arsema G Food Mart LLC',
  address_line1: '6667 W Washington St',
  address_city: 'Indianapolis',
  address_state: 'IN',
  phone: '(317) 603-3274',
};

const audit = (id: string) => ({
  id,
  platform: 'business_analysis',
  audit_data: {
    audit_metadata: {},
    nap_consistency: { canonical_address: '6667 W Washington St, Indianapolis, IN 46241' },
  },
});

interface Overrides {
  storedAuditId?: string | null;
  checkedAt?: Date | null;
  latestVerification?: Date | null;
  primaryCampaignId?: string | null;
  audits?: unknown[];
  listing?: unknown | null;
}

/** Wire the SQL-matched reads. `listing: null` = the seed row is gone. */
function mockReads(over: Overrides = {}) {
  const {
    storedAuditId = 'maud-old',
    checkedAt = new Date('2026-10-13T12:45:13Z'),
    latestVerification = null,
    primaryCampaignId = 'mcamp-uvcasj3e',
    audits = [audit('maud-old')],
    listing = LISTING_ROW,
  } = over;

  mockQueryRaw.mockImplementation(async (strings: readonly string[]) => {
    const sql = strings.join('');
    if (sql.includes('seed_fidelity_checked_at')) {
      return listing === null
        ? []
        : [{ seed_fidelity_audit_id: storedAuditId, seed_fidelity_checked_at: checkedAt }];
    }
    if (sql.includes('max(created_at)')) {
      return [{ latest: latestVerification }];
    }
    if (sql.includes('directory_seed_campaign_links')) {
      return primaryCampaignId ? [{ campaign_id: primaryCampaignId }] : [];
    }
    if (sql.includes('directory_photos')) return [{ n: 1 }];
    if (sql.includes('nap_verified_at')) return listing === null ? [] : [listing];
    return [];
  });

  mockCampaignsList.findUnique.mockResolvedValue(CAMPAIGN);
  mockAuditsList.findMany.mockResolvedValue(audits);
  mockExecuteRaw.mockResolvedValue(1);
}

/** The verdict write, if any. */
function fidelityWrites() {
  return mockExecuteRaw.mock.calls.filter(
    (c) => (c[0] as readonly string[]).join('').includes('seed_fidelity ='),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('refreshSeedFidelityIfStale', () => {
  it('recomputes when the latest NAP verification postdates the stored verdict', async () => {
    // The production incident: verdict 10-13, verification 10-15.
    mockReads({ latestVerification: new Date('2026-10-15T22:13:32Z') });

    await refreshSeedFidelityIfStale(SEED_ID);

    const writes = fidelityWrites();
    expect(writes).toHaveLength(1);
    // napVerified short-circuits the NAP comparison, so the sparse listing
    // (product_count 0) lands on 'thin' — which clears the misaligned gate on
    // every claim surface.
    expect(writes[0][1]).toBe('thin');
    expect(writes[0][2]).toBe('maud-old');
  });

  it('does not recompute when the verdict already postdates the verification', async () => {
    mockReads({
      checkedAt: new Date('2026-10-16T00:00:00Z'),
      latestVerification: new Date('2026-10-15T22:13:32Z'),
    });

    await refreshSeedFidelityIfStale(SEED_ID);

    expect(fidelityWrites()).toHaveLength(0);
  });

  it('still recomputes when the source audit changed', async () => {
    mockReads({
      storedAuditId: 'maud-old',
      checkedAt: new Date('2026-10-16T00:00:00Z'),
      latestVerification: null,
      audits: [audit('maud-new')],
    });

    await refreshSeedFidelityIfStale(SEED_ID);

    const writes = fidelityWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0][2]).toBe('maud-new');
  });

  it('recomputes when the stored audit id no longer resolves to a live campaign', async () => {
    mockReads({
      storedAuditId: 'maud-deleted',
      checkedAt: new Date('2026-10-16T00:00:00Z'),
      primaryCampaignId: null,
    });

    await refreshSeedFidelityIfStale(SEED_ID);

    expect(fidelityWrites()).toHaveLength(1);
  });

  it('is a no-op when the seed no longer exists', async () => {
    mockReads({ listing: null });

    await refreshSeedFidelityIfStale(SEED_ID);

    expect(fidelityWrites()).toHaveLength(0);
  });
});
