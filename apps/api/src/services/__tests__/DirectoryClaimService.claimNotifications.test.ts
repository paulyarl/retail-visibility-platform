/**
 * DirectoryClaimService — post-claim notifications
 *
 * When a claim completes (either path), the service must:
 * - file a platform-scope CRM alert (crm_alerts, type 'directory_claim_completed')
 * - create a platform-scope CRM support ticket so the claim lands in the
 *   operator Requests Hub (/settings/admin/crm/requests)
 * - send the owner a welcome/congratulations email when a claimant email
 *   is resolvable (ctx → platform user → customer row → request row)
 * - skip the email (but still alert operators) when no email exists
 *
 * All notification steps are non-fatal — they must never roll back a claim.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockQueryRaw,
  mockExecuteRaw,
  mockAudit,
  mockLogger,
  mockTicketCreate,
  mockTicketMessageCreate,
  mockSendWelcome,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockAudit: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  mockTicketCreate: vi.fn().mockResolvedValue({ id: 'tkt-1' }),
  mockTicketMessageCreate: vi.fn().mockResolvedValue({}),
  mockSendWelcome: vi.fn().mockResolvedValue({ success: true }),
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
    generateAccessToken: vi.fn().mockReturnValue('a'),
    generateRefreshToken: vi.fn().mockReturnValue('r'),
    hashPassword: vi.fn().mockResolvedValue('hash'),
  },
}));

// NOTE: vi.mock paths resolve relative to THIS file — the specifier must
// match the real module id the service's dynamic imports resolve to.
vi.mock('../CrmTicketService', () => ({
  default: { getInstance: () => ({ create: mockTicketCreate }) },
}));
vi.mock('../CrmTicketMessageService', () => ({
  default: { getInstance: () => ({ create: mockTicketMessageCreate }) },
}));
vi.mock('../DirectoryPresenceUpgradeOptionsService', () => ({
  buildTenantUpgradeOptions: vi.fn().mockResolvedValue(null),
}));
vi.mock('../email/DirectoryClaimEmailService', () => ({
  getDirectoryClaimEmailService: () => ({ sendClaimWelcomeEmail: mockSendWelcome }),
}));
vi.mock('@prisma/client', () => ({
  user_role: { OWNER: 'OWNER', USER: 'USER' },
}));

import DirectoryClaimService from '../DirectoryClaimService';

/** Join prisma tagged-template args into a searchable SQL string. */
function sqlOf(call: any[]): string {
  const first = call[0];
  if (typeof first === 'string') return first;
  if (Array.isArray(first)) return first.join('');
  return '';
}

function findCompletedAlertInsert(): any[] | undefined {
  return mockExecuteRaw.mock.calls.find(
    (c: any[]) => sqlOf(c).includes('INSERT INTO crm_alerts') && sqlOf(c).includes('directory_claim_completed'),
  );
}

const LISTING_ROW = {
  business_name: 'Sahara Market',
  slug: 'sahara-market-indianapolis',
  category: 'African Grocery Store',
  city: 'Indianapolis',
  state: 'IN',
};

function tokenRow(overrides: Record<string, any> = {}) {
  return {
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
    seed_status: 'published',
    ...overrides,
  };
}

/**
 * Route $queryRaw calls by SQL text — positional mockResolvedValueOnce
 * sequencing is brittle here because post-claim side effects (report
 * refresh, intel unlock) also issue raw queries.
 */
