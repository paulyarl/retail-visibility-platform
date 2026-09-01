import { describe, it, expect, vi, beforeEach } from 'vitest';

// ====================
// MOCKS
// ====================

const { mockTenants, mockDirectorySettings } = vi.hoisted(() => ({
  mockTenants: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  mockDirectorySettings: {
    findUnique: vi.fn(),
  },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    tenants: mockTenants,
    directory_settings_list: mockDirectorySettings,
  },
}));

vi.mock('../../config/tenant-limits', () => ({
  TRIAL_CONFIG: { durationDays: 14 },
}));

vi.mock('../../utils/location-status', () => ({
  getLocationStatusInfo: () => ({ label: 'open' }),
}));

// TrialManagementService dependencies (downgradeToExpired tests)
vi.mock('../../services/subscription/SubscriptionBillingService', () => ({
  getSubscriptionBillingService: vi.fn(),
}));
vi.mock('../../services/subscription/BillingNotificationService', () => ({
  getBillingNotificationService: () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined),
    createSubscriptionCrmTask: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock('../../services/EffectiveCapabilityResolver', () => ({
  invalidateEffectiveCapabilities: vi.fn(),
}));

import { tenantService } from '../tenant/TenantService';
import { TrialManagementService } from '../../services/subscription/TrialManagementService';

function baseTenant(overrides: Record<string, any> = {}) {
  return {
    id: 'tid-test-001',
    name: 'Test Tenant',
    subscription_tier: 'discovery',
    subscription_status: 'trial',
    trial_ends_at: null,
    subscription_ends_at: null,
    grace_ends_at: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    organization_id: null,
    location_status: 'active',
    is_demo: false,
    demo_expires_at: null,
    manual_subscription_control: false,
    manual_subscription_expires_at: null,
    manual_subscription_reason: null,
    slug: 'test-tenant',
    organizations_list: null,
    tenant_business_profiles_list: null,
    _count: { inventory_items: 0, user_tenants: 0 },
    ...overrides,
  };
}

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDirectorySettings.findUnique.mockResolvedValue({ is_published: false, slug: null });
});

describe('TenantService.getTenantById — gateway trial guard', () => {
  it('does NOT stamp a trial clock on a directory_presence tenant sitting at trial status', async () => {
    const tenant = baseTenant({
      subscription_tier: 'directory_presence',
      subscription_status: 'trial',
      trial_ends_at: null,
    });
    mockTenants.findUnique.mockResolvedValue(tenant);

    const result = await tenantService.getTenantById('tid-test-001');

    expect(mockTenants.update).not.toHaveBeenCalled();
    expect(result.subscription_tier).toBe('directory_presence');
    expect(result.subscription_status).toBe('trial');
    expect(result.trial_ends_at).toBeNull();
  });

  it('does NOT auto-expire a directory_presence tenant past a stale trial_ends_at', async () => {
    const tenant = baseTenant({
      subscription_tier: 'directory_presence',
      subscription_status: 'trial',
      trial_ends_at: daysAgo(30),
    });
    mockTenants.findUnique.mockResolvedValue(tenant);

    const result = await tenantService.getTenantById('tid-test-001');

    expect(mockTenants.update).not.toHaveBeenCalled();
    expect(result.subscription_tier).toBe('directory_presence');
  });

  it('reverts an expired paid-tier trial to directory_presence (not presence)', async () => {
    const tenant = baseTenant({
      subscription_tier: 'discovery',
      subscription_status: 'trial',
      trial_ends_at: daysAgo(1),
      stripe_subscription_id: null,
    });
    mockTenants.findUnique.mockResolvedValue(tenant);
    mockTenants.update.mockImplementation(async ({ data }) => ({ ...tenant, ...data }));

    await tenantService.getTenantById('tid-test-001');

    expect(mockTenants.update).toHaveBeenCalledTimes(1);
    expect(mockTenants.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscription_status: 'active',
          subscription_tier: 'directory_presence',
        }),
      })
    );
  });

  it('keeps the paid tier when an expired trial tenant has a Stripe subscription', async () => {
    const tenant = baseTenant({
      subscription_tier: 'discovery',
      subscription_status: 'trial',
      trial_ends_at: daysAgo(1),
      stripe_subscription_id: 'sub_test_001',
    });
    mockTenants.findUnique.mockResolvedValue(tenant);
    mockTenants.update.mockImplementation(async ({ data }) => ({ ...tenant, ...data }));

    await tenantService.getTenantById('tid-test-001');

    expect(mockTenants.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscription_status: 'active',
          subscription_tier: 'discovery',
        }),
      })
    );
  });

  it('still stamps the 14-day trial clock for non-gateway tenants (existing behavior)', async () => {
    const tenant = baseTenant({
      subscription_tier: 'discovery',
      subscription_status: 'trial',
      trial_ends_at: null,
    });
    mockTenants.findUnique.mockResolvedValue(tenant);
    mockTenants.update.mockImplementation(async ({ data }) => ({ ...tenant, ...data }));

    await tenantService.getTenantById('tid-test-001');

    expect(mockTenants.update).toHaveBeenCalledTimes(1);
    const call = mockTenants.update.mock.calls[0][0];
    expect(call.data.subscription_status).toBe('trial');
    expect(call.data.trial_ends_at.getTime()).toBeGreaterThan(daysFromNow(13).getTime());
  });
});

describe('TrialManagementService.downgradeToExpired — revert target', () => {
  it('downgrades to directory_presence (free gateway), never to the paid presence tier', async () => {
    mockTenants.findUnique.mockResolvedValue({ manual_subscription_control: false });

    const service = new TrialManagementService();
    await service.downgradeToExpired('tid-test-001');

    expect(mockTenants.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscription_tier: 'directory_presence',
          subscription_status: 'active',
        }),
      })
    );
  });
});
