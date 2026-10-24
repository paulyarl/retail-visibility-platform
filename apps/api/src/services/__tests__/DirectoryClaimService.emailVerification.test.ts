/**
 * DirectoryClaimService — claimant email verification (migration 358)
 *
 * Operator-approval claims (tokens minted without bound owner contact)
 * must prove inbox access before the pending request reaches the
 * operator queue:
 * - unproven claimants (password customers, self-asserted identity,
 *   anonymous) get a verification link emailed — no request row until
 *   verifyClaimRequestEmail runs
 * - proven claimants (platform users, email_verified customers) file
 *   the pending request immediately — the pre-358 behavior
 * - repeat initiates resend the live verification instead of minting new
 * - verifyClaimRequestEmail marks the verification and files the request
 *   (find-or-create) with the operator notifications
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockQueryRaw,
  mockExecuteRaw,
  mockAudit,
  mockLogger,
  mockTicketCreate,
  mockTicketMessageCreate,
  mockSendEmail,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockAudit: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  mockTicketCreate: vi.fn().mockResolvedValue({ id: 'tkt-1' }),
  mockTicketMessageCreate: vi.fn().mockResolvedValue({}),
  mockSendEmail: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
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

// NOTE: vi.mock paths resolve relative to THIS file — '../X' so the specifier
// resolves to the real module id and actually intercepts the service's imports.
vi.mock('../CrmTicketService', () => ({
  default: { getInstance: () => ({ create: mockTicketCreate }) },
}));
vi.mock('../CrmTicketMessageService', () => ({
  default: { getInstance: () => ({ create: mockTicketMessageCreate }) },
}));
vi.mock('./DirectoryPresenceUpgradeOptionsService', () => ({
  buildTenantUpgradeOptions: vi.fn().mockResolvedValue(null),
}));
vi.mock('../email-service', () => ({
  emailService: { sendEmail: mockSendEmail },
}));
vi.mock('../email-service.js', () => ({
  emailService: { sendEmail: mockSendEmail },
}));
vi.mock('@prisma/client', () => ({ user_role: { OWNER: 'OWNER' } }));

import DirectoryClaimService from '../DirectoryClaimService';

/** Join prisma tagged-template args into a searchable SQL string. */
function sqlOf(call: any[]): string {
  const first = call[0];
  if (typeof first === 'string') return first;
  if (Array.isArray(first)) return first.join('');
  return '';
}

/** Token row for the operator-approval path (no bound owner contact).
 *  owner_verified_at is set so the migration-274 consent gate is already
 *  satisfied and the flow reaches the approval branch. */
function tokenRow(overrides: Record<string, any> = {}) {
  return {
    token_id: 'tok-1',
    seed_id: 'seed-1',
    tenant_id: 'tnt-1',
    listing_id: 'lst-1',
    expires_at: new Date(Date.now() + 86400000),
    consumed_at: null,
    single_use: true,
    verification_required: false,
    operator_approval_required: true,
    bound_email: null,
    bound_phone: null,
    seed_status: 'invited',
    owner_verified_at: new Date(),
    ...overrides,
  };
}

function verificationRow(overrides: Record<string, any> = {}) {
  return {
    id: 'dcrv-1',
    token_id: 'tok-1',
    seed_id: 'seed-1',
    tenant_id: 'tnt-1',
    claimant_email: 'owner@example.com',
    payload: { customerId: 'cust-1', claimantFirstName: 'Ada', claimantLastName: 'Osei' },
    verified: false,
    expires_at: new Date(Date.now() + 86400000),
    claim_token: 'claim-token-1',
    consumed_at: null,
    single_use: true,
    claim_expires_at: new Date(Date.now() + 86400000),
    seed_status: 'invited',
    business_name: 'Bakery',
    ...overrides,
  };
}

function findVerificationInsert(): any[] | undefined {
  return mockExecuteRaw.mock.calls.find(
    (c: any[]) => sqlOf(c).includes('INSERT INTO directory_claim_request_verifications'),
  );
}

function findRequestInsert(): any[] | undefined {
  return mockExecuteRaw.mock.calls.find(
    (c: any[]) => sqlOf(c).includes('INSERT INTO directory_claim_requests'),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryRaw.mockResolvedValue([]);
  mockExecuteRaw.mockResolvedValue(1);
});

