import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';

export interface TenantUsage {
  items: number;
  orders: number;
  storage: number;
  bandwidth: number;
  limits: {
    items: number;
    storage: number;
    bandwidth: number;
  };
}

export interface TenantLimits {
  items: number;
  storage: number;
  bandwidth: number;
  features: string[];
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
}

export interface TenantProfile {
  id: string;
  business_name: string;
  address_line1: string;
  city: string;
  postal_code: string;
  country_code: string;
  phone_number: string;
  email: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  business_description?: string;
  hours?: any;
  logo_url?: string;
  social_links?: any;
  seo_tags?: any;
  organizationId?: string;
  metadata?: any;
  // Additional fields for compatibility
  name?: string;
  slug?: string;
  domain?: string;
  logo?: string;
  banner?: string;
  description?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  contact?: {
    email: string;
    phone: string;
    website?: string;
  };
  settings?: {
    theme: string;
    currency: string;
    timezone: string;
  };
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
  updatedAt: string;
}

/**
 * Tenant Management Service
 * Handles authenticated tenant operations with proper caching
 * Used for tenant management, settings, and administrative operations
 */
class TenantManagementService extends TenantApiSingleton {
  private static instance: TenantManagementService;

  // Different TTL for different management operations
  private readonly PROFILE_TTL = 5 * 60 * 1000; // 5 minutes for profile
  private readonly USAGE_TTL = 2 * 60 * 1000; // 2 minutes for usage
  private readonly LIMITS_TTL = 10 * 60 * 1000; // 10 minutes for limits
  private readonly MEDIA_TTL = 30 * 60 * 1000; // 30 minutes for media

  protected constructor() {
    super('tenant-management-singleton');
  }

  public static getInstance(): TenantManagementService {
    if (!TenantManagementService.instance) {
      TenantManagementService.instance = new TenantManagementService();
    }
    return TenantManagementService.instance;
  }

  /**
   * Get current user's tenant profile
   * Uses the /api/tenant endpoint (authenticated)
   */
  async getCurrentTenantProfile(): Promise<TenantProfile | null> {
    try {
      const response = await this.makeDefaultRequest<TenantProfile>(
        '/api/tenant',
        {},
        'current-tenant',
        this.PROFILE_TTL
      );

      return response.data || null;
    } catch (error) {
      console.error('[TenantManagementService] Failed to get current tenant profile:', error);
      return null;
    }
  }

  /**
   * Get current tenant ID (base class method)
   * Uses the base class implementation for compatibility
   */
  getCurrentTenant(): string | undefined {
    return super.getCurrentTenant();
  }

  /**
   * Get tenant profile for management
   * Uses the /api/tenant/profile endpoint (authenticated)
   */
  async getTenantProfile(): Promise<TenantProfile | null> {
    try {
      const response = await this.makeDefaultRequest<TenantProfile>(
        '/api/tenant/profile',
        {},
        'tenant-profile',
        this.PROFILE_TTL
      );

      return response.data || null;
    } catch (error) {
      console.error('[TenantManagementService] Failed to get tenant profile:', error);
      return null;
    }
  }

  /**
   * Update tenant profile
   * Uses the /api/tenant/profile endpoint (authenticated)
   */
  async updateTenantProfile(profileData: Partial<TenantProfile>): Promise<TenantProfile | null> {
    try {
      const response = await this.makeDefaultRequest<TenantProfile>(
        '/api/tenant/profile',
        {
          method: 'PATCH',
          body: JSON.stringify(profileData),
        },
        'tenant-profile'
      );

      // Invalidate cached profile data
      await this.invalidateCache('tenant-profile*');
      
      return response.data || null;
    } catch (error) {
      console.error('[TenantManagementService] Failed to update tenant profile:', error);
      return null;
    }
  }

