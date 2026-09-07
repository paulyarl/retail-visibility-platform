/**
 * DirectoryClaimService — NAP-stamp on claim acceptance (W9)
 *
 * Verifies the seed-funnel analytics spec §7 gap 2:
 * - acceptClaim stamps nap_verified_at = now() on the seed
 * - approveClaimRequest stamps nap_verified_at = now() on the seed
 * - The UPDATE on directory_presence_seeds includes status='claimed',
 *   claimed_at=now(), and nap_verified_at=now()
 *
 * See: docs/LocalBiz/seed_funnel_benchmark_gates_and_analytics_spec.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockExecuteRaw, mockAudit, mockLogger } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockAudit: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    // populateTenantProfileFromListing uses $queryRaw (covered above)
    // promoteListingToClaimed uses $executeRaw (covered above)
    // closeClaimTicket uses prisma.crm_support_tickets.update
    crm_support_tickets: { update: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock('../../logger', () => ({ logger: mockLogger }));

vi.mock('../../audit', () => ({ audit: mockAudit }));

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn().mockResolvedValue(true) },
}));

vi.mock('../auth/auth.service', () => ({
  authService: {
    generateTokens: vi.fn().mockReturnValue({ accessToken: 'a', refreshToken: 'r' }),
    hashPassword: vi.fn().mockResolvedValue('hash'),
  },
}));

vi.mock('./CrmTicketService', () => ({
  default: { getInstance: () => ({}) },
}));

vi.mock('./CrmTicketMessageService', () => ({
  default: { getInstance: () => ({}) },
}));

vi.mock('./DirectoryPresenceUpgradeOptionsService', () => ({
  buildTenantUpgradeOptions: vi.fn().mockResolvedValue(null),
}));

vi.mock('@prisma/client', () => ({
  user_role: { OWNER: 'OWNER' },
}));

import DirectoryClaimService from '../DirectoryClaimService';

// Prisma tagged-template literals (prisma.$executeRaw`...`) call the mock with
// the cooked string fragments as an array in arg[0] and the interpolated values
// as the remaining args. This helper joins the fragments for substring asserts.
function sqlOf(call: any[]): string {
  const first = call[0];
  if (typeof first === 'string') return first;
  if (Array.isArray(first)) return first.join('');
  return '';
}

/** Find the UPDATE directory_presence_seeds call among $executeRaw calls. */
function findSeedUpdateCall(): any[] | undefined {
  return mockExecuteRaw.mock.calls.find(
    (c: any[]) =>
      sqlOf(c).includes('UPDATE directory_presence_seeds') &&
      sqlOf(c).includes('nap_verified_at'),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: all queryRaw calls return empty array (safe for lookups)
  mockQueryRaw.mockResolvedValue([]);
  mockExecuteRaw.mockResolvedValue(1);
});