function stubQueries(opts: {
  tokenRow?: any;
  requestRow?: any;
  userRow?: any;
  customerRow?: any;
}) {
  mockQueryRaw.mockImplementation((...args: any[]) => {
    const sql = sqlOf(args);
    if (sql.includes('FROM directory_claim_tokens')) return Promise.resolve(opts.tokenRow ? [opts.tokenRow] : []);
    if (sql.includes('FROM directory_claim_requests')) return Promise.resolve(opts.requestRow ? [opts.requestRow] : []);
    // Notification helper's listing lookup is the only seed→listing join
    // that selects dl.slug — return the display row for it.
    if (sql.includes('dl.slug') && sql.includes('FROM directory_presence_seeds')) return Promise.resolve([LISTING_ROW]);
    if (sql.includes('FROM users')) return Promise.resolve(opts.userRow ? [opts.userRow] : []);
    if (sql.includes('FROM customers')) return Promise.resolve(opts.customerRow ? [opts.customerRow] : []);
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(1);
});

describe('acceptClaim — post-claim notifications', () => {
  it('files the operator alert + Requests-Hub ticket and sends the welcome email', async () => {
    stubQueries({
      tokenRow: tokenRow(),
      userRow: { email: 'owner@example.com', first_name: 'Amina', last_name: 'Diallo' },
    });

    const result = await DirectoryClaimService.acceptClaim('valid-token', 'user-1', false);

    expect(result.success).toBe(true);

    // Platform-scope CRM alert
    const alert = findCompletedAlertInsert();
    expect(alert).toBeDefined();
    expect(sqlOf(alert!)).toContain('directory_claim_completed');

    // Requests-Hub ticket — platform scope, claim category, business in title
    expect(mockTicketCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'platform',
        category: 'directory_claim',
        title: expect.stringContaining('Sahara Market'),
        inquiry_id: 'seed-1',
      }),
    );
    expect(mockTicketMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ ticket_id: 'tkt-1' }),
    );

    // Welcome email to the resolved owner address
    expect(mockSendWelcome).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        businessName: 'Sahara Market',
        slug: 'sahara-market-indianapolis',
        tenantId: 'tnt-1',
      }),
    );
  });

  it('prefers the ctx claimant email over the user-row lookup', async () => {
    stubQueries({
      tokenRow: tokenRow(),
      userRow: { email: 'user@example.com', first_name: 'Amina', last_name: 'Diallo' },
    });

    const result = await DirectoryClaimService.acceptClaim('valid-token', 'user-1', false, {
      actorType: 'user',
      actorId: 'user-1',
      customerEmail: 'ctx-owner@example.com',
      customerName: 'Ctx Owner',
    } as any);

    expect(result.success).toBe(true);
    expect(mockSendWelcome).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ctx-owner@example.com', ownerName: 'Ctx Owner' }),
    );
  });

  it('still alerts operators but skips the email when no claimant email exists', async () => {
    stubQueries({ tokenRow: tokenRow() });

    const result = await DirectoryClaimService.acceptClaim('valid-token', 'user-1', false);

    expect(result.success).toBe(true);
    expect(findCompletedAlertInsert()).toBeDefined();
    expect(mockTicketCreate).toHaveBeenCalled();
    expect(mockSendWelcome).not.toHaveBeenCalled();
  });
});

describe('approveClaimRequest — post-claim notifications', () => {
  it('sends the welcome email to the request row email and links the ticket to the request', async () => {
    stubQueries({
      requestRow: {
        id: 'req-1',
        seed_id: 'seed-2',
        tenant_id: 'tnt-2',
        token_id: 'tok-2',
        customer_id: null,
        customer_email: 'claimant@example.com',
        customer_name: 'Claim Ant',
        status: 'pending',
        expires_at: new Date(Date.now() + 86400000),
        consumed_at: null,
        single_use: true,
        seed_status: 'published',
      },
    });

    const result = await DirectoryClaimService.approveClaimRequest('req-1', 'admin-1');

    expect(result.success).toBe(true);
    expect(findCompletedAlertInsert()).toBeDefined();
    expect(mockTicketCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'platform',
        category: 'directory_claim',
        inquiry_id: 'req-1',
      }),
    );
    expect(mockSendWelcome).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'claimant@example.com',
        ownerName: 'Claim Ant',
        businessName: 'Sahara Market',
        tenantId: 'tnt-2',
      }),
    );
  });
});
