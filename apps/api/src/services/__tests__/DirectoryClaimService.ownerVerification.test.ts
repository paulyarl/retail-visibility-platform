/**
 * DirectoryClaimService — owner claim-time verification (migration 274)
 *
 * The claim page's verify step is a required contract of consent:
 * - initiateClaim refuses with verification_required until the owner
 *   confirms categories + attributes (seed has no owner_verified_at)
 * - confirmed categories mint to the listing via updateFields with
 *   provenance source_name='owner_claim'
 * - owner-typed labels NOT in the vocab (platform_categories ∪
 *   mkt_service_categories_list) are diverted to
 *   owner_proposed_categories — never written to the listing (abuse gate)
 * - owner is authoritative on attributes: confirmed sourced chips keep
 *   their evidence + gain ownerConfirmed; owner-added chips mint with
 *   sourcePlatform 'owner_confirmed'; omitted sourced chips are dropped
 * - once minted (owner_verified_at set), resends pass without a payload
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockExecuteRaw, mockAudit, mockLogger, mockUpdateFields, mockTicketCreate, mockTicketMessageCreate } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockAudit: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  mockUpdateFields: vi.fn().mockResolvedValue(undefined),
  mockTicketCreate: vi.fn().mockResolvedValue({ id: 'tkt-1' }),
  mockTicketMessageCreate: vi.fn().mockResolvedValue({}),
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
// resolves to the real module id and actually intercepts the service's
// imports inside DirectoryClaimService.
vi.mock('../CrmTicketService', () => ({
  default: { getInstance: () => ({ create: mockTicketCreate }) },
}));
vi.mock('../CrmTicketMessageService', () => ({
  default: { getInstance: () => ({ create: mockTicketMessageCreate }) },
}));
vi.mock('./DirectoryPresenceUpgradeOptionsService', () => ({
  buildTenantUpgradeOptions: vi.fn().mockResolvedValue(null),
}));
// NOTE: vi.mock paths resolve relative to THIS file — '../DirectoryPresenceSeedService'
// so the specifier resolves to the real module id and actually intercepts the
// service's dynamic import inside applyOwnerVerification.
vi.mock('../DirectoryPresenceSeedService', () => ({
  default: { updateFields: mockUpdateFields },
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
    operator_approval_required: false,
    bound_email: null,
    bound_phone: null,
    seed_status: 'published',
    owner_verified_at: null,
    ...overrides,
  };
}

/** Seed the $queryRaw sequence applyOwnerVerification issues after the
 *  token lookup: listing row, seed proposals row, known-category union. */
function mockVerificationLookups(opts: {
  attributes?: any[];
  primaryCategory?: string;
  secondaryCategories?: string[];
  proposals?: any[];
  knownLabels?: string[];
}) {
  mockQueryRaw.mockResolvedValueOnce([
    {
      primary_category: opts.primaryCategory ?? 'Bakery',
      secondary_categories: opts.secondaryCategories ?? ['Cafe'],
      attributes: opts.attributes ?? [],
    },
  ]);
  mockQueryRaw.mockResolvedValueOnce([
    { owner_proposed_categories: opts.proposals ?? [] },
  ]);
  mockQueryRaw.mockResolvedValueOnce(
    (opts.knownLabels ?? ['bakery', 'cafe', 'coffee shop']).map((label) => ({ label })),
  );
}

function findSeedOwnerUpdate(): any[] | undefined {
  return mockExecuteRaw.mock.calls.find(
    (c: any[]) =>
      sqlOf(c).includes('UPDATE directory_presence_seeds') &&
      sqlOf(c).includes('owner_verified_at'),
  );
}

function findCrmAlertInsert(): any[] | undefined {
  return mockExecuteRaw.mock.calls.find(
    (c: any[]) => sqlOf(c).includes('INSERT INTO crm_alerts'),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryRaw.mockResolvedValue([]);
  mockExecuteRaw.mockResolvedValue(1);
});