describe('acceptClaim — NAP-stamp on claim acceptance (spec §7 gap 2)', () => {
  it('stamps nap_verified_at = now() when a valid token claim succeeds (no OTP required)', async () => {
    // First $queryRaw: token lookup query
    mockQueryRaw.mockResolvedValueOnce([
      {
        token_id: 'tok-1',
        seed_id: 'seed-1',
        tenant_id: 'tnt-1',
        expires_at: new Date(Date.now() + 86400000), // tomorrow
        consumed_at: null,
        single_use: true,
        verification_required: false,
        operator_approval_required: false,
        bound_email: null,
        bound_phone: null,
        seed_status: 'published',
      },
    ]);
    // populateTenantProfileFromListing: listing lookup → return empty (skip)
    mockQueryRaw.mockResolvedValueOnce([]);
    // promoteListingToClaimed uses $executeRaw (mocked above)
    // buildTenantUpgradeOptions is mocked to return null

    const result = await DirectoryClaimService.acceptClaim('valid-token', 'user-1', false);

    expect(result.success).toBe(true);
    expect(result.seedId).toBe('seed-1');
    expect(result.tenantId).toBe('tnt-1');

    // The critical assertion: the UPDATE on directory_presence_seeds includes
    // nap_verified_at = now()
    const seedUpdate = findSeedUpdateCall();
    expect(seedUpdate).toBeDefined();
    const sql = sqlOf(seedUpdate);
    expect(sql).toContain('status = \'claimed\'');
    expect(sql).toContain('claimed_at = now()');
    expect(sql).toContain('nap_verified_at = now()');
  });

  it('does not stamp nap_verified_at when the token is invalid', async () => {
    mockQueryRaw.mockResolvedValueOnce([]); // no token row

    const result = await DirectoryClaimService.acceptClaim('bad-token', 'user-1', false);

    expect(result.success).toBe(false);
    expect(result.message).toBe('invalid_token');

    // No seed UPDATE should have been issued
    const seedUpdate = findSeedUpdateCall();
    expect(seedUpdate).toBeUndefined();
  });

  it('does not stamp nap_verified_at when the token is expired', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        token_id: 'tok-1',
        seed_id: 'seed-1',
        tenant_id: 'tnt-1',
        expires_at: new Date(Date.now() - 86400000), // yesterday
        consumed_at: null,
        single_use: true,
        verification_required: false,
        operator_approval_required: false,
        bound_email: null,
        bound_phone: null,
        seed_status: 'published',
      },
    ]);

    const result = await DirectoryClaimService.acceptClaim('expired-token', 'user-1', false);

    expect(result.success).toBe(false);
    expect(result.message).toBe('token_expired');

    const seedUpdate = findSeedUpdateCall();
    expect(seedUpdate).toBeUndefined();
  });

  it('does not stamp nap_verified_at when the seed is already claimed', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        token_id: 'tok-1',
        seed_id: 'seed-1',
        tenant_id: 'tnt-1',
        expires_at: new Date(Date.now() + 86400000),
        consumed_at: null,
        single_use: true,
        verification_required: false,
        operator_approval_required: false,
        bound_email: null,
        bound_phone: null,
        seed_status: 'claimed',
      },
    ]);

    const result = await DirectoryClaimService.acceptClaim('used-token', 'user-1', false);

    expect(result.success).toBe(false);
    expect(result.message).toBe('already_claimed');

    const seedUpdate = findSeedUpdateCall();
    expect(seedUpdate).toBeUndefined();
  });
});

describe('approveClaimRequest — NAP-stamp on operator approval (spec §7 gap 2)', () => {
  it('stamps nap_verified_at = now() when an operator approves a pending claim request', async () => {
    // First $queryRaw: claim request lookup
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: 'req-1',
        seed_id: 'seed-2',
        tenant_id: 'tnt-2',
        token_id: 'tok-2',
        customer_id: null,
        status: 'pending',
        expires_at: new Date(Date.now() + 86400000),
        consumed_at: null,
        single_use: true,
        seed_status: 'published',
      },
    ]);
    // populateTenantProfileFromListing: listing lookup → return empty (skip)
    mockQueryRaw.mockResolvedValueOnce([]);

    const result = await DirectoryClaimService.approveClaimRequest('req-1', 'admin-1');

    expect(result.success).toBe(true);
    expect(result.seedId).toBe('seed-2');
    expect(result.tenantId).toBe('tnt-2');

    // The critical assertion: the UPDATE on directory_presence_seeds includes
    // nap_verified_at = now()
    const seedUpdate = findSeedUpdateCall();
    expect(seedUpdate).toBeDefined();
    const sql = sqlOf(seedUpdate);
    expect(sql).toContain('status = \'claimed\'');
    expect(sql).toContain('claimed_at = now()');
    expect(sql).toContain('nap_verified_at = now()');
  });

  it('does not stamp nap_verified_at when the claim request is not found', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);

    const result = await DirectoryClaimService.approveClaimRequest('no-such-req', 'admin-1');

    expect(result.success).toBe(false);
    expect(result.message).toBe('request_not_found');

    const seedUpdate = findSeedUpdateCall();
    expect(seedUpdate).toBeUndefined();
  });

  it('does not stamp nap_verified_at when the claim request was already reviewed', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: 'req-1',
        seed_id: 'seed-2',
        tenant_id: 'tnt-2',
        token_id: 'tok-2',
        customer_id: null,
        status: 'approved', // already reviewed
        expires_at: new Date(Date.now() + 86400000),
        consumed_at: null,
        single_use: true,
        seed_status: 'published',
      },
    ]);

    const result = await DirectoryClaimService.approveClaimRequest('req-1', 'admin-1');

    expect(result.success).toBe(false);
    expect(result.message).toBe('request_already_reviewed');

    const seedUpdate = findSeedUpdateCall();
    expect(seedUpdate).toBeUndefined();
  });
});
