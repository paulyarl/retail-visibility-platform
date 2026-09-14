import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Prisma mock (hoisted) ─────────────────────────────────────────────────

const {
  mockListing,
  mockSeed,
  mockCustomer,
  mockUserTenant,
  mockUnlockFindMany,
  mockUnlockUpsert,
  mockUser,
} = vi.hoisted(() => ({
  mockListing: vi.fn(),
  mockSeed: vi.fn(),
  mockCustomer: vi.fn(),
  mockUserTenant: vi.fn(),
  mockUnlockFindMany: vi.fn(),
  mockUnlockUpsert: vi.fn(),
  mockUser: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    directory_listings_list: { findFirst: mockListing },
    directory_presence_seeds: { findUnique: mockSeed },
    customers: { findUnique: mockCustomer },
    user_tenants: { findFirst: mockUserTenant },
    users: { findUnique: mockUser },
    market_intel_unlocks: {
      findMany: mockUnlockFindMany,
      upsert: mockUnlockUpsert,
    },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { MarketIntelAccessService, AccessTier } from '../MarketIntelAccessService';

describe('MarketIntelAccessService', () => {
  let service: MarketIntelAccessService;

  beforeEach(() => {
    service = MarketIntelAccessService.getInstance();
    mockListing.mockReset();
    mockSeed.mockReset();
    mockCustomer.mockReset();
    mockUserTenant.mockReset();
    mockUnlockFindMany.mockReset();
    mockUnlockUpsert.mockReset();
    mockUser.mockReset();
    // Default: no linked user → not a platform admin.
    mockUser.mockResolvedValue(null);
  });

  // ── getAccessTier ─────────────────────────────────────────────────────

  it('returns Anonymous (tier 0) when customerId is null', async () => {
    const tier = await service.getAccessTier(null, 'place', 'some-slug');
    expect(tier).toBe(AccessTier.Anonymous);
  });

  it('returns Owner (tier 3) when the customer owns the seed', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue({ tenant_id: 'tenant-1' });
    mockCustomer.mockResolvedValue({ linked_user_id: 'user-1' });
    mockUserTenant.mockResolvedValue({ id: 'ut-1' });

    const tier = await service.getAccessTier('cust-1', 'place', 'some-slug');
    expect(tier).toBe(AccessTier.Owner);
  });

  it('returns Paid (tier 2) when the tenant has an unlock row', async () => {
    // Not an owner.
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue({ tenant_id: 'tenant-1' });
    mockCustomer.mockResolvedValue({ linked_user_id: 'user-1' });
    mockUserTenant.mockResolvedValue(null); // no OWNER row for this seed's tenant
    // But has a tenant for purchase.
    mockUserTenant
      .mockResolvedValueOnce(null) // isOwner check
      .mockResolvedValueOnce({ tenant_id: 'tenant-2' }); // resolveTenantForPurchase
    mockUnlockFindMany.mockResolvedValue([{ unlock_type: 'single_report', expires_at: null }]);

    const tier = await service.getAccessTier('cust-1', 'place', 'some-slug');
    expect(tier).toBe(AccessTier.Paid);
  });

  it('returns Free (tier 1) when logged in but no unlock and not owner', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue({ tenant_id: 'tenant-1' });
    mockCustomer.mockResolvedValue({ linked_user_id: 'user-1' });
    mockUserTenant
      .mockResolvedValueOnce(null) // isOwner
      .mockResolvedValueOnce({ tenant_id: 'tenant-2' }); // resolveTenantForPurchase
    mockUnlockFindMany.mockResolvedValue([]);

    const tier = await service.getAccessTier('cust-1', 'place', 'some-slug');
    expect(tier).toBe(AccessTier.Free);
  });

  it('returns Free (tier 1) when no tenant for purchase', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue({ tenant_id: 'tenant-1' });
    mockCustomer.mockResolvedValue({ linked_user_id: 'user-1' });
    mockUserTenant.mockResolvedValue(null); // no owner row anywhere

    const tier = await service.getAccessTier('cust-1', 'place', 'some-slug');
    expect(tier).toBe(AccessTier.Free);
  });

  it('returns Owner (tier 3) when the customer is a PLATFORM_ADMIN', async () => {
    // Admin has a linked user with role PLATFORM_ADMIN.
    mockCustomer.mockResolvedValue({ linked_user_id: 'user-admin' });
    mockUser.mockResolvedValue({ role: 'PLATFORM_ADMIN' });

    const tier = await service.getAccessTier('cust-admin', 'place', 'some-slug');
    expect(tier).toBe(AccessTier.Owner);
  });

  it('returns Owner (tier 3) for PLATFORM_ADMIN on category surfaces too', async () => {
    mockCustomer.mockResolvedValue({ linked_user_id: 'user-admin' });
    mockUser.mockResolvedValue({ role: 'PLATFORM_ADMIN' });

    const tier = await service.getAccessTier('cust-admin', 'category', 'indian-grocery');
    expect(tier).toBe(AccessTier.Owner);
  });

  it('does not grant admin access when linked user role is USER', async () => {
    mockCustomer.mockResolvedValue({ linked_user_id: 'user-1' });
    mockUser.mockResolvedValue({ role: 'USER' });
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue({ tenant_id: 'tenant-1' });
    mockUserTenant.mockResolvedValue(null);

    const tier = await service.getAccessTier('cust-1', 'place', 'some-slug');
    expect(tier).toBe(AccessTier.Free);
  });

  // ── canAccessFull ──────────────────────────────────────────────────────

  it('canAccessFull returns true for Paid and Owner tiers', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue({ tenant_id: 'tenant-1' });
    mockCustomer.mockResolvedValue({ linked_user_id: 'user-1' });
    mockUserTenant.mockResolvedValue({ id: 'ut-1' });

    const canAccess = await service.canAccessFull('cust-1', 'place', 'some-slug');
    expect(canAccess).toBe(true);
  });

  it('canAccessFull returns false for Anonymous and Free tiers', async () => {
    const canAccess = await service.canAccessFull(null, 'place', 'some-slug');
    expect(canAccess).toBe(false);
  });

  // ── isOwner ───────────────────────────────────────────────────────────

  it('isOwner returns false when listing not found', async () => {
    mockListing.mockResolvedValue(null);
    const result = await service.isOwner('cust-1', 'no-such-slug');
    expect(result).toBe(false);
  });

  it('isOwner returns false when seed not found', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue(null);
    const result = await service.isOwner('cust-1', 'some-slug');
    expect(result).toBe(false);
  });

  it('isOwner returns false when customer has no linked_user_id', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue({ tenant_id: 'tenant-1' });
    mockCustomer.mockResolvedValue({ linked_user_id: null });
    const result = await service.isOwner('cust-1', 'some-slug');
    expect(result).toBe(false);
  });

  it('isOwner returns false when no OWNER user_tenants row for the seed tenant', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue({ tenant_id: 'tenant-1' });
    mockCustomer.mockResolvedValue({ linked_user_id: 'user-1' });
    mockUserTenant.mockResolvedValue(null);
    const result = await service.isOwner('cust-1', 'some-slug');
    expect(result).toBe(false);
  });

  it('isOwner returns true when customer owns the seed tenant', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue({ tenant_id: 'tenant-1' });
    mockCustomer.mockResolvedValue({ linked_user_id: 'user-1' });
    mockUserTenant.mockResolvedValue({ id: 'ut-1' });
    const result = await service.isOwner('cust-1', 'some-slug');
    expect(result).toBe(true);
  });

  // ── resolveTenantForPurchase ─────────────────────────────────────────

  it('resolveTenantForPurchase returns null when customer has no linked_user_id', async () => {
    mockCustomer.mockResolvedValue({ linked_user_id: null });
    const result = await service.resolveTenantForPurchase('cust-1');
    expect(result).toBeNull();
  });

  it('resolveTenantForPurchase returns the first owned tenant_id', async () => {
    mockCustomer.mockResolvedValue({ linked_user_id: 'user-1' });
    mockUserTenant.mockResolvedValue({ tenant_id: 'tenant-1' });
    const result = await service.resolveTenantForPurchase('cust-1');
    expect(result).toBe('tenant-1');
  });

  // ── recordUnlock ──────────────────────────────────────────────────────

  it('recordUnlock calls upsert with the correct unique key', async () => {
    mockUnlockUpsert.mockResolvedValue({});

    await service.recordUnlock({
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      surfaceType: 'place',
      surfaceKey: 'some-slug',
      unlockType: 'single_report',
      paymentIntentId: 'pi_123',
    });

    expect(mockUnlockUpsert).toHaveBeenCalledWith({
      where: {
        tenant_id_surface_type_surface_key_unlock_type: {
          tenant_id: 'tenant-1',
          surface_type: 'place',
          surface_key: 'some-slug',
          unlock_type: 'single_report',
        },
      },
      update: expect.objectContaining({
        customer_id: 'cust-1',
        payment_intent_id: 'pi_123',
      }),
      create: expect.objectContaining({
        tenant_id: 'tenant-1',
        customer_id: 'cust-1',
        surface_type: 'place',
        surface_key: 'some-slug',
        unlock_type: 'single_report',
        payment_intent_id: 'pi_123',
      }),
    });
  });

  // ── hasUnlock ─────────────────────────────────────────────────────────

  it('hasUnlock returns true for a permanent unlock (no expires_at)', async () => {
    mockUnlockFindMany.mockResolvedValue([{ unlock_type: 'single_report', expires_at: null }]);
    const result = await service.hasUnlock('tenant-1', 'place', 'some-slug');
    expect(result).toBe(true);
  });

  it('hasUnlock returns false for an expired subscription unlock', async () => {
    mockUnlockFindMany.mockResolvedValue([{ unlock_type: 'subscription', expires_at: new Date('2020-01-01') }]);
    const result = await service.hasUnlock('tenant-1', 'place', 'some-slug');
    expect(result).toBe(false);
  });

  it('hasUnlock returns false when no unlock rows exist', async () => {
    mockUnlockFindMany.mockResolvedValue([]);
    const result = await service.hasUnlock('tenant-1', 'place', 'some-slug');
    expect(result).toBe(false);
  });
});
