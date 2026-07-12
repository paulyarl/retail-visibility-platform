/**
 * TenantService
 *
 * Business logic for tenant CRUD operations.
 * Encapsulates all Prisma queries and business rules so route files
 * contain zero direct database access.
 *
 * Per docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md Sprint 4.2/4.3 and
 * .agents/skills/backend-dev-guidelines (§3 Controllers Coordinate, Services Decide).
 */

import { prisma } from '../../prisma';
import { TRIAL_CONFIG } from '../../config/tenant-limits';
import { getLocationStatusInfo } from '../../utils/location-status';

const TENANT_SELECT = {
  id: true,
  name: true,
  created_at: true,
  region: true,
  language: true,
  currency: true,
  subscription_status: true,
  subscription_tier: true,
  trial_ends_at: true,
  subscription_ends_at: true,
  grace_ends_at: true,
  stripe_customer_id: true,
  stripe_subscription_id: true,
  organization_id: true,
  service_level: true,
  managed_services_active: true,
  dedicated_manager: true,
  monthly_sku_quota: true,
  skus_added_this_month: true,
  google_business_access_token: true,
  google_business_refresh_token: true,
  google_business_token_expiry: true,
  created_by: true,
  location_status: true,
  status_changed_at: true,
  status_changed_by: true,
  reopening_date: true,
  closure_reason: true,
  slug: true,
  google_sync_enabled: true,
  google_last_sync: true,
  google_product_count: true,
  directory_visible: true,
  metadata: true,
  data_policy_accepted: true,
  is_demo: true,
  demo_expires_at: true,
  manual_subscription_control: true,
  manual_subscription_expires_at: true,
  manual_subscription_reason: true,
  tenant_business_profiles_list: {
    select: {
      logo_url: true,
      city: true,
      state: true,
      country_code: true,
      banner_url: true,
    },
  },
  _count: {
    select: {
      inventory_items: true,
      user_tenants: true,
    },
  },
  organizations_list: {
    select: {
      id: true,
      name: true,
      subscription_tier: true,
    },
  },
};

export interface TenantDetailResponse {
  id: string;
  name: string;
  created_at: Date;
  region: string;
  language?: string;
  currency?: string;
  subscription_status: string;
  subscription_tier: string;
  trial_ends_at?: Date | null;
  subscription_ends_at?: Date | null;
  grace_ends_at?: Date | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  organization_id?: string | null;
  service_level?: string | null;
  managed_services_active?: boolean;
  dedicated_manager?: string | null;
  monthly_sku_quota?: number;
  skus_added_this_month?: number;
  slug: string;
  hasPublishedDirectory: boolean;
  statusInfo: ReturnType<typeof getLocationStatusInfo>;
  manualSubscriptionControl?: boolean;
  manualSubscriptionExpiresAt?: Date | null;
  manualSubscriptionReason?: string | null;
  effectiveExpiresAt?: Date | null;
  effectiveExpiresType?: string;
  effectiveExpiresSource?: string;
  isDemo: boolean;
  demoExpiresAt: string | null;
  organization: { id: string; name: string; tier: string } | null;
  subscriptionTier: string;
  isChainMember: boolean;
  logoUrl: string | null;
  stats: { productCount: number; userCount: number };
  city: string | null;
  state: string | null;
  countryCode: string | null;
  bannerUrl: string | null;
  [key: string]: any;
}