describe('initiateClaim — claimant email verification gate (migration 358)', () => {
  it('holds the request and emails a verification link for an unproven claimant', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([tokenRow()]) // token lookup
      .mockResolvedValueOnce([]) // no live verification for token+email
      .mockResolvedValueOnce([{ business_name: 'Bakery' }]); // business name for the email

    const result = await DirectoryClaimService.initiateClaim('claim-token-1', {
      actorType: 'customer',
      actorId: 'cust-1',
      customerEmail: 'owner@example.com',
      claimantEmailVerified: false,
    });

    expect(result.operatorApprovalRequired).toBe(true);
    expect(result.claimantVerificationRequired).toBe(true);
    expect(result.sentTo).toBe('o***@example.com');
    expect(result.requestId).toBeUndefined();

    // Verification row minted — pending request is NOT.
    expect(findVerificationInsert()).toBeDefined();
    expect(findRequestInsert()).toBeUndefined();

    // The link went to the claimant's email.
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@example.com' }),
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'directory_claim.request_email_verification' }),
    );
  });

  it('files the pending request immediately for a proven claimant', async () => {
    mockQueryRaw.mockResolvedValueOnce([tokenRow()]);
    // Remaining lookups (existing request, business name) return [] by default.

    const result = await DirectoryClaimService.initiateClaim('claim-token-1', {
      actorType: 'customer',
      actorId: 'cust-1',
      customerEmail: 'owner@example.com',
      claimantEmailVerified: true,
    });

    expect(result.operatorApprovalRequired).toBe(true);
    expect(result.claimantVerificationRequired).toBeUndefined();
    expect(result.requestId).toBeDefined();

    expect(findRequestInsert()).toBeDefined();
    expect(findVerificationInsert()).toBeUndefined();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'directory_claim.submit_approval_request' }),
    );
  });

  it('requires an email when the claimant is unproven and none is available', async () => {
    mockQueryRaw.mockResolvedValueOnce([tokenRow()]);

    const result = await DirectoryClaimService.initiateClaim('claim-token-1', {
      actorType: 'customer',
      actorId: 'cust-1',
      claimantEmailVerified: false,
    });

    expect(result.error).toBe('claimant_email_required');
    expect(findVerificationInsert()).toBeUndefined();
    expect(findRequestInsert()).toBeUndefined();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('resends the live verification instead of minting a new one', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([tokenRow()])
      .mockResolvedValueOnce([{ id: 'dcrv-1', token: 'existing-verify-token' }])
      .mockResolvedValueOnce([{ business_name: 'Bakery' }]);

    const result = await DirectoryClaimService.initiateClaim('claim-token-1', {
      actorType: 'customer',
      actorId: 'cust-1',
      customerEmail: 'owner@example.com',
      claimantEmailVerified: false,
    });

    expect(result.claimantVerificationRequired).toBe(true);
    expect(findVerificationInsert()).toBeUndefined();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@example.com' }),
    );
  });
});

describe('verifyClaimRequestEmail (migration 358)', () => {
  it('marks the verification and files the pending request', async () => {
    mockQueryRaw.mockResolvedValueOnce([verificationRow()]);

    const result = await DirectoryClaimService.verifyClaimRequestEmail('verify-token', {
      ip: '127.0.0.1',
    });

    expect(result.success).toBe(true);
    expect(result.requestId).toBeDefined();
    expect(result.claimToken).toBe('claim-token-1');
    expect(result.businessName).toBe('Bakery');

    const verifyUpdate = mockExecuteRaw.mock.calls.find(
      (c: any[]) =>
        sqlOf(c).includes('UPDATE directory_claim_request_verifications') &&
        sqlOf(c).includes('verified = TRUE'),
    );
    expect(verifyUpdate).toBeDefined();
    expect(findRequestInsert()).toBeDefined();
    expect(mockTicketCreate).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'directory_claim', inquiry_id: result.requestId }),
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'directory_claim.verify_email' }),
    );
  });

  it('rejects an unknown verification token', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);

    const result = await DirectoryClaimService.verifyClaimRequestEmail('nope');

    expect(result.success).toBe(false);
    expect(result.error).toBe('token_not_found');
  });

  it('rejects an expired verification link', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      verificationRow({ expires_at: new Date(Date.now() - 1000) }),
    ]);

    const result = await DirectoryClaimService.verifyClaimRequestEmail('verify-token');

    expect(result.success).toBe(false);
    expect(result.error).toBe('token_expired');
    expect(findRequestInsert()).toBeUndefined();
  });

  it('rejects an already-verified link and returns the claim token', async () => {
    mockQueryRaw.mockResolvedValueOnce([verificationRow({ verified: true })]);

    const result = await DirectoryClaimService.verifyClaimRequestEmail('verify-token');

    expect(result.success).toBe(false);
    expect(result.error).toBe('token_already_verified');
    expect(result.claimToken).toBe('claim-token-1');
  });
});