  /**
   * Get tenant usage statistics
   * Uses the /api/tenants/[id]/complete endpoint and extracts usage data
   */
  async getTenantUsage(tenantId?: string): Promise<TenantUsage | null> {
    try {
      const endpoint = tenantId ? `/api/tenants/${tenantId}/complete` : '/api/tenant-limits/status';
      const cacheKey = tenantId ? `tenant-complete-${tenantId}` : 'current-tenant-usage';

      const response = await this.makeDefaultRequest<any>(
        endpoint,
        {},
        cacheKey,
        this.USAGE_TTL
      );

      // Extract usage data from the complete response
      if (response.data?.usage) {
        return response.data.usage;
      }

      return response.data || null;
    } catch (error) {
      this.logError('Failed to get tenant usage', error);
      return null;
    }
  }

  /**
   * Get tenant limits
   * Uses the /api/tenant-limits/status endpoint (authenticated)
   */
  async getTenantLimits(): Promise<TenantLimits | null> {
    try {
      const response = await this.makeDefaultRequest<TenantLimits>(
        '/api/tenant-limits/status',
        {},
        'tenant-limits',
        this.LIMITS_TTL
      );

      return response.data || null;
    } catch (error) {
      console.error('[TenantManagementService] Failed to get tenant limits:', error);
      return null;
    }
  }

  /**
   * Get tenant banner
   * Uses the /api/tenants/[id]/banner endpoint (authenticated)
   */
  async getTenantBanner(tenantId: string): Promise<string | null> {
    try {
      const response = await this.makeDefaultRequest<{ banner: string }>(
        `/api/tenants/${tenantId}/banner`,
        {},
        `tenant-banner-${tenantId}`,
        this.MEDIA_TTL
      );

      return response?.data?.banner || null;
    } catch (error) {
      console.error('[TenantManagementService] Failed to get tenant banner:', error);
      return null;
    }
  }

  /**
   * Update tenant banner
   * Uses the /api/tenants/[id]/banner endpoint (authenticated)
   */
  async updateTenantBanner(tenantId: string, bannerUrl: string): Promise<boolean> {
    try {
      await this.makeDefaultRequest<void>(
        `/api/tenants/${tenantId}/banner`,
        {
          method: 'PUT',
          body: JSON.stringify({ banner: bannerUrl }),
        },
        `tenant-banner-${tenantId}`
      );

      return true;
    } catch (error) {
      console.error('[TenantManagementService] Failed to update tenant banner:', error);
      return false;
    }
  }

  /**
   * Get tenant logo
   * Uses the /api/tenants/[id]/logo endpoint (authenticated)
   */
  async getTenantLogo(tenantId: string): Promise<string | null> {
    try {
      const response = await this.makeDefaultRequest<{ logo: string }>(
        `/api/tenants/${tenantId}/logo`,
        {},
        `tenant-logo-${tenantId}`,
        this.MEDIA_TTL
      );

      return response?.data?.logo || null;
    } catch (error) {
      console.error('[TenantManagementService] Failed to get tenant logo:', error);
      return null;
    }
  }

  /**
   * Update tenant logo
   * Uses the /api/tenants/[id]/logo endpoint (authenticated)
   */
  async updateTenantLogo(tenantId: string, logoUrl: string): Promise<boolean> {
    try {
      await this.makeDefaultRequest<void>(
        `/api/tenants/${tenantId}/logo`,
        {
          method: 'PUT',
          body: JSON.stringify({ logo: logoUrl }),
        },
        `tenant-logo-${tenantId}`
      );

      return true;
    } catch (error) {
      console.error('[TenantManagementService] Failed to update tenant logo:', error);
      return false;
    }
  }

  /**
   * Invalidate all tenant management cache
   * Useful after tenant updates or when switching tenants
   */
  public async invalidateTenantManagementCache(tenantId?: string): Promise<void> {
    const patterns = [
      'tenant-profile*',
      'current-tenant*',
      'tenant-limits',
      'tenant-usage*',
    ];

    if (tenantId) {
      patterns.push(`tenant-banner-${tenantId}`);
      patterns.push(`tenant-logo-${tenantId}`);
      patterns.push(`tenant-profile-${tenantId}`);
    }

    for (const pattern of patterns) {
      await this.invalidateCache(pattern);
    }
  }
}

// Export singleton instance
export const tenantManagementService = TenantManagementService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateTenantManagementCache = async (tenantId?: string): Promise<void> => {
  await tenantManagementService.invalidateTenantManagementCache(tenantId);
};