class TenantService {
  /**
   * Get a single tenant by ID with full detail, including:
   * - Directory settings lookup
   * - Trial expiration auto-processing
   * - Effective expiration calculation
   * - Organization info
   * - Stats (product/user counts)
   */
  async getTenantById(id: string): Promise<TenantDetailResponse> {
    let tenant: any = await prisma.tenants.findUnique({
      where: { id },
      select: TENANT_SELECT,
    });

    if (!tenant) {
      return null as any;
    }

    const directoryResult = await prisma.directory_settings_list.findUnique({
      where: { tenant_id: tenant.id },
      select: { is_published: true, slug: true },
    });

    const hasDirectory = directoryResult?.is_published === true;
    const directorySlug = directoryResult?.slug;
    const currentSlug = directorySlug || tenant.slug;
    const hasPublishedDirectory = directoryResult?.is_published === true;

    const now = new Date();

    // Auto-set trial_ends_at if missing
    if (tenant.subscription_status === 'trial' && !tenant.trial_ends_at) {
      const trial_ends_at = new Date();
      trial_ends_at.setDate(trial_ends_at.getDate() + TRIAL_CONFIG.durationDays);

      tenant = await prisma.tenants.update({
        where: { id: tenant.id },
        data: { trial_ends_at, subscription_status: 'trial' },
      });
    }

    // Auto-expire trial if past trial_ends_at
    if (
      tenant.subscription_status === 'trial' &&
      tenant.trial_ends_at &&
      tenant.trial_ends_at < now
    ) {
      const hasStripeSubscription = !!tenant.stripe_subscription_id;

      tenant = await prisma.tenants.update({
        where: { id: tenant.id },
        data: {
          subscription_status: 'expired',
          subscription_tier: hasStripeSubscription ? tenant.subscription_tier : 'discovery',
        },
      });
    }

    const statusInfo = getLocationStatusInfo(tenant.location_status);

    const effectiveExpiration = tenant.manual_subscription_control
      ? {
          expiresAt: tenant.manual_subscription_expires_at,
          type: 'manual' as const,
          source: 'manual_override' as const,
        }
      : tenant.subscription_status === 'trial' && tenant.trial_ends_at
        ? {
            expiresAt: tenant.trial_ends_at,
            type: 'trial' as const,
            source: 'automatic_trial' as const,
          }
        : tenant.subscription_ends_at
          ? {
              expiresAt: tenant.subscription_ends_at,
              type: 'subscription' as const,
              source: 'automatic_subscription' as const,
            }
          : null;

    const effectiveTier =
      tenant.organizations_list?.subscription_tier || tenant.subscription_tier || 'starter';
    const isChainMember = !!tenant.organizations_list;

    return {
      ...tenant,
      slug: currentSlug,
      hasPublishedDirectory,
      statusInfo,
      manualSubscriptionControl: tenant.manual_subscription_control,
      manualSubscriptionExpiresAt: tenant.manual_subscription_expires_at,
      manualSubscriptionReason: tenant.manual_subscription_reason,
      effectiveExpiresAt: effectiveExpiration?.expiresAt,
      effectiveExpiresType: effectiveExpiration?.type,
      effectiveExpiresSource: effectiveExpiration?.source,
      isDemo: tenant.is_demo || false,
      demoExpiresAt: tenant.demo_expires_at ? tenant.demo_expires_at.toISOString() : null,
      organization: tenant.organizations_list
        ? {
            id: tenant.organizations_list.id,
            name: tenant.organizations_list.name,
            tier: tenant.organizations_list.subscription_tier,
          }
        : null,
      subscriptionTier: effectiveTier,
      isChainMember,
      logoUrl: tenant.tenant_business_profiles_list?.logo_url || null,
      stats: {
        productCount: tenant._count?.inventory_items || 0,
        userCount: tenant._count?.user_tenants || 0,
      },
      city: tenant.tenant_business_profiles_list?.city || null,
      state: tenant.tenant_business_profiles_list?.state || null,
      countryCode: tenant.tenant_business_profiles_list?.country_code || null,
      bannerUrl: tenant.tenant_business_profiles_list?.banner_url || null,
    };
  }

  /**
   * Update a tenant by ID with validated data.
   */
  async updateTenant(id: string, data: Record<string, any>): Promise<any> {
    return prisma.tenants.update({
      where: { id },
      data,
    });
  }
}

export const tenantService = new TenantService();