describe('initiateClaim — owner verification consent gate (migration 274)', () => {
  it('requires verification when the seed has not been owner-verified', async () => {
    mockQueryRaw.mockResolvedValueOnce([tokenRow()]);

    const result = await DirectoryClaimService.initiateClaim('valid-token', {
      actorType: 'customer',
      actorId: 'cust-1',
    });

    expect(result.error).toBe('verification_required');
    expect(result.ownerVerificationRequired).toBe(true);
    expect(mockUpdateFields).not.toHaveBeenCalled();
  });

  it('rejects an unconfirmed verification payload', async () => {
    mockQueryRaw.mockResolvedValueOnce([tokenRow()]);

    const result = await DirectoryClaimService.initiateClaim(
      'valid-token',
      { actorType: 'customer', actorId: 'cust-1' },
      {
        primaryCategory: 'Bakery',
        secondaryCategories: [],
        attributes: [],
        confirmed: false as any,
      },
    );

    expect(result.error).toBe('verification_not_confirmed');
    expect(mockUpdateFields).not.toHaveBeenCalled();
  });

  it('mints confirmed categories + attributes and stamps the consent record', async () => {
    mockQueryRaw.mockResolvedValueOnce([tokenRow()]);
    mockVerificationLookups({
      attributes: [
        { key: 'accepts_cards', label: 'Accepts cards', sourcePlatform: 'google', sourceUrl: 'https://maps.example/x', asOf: '2026-09-01' },
        { key: 'free_wifi', label: 'Free Wi-Fi', sourcePlatform: 'yelp' },
      ],
    });

    const result = await DirectoryClaimService.initiateClaim(
      'valid-token',
      { actorType: 'customer', actorId: 'cust-1' },
      {
        primaryCategory: 'Bakery',
        secondaryCategories: ['Cafe', 'Coffee Shop'],
        attributes: [
          { key: 'accepts_cards', label: 'Accepts cards' },
          { label: 'Pet friendly' },
        ],
        confirmed: true,
      },
    );

    expect(result.verificationRequired).toBe(false);
    expect(result.error).toBeUndefined();
    expect(result.proposedCategories ?? []).toEqual([]);

    // Listing mint via updateFields — confirmed sourced attr keeps evidence +
    // ownerConfirmed, owner-added attr mints as owner_confirmed, omitted
    // sourced attr (free_wifi) is dropped.
    expect(mockUpdateFields).toHaveBeenCalledTimes(1);
    const [seedId, fields, provenance] = mockUpdateFields.mock.calls[0];
    expect(seedId).toBe('seed-1');
    expect(fields.primaryCategory).toBe('Bakery');
    expect(fields.secondaryCategories).toEqual(['Cafe', 'Coffee Shop']);
    const attrByKey = new Map(fields.attributes.map((a: any) => [a.key, a]));
    expect(attrByKey.get('accepts_cards')).toMatchObject({
      sourcePlatform: 'google',
      sourceUrl: 'https://maps.example/x',
      ownerConfirmed: true,
    });
    expect(attrByKey.get('pet_friendly')).toMatchObject({
      label: 'Pet friendly',
      sourcePlatform: 'owner_confirmed',
      ownerConfirmed: true,
    });
    expect(attrByKey.has('free_wifi')).toBe(false);

    // Provenance — owner_claim on all three fields
    const byKey = new Map(provenance.map((p: any) => [p.fieldKey, p]));
    expect(byKey.get('primary_category')).toMatchObject({ sourceName: 'owner_claim', confidence: 'high', showOnPublic: true });
    expect(byKey.get('secondary_categories')?.value).toContain('Coffee Shop');
    expect(byKey.get('attributes')).toMatchObject({ sourceName: 'owner_claim', value: 'owner_confirmed' });

    // Seed consent stamp — owner_verified_at + verification snapshot +
    // category_fit='verified'; rejected attribute recorded.
    const seedUpdate = findSeedOwnerUpdate();
    expect(seedUpdate).toBeDefined();
    const sql = sqlOf(seedUpdate!);
    expect(sql).toContain('owner_verified_at = now()');
    expect(sql).toContain('owner_verification');
    expect(sql).toContain("category_fit = 'verified'");
    const recordJson = seedUpdate!.find((a: any) => typeof a === 'string' && a.includes('"rejected"'));
    expect(recordJson).toContain('"rejected":["free_wifi"]');
    expect(recordJson).toContain('"confirmed":["accepts_cards"]');
    expect(recordJson).toContain('"added":["pet_friendly"]');

    // No unknown labels → no proposals, no CRM alert, no Requests-Hub ticket
    expect(findCrmAlertInsert()).toBeUndefined();
    expect(mockTicketCreate).not.toHaveBeenCalled();

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'directory_claim.owner_verification' }),
    );
  });

  it('diverts owner-typed unknown categories to pending proposals (abuse gate)', async () => {
    mockQueryRaw.mockResolvedValueOnce([tokenRow()]);
    mockVerificationLookups({});

    const result = await DirectoryClaimService.initiateClaim(
      'valid-token',
      { actorType: 'customer', actorId: 'cust-1' },
      {
        primaryCategory: 'Wizard Academy',
        secondaryCategories: ['Cafe', 'Dragon Petting Zoo'],
        attributes: [],
        confirmed: true,
      },
    );

    expect(result.verificationRequired).toBe(false);
    expect(result.proposedCategories).toEqual(
      expect.arrayContaining(['Wizard Academy', 'Dragon Petting Zoo']),
    );

    // Unknown labels never reach the listing — primary stays 'Bakery',
    // secondary keeps only the known 'Cafe'.
    const [, fields] = mockUpdateFields.mock.calls[0];
    expect(fields.primaryCategory).toBe('Bakery');
    expect(fields.secondaryCategories).toEqual(['Cafe']);

    // Both proposals persisted as pending on the seed — target the
    // owner_proposed_categories arg (proposed_at entries), not the
    // owner_verification consent snapshot which also names the labels.
    const seedUpdate = findSeedOwnerUpdate();
    const proposalsJson = seedUpdate!.find(
      (a: any) =>
        typeof a === 'string' &&
        a.includes('Wizard Academy') &&
        a.includes('"status":"pending"'),
    );
    expect(proposalsJson).toBeDefined();
    expect(proposalsJson).toContain('"role":"primary"');
    expect(proposalsJson).toContain('"role":"secondary"');

    // Pending proposals raise a platform CRM alert for operator review.
    // 'directory_category_proposal' is a literal in the SQL text, not an
    // interpolated arg — assert on the joined fragments.
    const alert = findCrmAlertInsert();
    expect(alert).toBeDefined();
    expect(sqlOf(alert!)).toContain('directory_category_proposal');

    // And file a Requests-Hub work item — the operator inbox pattern
    // (platform-scope crm_support_tickets, category 'directory_claim').
    expect(mockTicketCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'platform',
        category: 'directory_claim',
        priority: 'medium',
        inquiry_id: 'seed-1',
        title: expect.stringContaining('Owner-proposed categories'),
      }),
    );
    expect(mockTicketMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ ticket_id: 'tkt-1' }),
    );
  });

  it('skips the gate once owner_verified_at is set (OTP resend / repeat initiate)', async () => {
    mockQueryRaw.mockResolvedValueOnce([tokenRow({ owner_verified_at: new Date() })]);

    const result = await DirectoryClaimService.initiateClaim('valid-token', {
      actorType: 'customer',
      actorId: 'cust-1',
    });

    expect(result.error).toBeUndefined();
    expect(result.verificationRequired).toBe(false);
    expect(mockUpdateFields).not.toHaveBeenCalled();
  });
});
