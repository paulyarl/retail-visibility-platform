/**
 * Platform Home Page Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached platform home page operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';
import { AppContext, CacheIsolation } from '../utils/contextCacheManager';
import { platformDashboardService } from './PlatformDashboardSingletonService';
import { BusinessProfile, normalizePhoneInput } from '../lib/validation/businessProfile';
import TenantApiSingleton from '@/providers/base/TenantApiSingleton';
import { RequestType } from '@/providers/base/FlexibleApiSingleton';
import { unifiedCapabilityService } from './UnifiedCapabilityService';

export interface Tenant {
  id: string;
  name: string;
  logoUrl?: string;
  bannerUrl?: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  subscription_status?: string; // Database field
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  region?: string;
  language?: string;
  currency?: string;
  data_policy_accepted?: boolean;
  metadata?: any;
  organization?: {
    id: string;
    name: string;
  } | null;
  featured_access_approved?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  memberCount?: number;
}

export interface PendingRequest {
  id: string;
  tenantId: string;
  requestedTier: string;
  currentTier: string;
  status: string;
  createdAt: string;
  processedAt?: string;
  notes?: string;
  costAgreed?: boolean;
  estimatedCost?: number;
  costCurrency?: string;
  organization?: {
    id: string;
    name: string;
  };
}

export interface UpgradeRequest {
  id: string;
  tenantId: string;
  business_name?: string;
  currentTier: string;
  requestedTier: string;
  status: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
  adminNotes?: string;
}

export interface UpgradeRequestsResponse {
  data: UpgradeRequest[];
  total: number;
  page: number;
  limit: number;
}

export interface UserPreferences {
  navigationPreference?: string;
  theme?: string;
  language?: string;
  timezone?: string;
  notifications?: Record<string, boolean>;
}

export interface SentryConfig {
  configured: boolean;
  dsn?: string;
  environment?: string;
  tracesSampleRate?: number;
  data?: {
    metrics?: SentryMetric[];
    projects?: SentryProject[];
  };
  mockData?: {
    metrics?: SentryMetric[];
    projects?: SentryProject[];
  };
}

export interface SentryMetric {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'stable';
  description: string;
}

export interface SentryProject {
  id: string;
  name: string;
  slug: string;
  platform: string;
  status: 'active' | 'inactive';
  lastEvent: string;
}

export interface ScanSession {
  id: string;
  tenantId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  itemsScanned: number;
  errors: string[];
  metadata?: any;
  deviceType?: string;
  scannedCount?: number;
  committedCount?: number;
  duplicateCount?: number;
  results?: ScanResult[];
}

export interface ScanResult {
  id: string;
  barcode: string;
  sku?: string;
  status: string;
  enrichment?: any;
  duplicateOf?: string;
  createdAt: string;
}

export interface TenantUser {
  id: string;
  email: string;
  name: string;
  platformRole: 'ADMIN' | 'OWNER' | 'USER';
  tenantRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  isActive: boolean;
  lastLogin: string;
  addedAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  created_at: string;
  last_login_at?: string;
  is_active: boolean;
  email_verified: boolean;
}

export interface DbTier {
  id: string;
  tierKey: string;
  displayName: string;
  priceMonthly: number;
  maxSkus: number | null;
  maxLocations: number | null;
  tierType: string;
  isActive: boolean;
  sortOrder: number;
}

export interface FeaturedProduct {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  title?: string;
  brand?: string;
  price_cents: number;
  image_url?: string;
  is_featured: boolean;
  featured_at: string;
  featured_until?: string;
  featured_priority: number;
  tenants: {
    id: string;
    name: string;
    subscription_tier: string;
  };
}

export interface FeaturingStats {
  totalFeatured: number;
  byTier: Array<{ tier: string; count: string }>;
  expiringSoon: number;
}

export interface PlatformCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  google_category_id: string | null;
  icon_emoji: string;
  sort_order: number;
  level: number;
  parent_id: string | null;
  is_active: boolean;
  store_count: number;
  product_count: number;
  listing_count: number;
  avg_rating: number;
  created_at: string;
  updated_at: string;
}

export interface Tier {
  id: string;
  tierKey: string;
  name: string;
  displayName: string;
  description: string;
  priceMonthly: number;
  maxSkus: number | null;
  maxLocations: number | null;
  tierType: string;
  isActive: boolean;
  sortOrder: number;
  features: TierFeature[];
  createdAt: string;
  updatedAt: string;
}

export interface TierFeature {
  id: string;
  featureKey: string;
  featureName: string;
  isEnabled: boolean;
  isInherited: boolean;
}

export interface TierSystem {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  tiers: Tier[];
}

export interface DirectoryStats {
  total: number;
  published: number;
  featured: number;
  draft: number;
  byTier: Record<string, number>;
}

export interface AdminDirectoryListing {
  id: string;
  tenant_id: string;
  is_published: boolean;
  is_featured: boolean;
  primaryCategory?: string;
  secondaryCategories?: string[];
  slug?: string;
  updatedAt: string;
  qualityScore: number;
  itemCount: number;
  businessName: string;
  tenant: {
    id: string;
    name: string;
    subscriptionTier: string;
  };
}

export interface DirectoryFilters {
  status?: 'published' | 'draft' | 'featured';
  tier?: 'google_only' | 'starter' | 'discovery' | 'commitment' | 'storefront' | 'enterprise' | 'chain_starter' | 'chain_pro' | 'chain_enterprise';
  quality?: 'low' | 'medium' | 'high';
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PopularProduct {
  barcode: string;
  name: string;
  brand: string;
  fetchCount: number;
  source: string;
}

export interface Analytics {
  totalProducts: number;
  popularProducts: PopularProduct[];
  dataQuality: {
    withNutrition: number;
    withImages: number;
    withEnvironmental: number;
    nutritionPercentage: string;
    imagesPercentage: string;
    environmentalPercentage: string;
  };
  sourceBreakdown: any[];
  recentAdditions: number;
  apiCallsSaved: number;
  estimatedCostSavings: string;
}

export interface SubdomainStats {
  totalTenants: number;
  tenantsWithSubdomains: number;
  adoptionRate: number;
  recentAdoptions: number;
  subdomainList: Array<{
    subdomain: string;
    tenantId: string;
    createdAt: string;
  }>;
}

export interface RateLimitConfig {
  subdomainCheck: { maxRequests: number; windowMs: number };
  subdomainCreate: { maxRequests: number; windowMs: number };
  subdomainResolve: { maxRequests: number; windowMs: number };
}

export interface FulfillmentSettings {
  pickup_enabled: boolean;
  pickup_instructions: string | null;
  pickup_ready_time_minutes: number;
  delivery_enabled: boolean;
  delivery_radius_miles: number | null;
  delivery_fee_cents: number;
  delivery_min_free_cents: number | null;
  delivery_time_hours: number;
  delivery_instructions: string | null;
  shipping_enabled: boolean;
  shipping_flat_rate_cents: number | null;
  shipping_min_free_cents: number | null;
  shipping_zones: any[];
  shipping_handling_days: number;
  shipping_provider: string | null;
}

export interface CloverStatus {
  enabled: boolean;
  mode: 'demo' | 'production' | null;
  status: string | null;
  stats?: {
    totalItems: number;
    mappedItems: number;
    conflictItems: number;
  };
  demoEnabledAt?: string;
  demoLastActiveAt?: string;
  lastSyncAt?: string;
}

export interface SimulationScenario {
  scenario: string;
  name: string;
  description: string;
  type: 'item' | 'category';
}

export interface SimulationEvent {
  id: string;
  scenario: string;
  timestamp: string;
  status: 'pending' | 'syncing' | 'success' | 'failed' | 'conflict';
  affectedItems: string[];
  changes: { field: string; oldValue: any; newValue: any }[];
  message: string;
  resolution?: string;
}

export interface SimulationResult {
  itemId: string;
  itemName: string;
  sku: string;
  field: string;
  oldValue: any;
  newValue: any;
  action: 'updated' | 'created' | 'archived' | 'conflict' | 'failed';
}

export interface GoogleSetupStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  action: string;
  requires?: string;
}

export interface GoogleSetupStatus {
  isReady: boolean;
  hasGoogleAccount: boolean;
  hasMerchantLink: boolean;
  hasOAuthTokens: boolean;
  setupSteps: GoogleSetupStep[];
  message: string;
}

export interface GoogleGBPStatus {
  isConnected: boolean;
  isExpired: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenExpiry: string | null;
  message: string;
}

export interface GoogleMerchantAccount {
  id: string;
  name: string;
  displayName: string;
}

export interface SquareStatus {
  enabled: boolean;
  status: string | null;
  stats?: {
    totalItems: number;
    mappedItems: number;
    conflictItems: number;
  };
  lastSyncAt?: string;
  merchantId?: string;
}

export interface SquareSyncLog {
  id: string;
  operation: string;
  status: string;
  items_processed: number;
  items_succeeded: number;
  items_failed: number;
  started_at: string;
  completed_at?: string;
}

/**
 * Platform Home Singleton Service
 * 
 * Provides cached operations for platform home page data including:
 * - Tenant information and management
 * - Organization management
 * - Business profile management
 * - User preferences
 * - Sentry configuration
 * - Scan sessions
 * - Upgrade requests
 */
export class PlatformHomeSingletonService extends TenantApiSingleton {
  private static instance: PlatformHomeSingletonService;
  protected readonly cacheTTL = 10 * 60 * 1000; // 10 minutes

  protected constructor() {
    super('platform-home-singleton');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PlatformHomeSingletonService {
    if (!PlatformHomeSingletonService.instance) {
      PlatformHomeSingletonService.instance = new PlatformHomeSingletonService();
    }
    return PlatformHomeSingletonService.instance;
  }

  /**
   * Get all tenants for the current user
   */
  async getTenants(): Promise<Tenant[] | null> {
    const result = await this.makeDefaultRequest<Tenant[]>(
      '/api/tenants',
      {},
      'platform-tenants',
      this.cacheTTL,
      {
        context: AppContext.USER,
        isolation: CacheIsolation.USER,
        requestType: RequestType.AUTHENTICATED
      }
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get tenants:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get all organizations
   */
  async getOrganizations(): Promise<Organization[] | null> {
    const result = await this.makeDefaultRequest<Organization[]>(
      '/api/organizations',
      {},
      'platform-organizations',
      this.cacheTTL,
      {
        context: AppContext.TENANT,
        isolation: CacheIsolation.TENANT,
        requestType: RequestType.AUTHENTICATED
      }
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get organizations:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get pending upgrade request for tenant
   */
  async getPendingUpgradeRequest(tenantId: string): Promise<PendingRequest | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<PendingRequest>(
      `/api/organization-requests?tenantId=${tenantId}&status=pending`,
      {},
      `platform-pending-request-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get pending upgrade request:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get tenant details
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<Tenant>(
      `/api/tenants/${tenantId}`,
      {},
      `platform-tenant-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get tenant details:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get tenant profile
   */
  async getTenantProfile(tenantId: string): Promise<BusinessProfile | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<BusinessProfile>(
      `/api/tenant/profile?tenant_id=${encodeURIComponent(tenantId)}`,
      {},
      `platform-tenant-profile-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get tenant profile:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Update tenant profile
   */
  async updateTenantProfile(tenantId: string, profileData: Partial<BusinessProfile>): Promise<BusinessProfile | null> {
    // console.log('[PlatformHomeSingleton] updateTenantProfile called with tenantId:', tenantId, 'profileData:', profileData);
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<BusinessProfile>(
      '/api/tenant/profile',
      { 
        method: 'PATCH',
        body: JSON.stringify({ tenant_id: tenantId, ...profileData })
      },
      `platform-tenant-profile-${tenantId}`
    );

    // console.log('[PlatformHomeSingleton] updateTenantProfile result:', result);
    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to update tenant profile:', result.error);
      throw result.error;
    }

    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(tenantId);

    return result.data || null;
  }

  /**
   * PILOT: Get all cache patterns for this service
   * Documents all cache keys that this service manages
   */
  public getServiceCachePatterns(): string[] {
    return [
      'platform-tenant-complete-{tenantId}*',
      'platform-tenant-profile-{tenantId}*',
      'platform-tenant-{tenantId}*',
      'platform-tenant-logo-{tenantId}*',
      'platform-tenant-fulfillment-settings-{tenantId}*',
      'public-shops*',
      'platform-tenants*',
      'platform-dashboard-complete*',
      'platform-organizations*',
      'platform-tier-system-tiers*',
      'platform-tier-system-tiers-{tierId}*',
      'platform-platform-categories*',
      'platform-featured-products*',
      'platform-admin-directory-listings*',
      'platform-admin-directory-stats*',
      'platform-upgrade-requests-{tenantId}*',
      'platform-pending-request-{tenantId}*',
      'platform-pending-request*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   * Other services can call this to invalidate platform-related caches
   */
  public async invalidateServiceCaches(tenantId?: string, tierId?: string): Promise<void> {
    // console.log(`[PlatformHomeSingletonService] 🔄 Starting cache invalidation:`, { tenantId, tierId });
    
    // Invalidate client-side caches first
    if (tenantId) {
      // Invalidate specific tenant caches
      await this.invalidateTenantCaches(tenantId);
    } else {
      // Invalidate all platform caches
      await this.invalidateCachePattern('platform-*');
    }
    
    if (tierId) {
      // Invalidate specific tier caches
      await this.invalidateTierCaches(tierId);
    }
    
    // Also invalidate server-side API cache
    await this.invalidateApiCache(tenantId);
  }

  /**
   * Invalidate server-side API cache to ensure fresh data
   */
  private async invalidateApiCache(tenantId?: string): Promise<void> {
    try {
      await this.makeDefaultRequest<any>(
        '/api/cache/invalidate/tenants',
        {
          method: 'POST',
          headers: { 'Cache-Control': 'no-cache' },
          body: JSON.stringify({ tenantId }),
        },
      );
    } catch (error) {
      console.warn(`[PlatformHomeSingletonService] API cache invalidation error:`, error);
      // Don't throw - client cache invalidation is still valuable
    }
  }

  /**
   * PILOT: Declare cross-service cache dependencies
   * Platform service depends on dashboard service for stats
   */
  public getCrossServiceInvalidations(): Array<{service: () => any, method: string, params: any[]}> {
    return [
      { service: () => platformDashboardService, method: 'invalidateStatsCache', params: [] }
    ];
  }

  public async invalidateTenantCaches(tenantId: string) {
    // Use enhanced pattern matching for dynamic keys
    await this.invalidateCachePattern(`platform-tenant-complete-${tenantId}*`);
    // Invalidate tenant profile cache (exact key, no wildcard)
    await this.invalidateCachePattern(`platform-tenant-profile-${tenantId}*`);
    // Invalidate tenant cache (slug is stored on tenant record)
    await this.invalidateCachePattern(`platform-tenant-${tenantId}*`);
    await this.invalidateCachePattern('public-shops*');
    // Invalidate tenants cache
    await this.invalidateCachePattern('platform-tenants*');    
    // Invalidate platform dashboard cache since tenants affect stats
    await this.invalidateCachePattern('platform-dashboard-complete*'); 
    await this.invalidateCachePattern(`platform-tenant-logo-${tenantId}*`);
    await this.invalidateCachePattern(`platform-tenant-fulfillment-settings-${tenantId}*`);
    await this.invalidateCachePattern('platform-organizations*');

    // Invalidate public tenant cache so storefront picks up tier/status changes immediately
    const { tenantPublicService } = await import('./TenantPublicService');
    await tenantPublicService.invalidatePublicTenantCache(tenantId);

    // Non-blocking MV refresh for tenant-related views only
    // this.refreshMaterializedView(['mv_global_discovery', 'directory_category_listings', 'directory_gbp_listings']).catch(err => {
    //   console.warn('[PlatformHomeSingleton] Background MV refresh failed:', err);
    // });
  }

  /**
   * Create new tenant
   */
  async createTenant(tenantData: {
    name: string;
    slug: string;
    city?: string;
    state?: string;
    country_code?: string;
  }): Promise<Tenant | null> {
    const result = await this.makeDefaultRequest<Tenant>(
      '/api/tenants',
      { 
        method: 'POST',
        body: JSON.stringify(tenantData)
      },
      'platform-create-tenant'
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to create tenant:', result.error);
      throw result.error;
    }
    

    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(result.data?.id || '');

    return result.data || null;
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<Tenant>(
      `/api/tenants/${tenantId}`,
      { 
        method: 'PUT',
        body: JSON.stringify(updates)
      },
      `platform-tenant-${tenantId}`
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to update tenant:', result.error);
      throw result.error;
    }
    
    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(tenantId);

    return result.data || null;
  }

  /**
   * Delete tenant
   */
  async deleteTenant(tenantId: string): Promise<void> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/tenants/${tenantId}`,
      { method: 'DELETE' },
      `platform-delete-tenant-${tenantId}`
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to delete tenant:', result.error);
      throw result.error;
    }

   
    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(tenantId);

  }

  /**
   * Get admin tier tenants
   */
  async getAdminTierTenants(): Promise<Tenant[] | null> {
    const result = await this.makeDefaultRequest<{ tenants: Tenant[] }>(
      '/api/admin/tiers/tenants',
      {},
      'platform-admin-tier-tenants',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get admin tier tenants:', result.error);
      return null;

    }
    // console.log(`[PlatformHomeSingleton] Got admin tier tenants:`, result.data)

    return result.data?.tenants || null;
  }

  /**
   * Update tenant tier and status
   */
  async updateTenantTier(tenantId: string, updates: {
    subscriptionTier: string;
    subscriptionStatus: string;
    reason?: string;
  }): Promise<Tenant | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<Tenant>(
      `/api/admin/tiers/tenants/${tenantId}`,
      { 
        method: 'PATCH',
        body: JSON.stringify(updates)
      },
      `platform-update-tenant-tier-${tenantId}`
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to update tenant tier:', result.error);
      throw result.error;
    }
    
    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(tenantId);

    return result.data || null;
  }

  /**
   * Update product priority
   */
  async updateProductPriority(tenantId: string, productId: string, priority: number): Promise<void> {
    if (!tenantId || !productId) {
      throw new Error('Tenant ID and Product ID are required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/tenants/${tenantId}/products/${productId}/feature/priority`,
      { 
        method: 'PATCH',
        body: JSON.stringify({ priority })
      },
      `platform-update-product-priority-${tenantId}-${productId}`
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to update product priority:', result.error);
      throw result.error;
    }

    // Invalidate featured products cache - use enhanced pattern matching
    await this.invalidateCachePattern('platform-featured-products*');
  }

  /**
   * Get platform categories
   */
  async getPlatformCategories(): Promise<PlatformCategory[] | null> {
    const result = await this.makeDefaultRequest<{ data: { categories: PlatformCategory[] } }>(
      '/api/admin/platform-categories',
      {},
      'platform-platform-categories',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get platform categories:', result.error);
      return null;
    }

    return result.data?.data.categories || null;
  }

  /**
   * Create platform category
   */
  async createPlatformCategory(categoryData: Partial<PlatformCategory>): Promise<PlatformCategory | null> {
    const result = await this.makeDefaultRequest<PlatformCategory>(
      '/api/admin/platform-categories',
      { 
        method: 'POST',
        body: JSON.stringify(categoryData)
      },
      'platform-create-platform-category'
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to create platform category:', result.error);
      throw result.error;
    }

    // Invalidate platform categories cache - use enhanced pattern matching
    await this.invalidateCachePattern('platform-platform-categories*');

    return result.data || null;
  }

  /**
   * Update platform category
   */
  async updatePlatformCategory(categoryId: string, categoryData: Partial<PlatformCategory>): Promise<PlatformCategory | null> {
    if (!categoryId) {
      throw new Error('Category ID is required');
    }

    const result = await this.makeDefaultRequest<PlatformCategory>(
      `/api/admin/platform-categories/${categoryId}`,
      { 
        method: 'PATCH',
        body: JSON.stringify(categoryData)
      },
      `platform-update-platform-category-${categoryId}`
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to update platform category:', result.error);
      throw result.error;
    }

    // Invalidate platform categories cache - use enhanced pattern matching
    await this.invalidateCachePattern('platform-platform-categories*');

    return result.data || null;
  }

  /**
   * Delete platform category
   */
  async deletePlatformCategory(categoryId: string): Promise<void> {
    if (!categoryId) {
      throw new Error('Category ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/admin/platform-categories/${categoryId}`,
      { method: 'DELETE' },
      `platform-delete-platform-category-${categoryId}`
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to delete platform category:', result.error);
      throw result.error;
    }

    // Invalidate platform categories cache - use enhanced pattern matching
    await this.invalidateCachePattern('platform-platform-categories*');
  }

  /**
   * Reorder platform categories
   */
  async reorderPlatformCategories(categoryIds: string[]): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      '/api/admin/platform-categories/reorder',
      { 
        method: 'POST',
        body: JSON.stringify({ categoryIds })
      },
      'platform-reorder-platform-categories'
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to reorder platform categories:', result.error);
      throw result.error;
    }

    // Invalidate platform categories cache - use enhanced pattern matching
    await this.invalidateCachePattern('platform-platform-categories*');
  }

  /**
   * Bulk import platform categories
   */
  async bulkImportPlatformCategories(source: string): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      '/api/platform/categories/bulk-import',
      { 
        method: 'POST',
        body: JSON.stringify({ source })
      },
      'platform-bulk-import-categories'
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to bulk import platform categories:', result.error);
      throw result.error;
    }

    // Invalidate platform categories cache - use enhanced pattern matching
    await this.invalidateCachePattern('platform-platform-categories*');

    return result.data;
  }

  /**
   * Create platform category from Google
   */
  async createPlatformCategoryFromGoogle(categoryData: {
    name: string;
    slug: string;
    googleCategoryId: string;
  }): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/platform/categories',
        { 
          method: 'POST',
          body: JSON.stringify(categoryData)
        },
        'platform-create-category-from-google'
      );

      // Invalidate platform categories cache - use enhanced pattern matching
      await this.invalidateCachePattern('platform-platform-categories*');

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to create platform category from Google:', error);
      throw error;
    }
  }

  /**
   * Get tier system tiers
   */
  async getTierSystemTiers(includeInactive: boolean = false): Promise<Tier[] | null> {
    const url = includeInactive ? '/api/admin/tiers/tiers?includeInactive=true' : '/api/admin/tiers/tiers';
    const cacheKey = includeInactive ? 'platform-tier-system-tiers-inactive' : 'platform-tier-system-tiers';
    // console.log('[PlatformHomeSingleton] getTierSystemTiers called with includeInactive:', includeInactive, 'URL:', url, 'CacheKey:', cacheKey);
    const result = await this.makeDefaultRequest<{ individual: any[], organization: any[] }>(
      url,
      {},
      cacheKey,
      this.cacheTTL,
      {
        context: AppContext.ADMIN,
        isolation: CacheIsolation.ADMIN
      }
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get tier system tiers:', result.error);
      return [];
    }

    // Transform grouped response to flat array and map to Tier format
    if (result.data?.individual && result.data?.organization) {
      const allTiers = [...result.data.individual, ...result.data.organization];
      return allTiers.map(tier => ({
        id: tier.id,
        tierKey: tier.id,
        name: tier.name,
        displayName: tier.displayName,
        description: tier.description,
        priceMonthly: tier.price,
        maxSkus: tier.maxSkus,
        maxLocations: tier.maxLocations,
        tierType: tier.type,
        isActive: tier.isActive !== undefined ? tier.isActive : true, // Use API field or default to true
        sortOrder: tier.sortOrder,
        // Preserve full feature objects with highlight fields (API now returns objects, not strings)
        features: (tier.features || []).map((feature: any) => {
          // Handle both object format (new) and string format (legacy fallback)
          if (typeof feature === 'string') {
            return {
              id: feature,
              featureKey: feature,
              featureName: feature.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
              isEnabled: true,
              isInherited: false,
              isHighlighted: false,
              highlightOrder: 0,
              highlightDescription: null,
              marketingName: null
            };
          }
          return {
            id: feature.id,
            featureKey: feature.featureKey,
            featureName: feature.featureName,
            isEnabled: feature.isEnabled ?? true,
            isInherited: feature.isInherited ?? false,
            isHighlighted: feature.isHighlighted ?? false,
            highlightOrder: feature.highlightOrder ?? 0,
            highlightDescription: feature.highlightDescription ?? null,
            marketingName: feature.marketingName ?? null
          };
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    }
    
    return [];
  }

  /**
   * Update tier active status
   */
  async updateTierStatus(tierId: string, isActive: boolean, customReason?: string): Promise<Tier | null> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const reason = customReason || `Tier ${isActive ? 'activated' : 'deactivated'} via admin interface at ${new Date().toISOString()}`;

    const result = await this.makeDefaultRequest<Tier>(
      `/api/admin/tier-system/tiers/${tierId}`,
      { 
        method: 'PATCH',
        body: JSON.stringify({ 
          isActive,
          reason
        })
      },
      `platform-update-tier-status-${tierId}`,
      this.cacheTTL,
      {
        context: AppContext.ADMIN,
        isolation: CacheIsolation.ADMIN
      }
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to update tier status:', result.error);
      throw result.error;
    }

    // Invalidate tier system cache
    await this.invalidateTierCaches(tierId); // Clear the main endpoint cache

    return result.data || null;
  }

  private async invalidateTierCaches(tierId: string) {
    // Use context-aware invalidation for tier system
    // // Clear admin, system, and tenant contexts since tier changes affect all levels
    // await this.invalidateCacheAcrossContexts('platform-tier-system-tiers', [AppContext.ADMIN, AppContext.SYSTEM, AppContext.TENANT], [CacheIsolation.ADMIN, CacheIsolation.TENANT, CacheIsolation.USER]);
    
    // // Also clear specific tier-based patterns
    // await this.invalidateCachePattern(`platform-tier-system-tiers-${tierId}*`);
    // await this.invalidateCachePattern('/api/admin/tiers/tiers*');
    
    // await this.refreshMaterializedView(undefined, true);

    // const cacheKeys = [
    //   `platform-tenants`,
    //   `platform-admin-tier-tenants`,
    //   `platform-admin-tiers`,
    //   `/api/featured-products/tenants/all-with-featured-access-status`,
    //   `/api/admin/products/featuring/stats`,
    //   `/api/admin/products/featured?limit=20&offset=0&is_active=true`,
    //   `platform-tier-system-tiers`,
    //   `/api/admin/tiers/tiers`,
    //   `/api/featured-products/all-featured-products`
    // ];

    const cacheKeys = this.getTierCachePatterns();

    for (const key of cacheKeys) {
      await this.invalidateCacheWithContext(`${key}`);
    }
  }
 /**
   * PILOT: Get all tier cache patterns for this service
   * Documents all tier cache keys that this service manages
   */
  private getTierCachePatterns(): string[] {
    return [
      `platform-tenants`,
      `platform-admin-tier-tenants`,
      `platform-admin-tiers`,
      `/api/admin/tiers/tiers`,
      `/api/featured-products/tenants/all-with-featured-access-status`,
      `/api/admin/products/featuring/stats`,
      `/api/admin/products/featured?limit=20&offset=0&is_active=true`,
      `platform-tier-system-tiers`,
    ];
  }
  /**
   * Update tier
   */
  async updateTier(tierId: string, tierUpdates: Partial<Tier>): Promise<Tier | null> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    // Add reason for audit trail
    const updatePayload = {
      ...tierUpdates,
      reason: `Tier updated via admin interface at ${new Date().toISOString()}`
    };

    const result = await this.makeDefaultRequest<{tier: Tier}>(
      `/api/admin/tier-system/tiers/${tierId}`,
      { 
        method: 'PUT',
        body: JSON.stringify(updatePayload)
      },
      `platform-update-tier-${tierId}`,
      this.cacheTTL,
      {
        context: AppContext.ADMIN,
        isolation: CacheIsolation.ADMIN
      }
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to update tier:', result.error);
      throw result.error;
    }
   
    // Invalidate tier system cache
    await this.invalidateTierCaches(tierId); // Clear the main endpoint cache

    // Return the nested tier data from response
    const returnedTier = result.data?.tier || null;
    console.log('[PlatformHomeSingleton] updateTier returning:', returnedTier);
    return returnedTier;
  }

  /**
   * Update tier sort order
   */
  async updateTierSortOrder(tierId: string, sortOrder: number): Promise<void> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/admin/tier-system/tiers/${tierId}/sort-order`,
      { 
        method: 'PATCH',
        body: JSON.stringify({ sortOrder })
      },
      `platform-update-tier-sort-order-${tierId}`,
      this.cacheTTL,
      {
        context: AppContext.ADMIN,
        isolation: CacheIsolation.ADMIN
      }
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to update tier sort order:', result.error);
      throw result.error;
    }

    // Invalidate tier system cache
    await this.invalidateTierCaches(tierId); // Clear the main endpoint cache

  }

  /**
   * Create tier
   */
  async createTier(tierData: Omit<Tier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tier | null> {
    // Auto-generate reason from tier data
    const reason = `Creating new ${tierData.tierType} tier "${tierData.displayName}" (${tierData.tierKey}) - $${tierData.priceMonthly}/month, ${tierData.maxSkus === null ? 'unlimited' : tierData.maxSkus} SKUs, ${tierData.maxLocations === null ? 'unlimited' : tierData.maxLocations} location(s)`;

    const result = await this.makeDefaultRequest<Tier>(
      '/api/admin/tier-system/tiers',
      { 
        method: 'POST',
        body: JSON.stringify({
          ...tierData,
          id: `tier_${tierData.tierKey}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          reason
        })
      },
      `platform-create-tier-${tierData.tierKey}`,
      this.cacheTTL,
      {
        context: AppContext.ADMIN,
        isolation: CacheIsolation.ADMIN
      }
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to create tier:', result.error);
      throw result.error;
    }

    // Invalidate tier system cache
    await this.invalidateTierCaches(tierData.tierKey);

    return result.data || null;
  }

  /**
   * Delete tier
   */
  async deleteTier(tierId: string): Promise<void> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/admin/tier-system/tiers/${tierId}`,
      { method: 'DELETE' },
      `platform-delete-tier-${tierId}`,
      this.cacheTTL,
      {
        context: AppContext.ADMIN,
        isolation: CacheIsolation.ADMIN
      }
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to delete tier:', result.error);
      throw result.error;
    }

    // Invalidate tier system cache
    await this.invalidateTierCaches(tierId);
  }

  /**
   * Get admin directory stats
   */
  async getAdminDirectoryStats(): Promise<DirectoryStats | null> {
    const result = await this.makeDefaultRequest<DirectoryStats>(
      '/api/admin/directory/stats',
      {},
      'platform-admin-directory-stats',
      this.cacheTTL,
      {
        context: AppContext.ADMIN,
        isolation: CacheIsolation.ADMIN
      }
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get admin directory stats:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get admin directory listings
   */
  async getAdminDirectoryListings(filters: DirectoryFilters = {}): Promise<{
    listings: AdminDirectoryListing[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  } | null> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.tier) params.append('tier', filters.tier);
    if (filters.quality) params.append('quality', filters.quality);
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    // Include filters in cache key for proper cache invalidation
    const filterKey = params.toString() || 'all';
    const cacheKey = `platform-admin-directory-listings:${filterKey}`;

    const result = await this.makeDefaultRequest<{
      listings: AdminDirectoryListing[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(
      `/api/admin/directory/listings?${params}`,
      {},
      cacheKey,
      this.cacheTTL,
      {
        context: AppContext.ADMIN,
        isolation: CacheIsolation.ADMIN
      }
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get admin directory listings:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Feature directory listing
   */
  async featureDirectoryListing(tenantId: string, until: Date, priority?: number): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.makeDefaultRequest<void>(
        `/api/admin/directory/feature/${tenantId}`,
        { 
          method: 'POST',
          body: JSON.stringify({ 
            featured_until: until.toISOString(),
            placement_priority: priority || 5
          })
        },
        `platform-feature-directory-listing-${tenantId}`
      );

      // Invalidate directory listings cache - use enhanced pattern matching
      await this.invalidateCachePattern('platform-admin-directory-listings*');
      await this.invalidateCachePattern('platform-admin-directory-stats*');
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to feature directory listing:', error);
      throw error;
    }
  }

  /**
   * Unfeature directory listing
   */
  async unfeatureDirectoryListing(tenantId: string): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.makeDefaultRequest<void>(
        `/api/admin/directory/unfeature/${tenantId}`,
        { method: 'DELETE' },
        `platform-unfeature-directory-listing-${tenantId}`
      );

      // Invalidate directory listings cache - use enhanced pattern matching
      await this.invalidateCachePattern('platform-admin-directory-listings*');
      await this.invalidateCachePattern('platform-admin-directory-stats*');
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to unfeature directory listing:', error);
      throw error;
    }
  }

  /**
   * Get admin enrichment analytics
   */
  async getAdminEnrichmentAnalytics(): Promise<Analytics | null> {
    const result = await this.makeDefaultRequest<Analytics>(
      `/api/admin/enrichment/analytics?_t=${Date.now()}`,
      {},
      'platform-admin-enrichment-analytics',
      this.cacheTTL,
      {
        context: AppContext.ADMIN,
        isolation: CacheIsolation.ADMIN
      }
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get admin enrichment analytics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Search admin enrichment products
   */
  async searchAdminEnrichmentProducts(params: {
    search?: string;
    source?: string;
    limit?: number;
  }): Promise<any> {
    try {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search);
      if (params.source) searchParams.append('source', params.source);
      if (params.limit) searchParams.append('limit', params.limit.toString());

      const result = await this.makeDefaultRequest<any>(
        `/api/admin/enrichment/search?${searchParams}`,
        {},
        'platform-admin-enrichment-search',
        this.cacheTTL
      );

      return result.data;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to search admin enrichment products:', error);
      throw error;
    }
  }

  /**
   * Get admin enrichment product details
   */
  async getAdminEnrichmentProduct(barcode: string): Promise<any> {
    try {
      if (!barcode) {
        throw new Error('Barcode is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/admin/enrichment/${barcode}`,
        {},
        `platform-admin-enrichment-product-${barcode}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get admin enrichment product:', error);
      throw error;
    }
  }

  /**
   * Get admin subdomain stats
   */
  async getAdminSubdomainStats(): Promise<SubdomainStats | null> {
    const result = await this.makeDefaultRequest<{ data: SubdomainStats }>(
      '/api/analytics/subdomain-stats',
      {},
      'platform-admin-subdomain-stats',
      this.cacheTTL,
      {
        context: AppContext.ADMIN,
        isolation: CacheIsolation.ADMIN
      }
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get admin subdomain stats:', result.error);
      return null;
    }

    return result.data?.data || null;
  }

  /**
   * Get tenant logo
   */
  async getTenantLogo(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Use public service for public endpoint
      const { tenantPublicService } = await import('./TenantPublicService');
      const result = await tenantPublicService.getTenantLogo(tenantId);

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get tenant logo:', error);
      throw error;
    }
  }

  /**
   * Upload tenant logo
   */
  async uploadTenantLogo(tenantId: string, dataUrl: string, contentType: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenant/${encodeURIComponent(tenantId)}/logo`,
        { 
          method: 'POST',
          body: JSON.stringify({
            tenant_id: tenantId,
            dataUrl,
            contentType,
          })
        },
        `platform-upload-tenant-logo-${tenantId}`
      );

     
    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(tenantId);

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to upload tenant logo:', error);
      throw error;
    }
  }

  /**
   * Upload tenant banner
   */
  async uploadTenantBanner(tenantId: string, dataUrl: string, contentType: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenant/${encodeURIComponent(tenantId)}/banner`,
        { 
          method: 'POST',
          body: JSON.stringify({
            tenant_id: tenantId,
            dataUrl,
            contentType,
          })
        },
        `platform-upload-tenant-banner-${tenantId}`
      );
    
    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(tenantId);

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to upload tenant banner:', error);
      throw error;
    }
  }

  /**
   * Update tenant name
   */
  async updateTenantName(tenantId: string, name: string): Promise<Tenant | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<Tenant>(
      `/api/tenants/${encodeURIComponent(tenantId)}`,
      { 
        method: 'PUT',
        body: JSON.stringify({ name })
      },
      `platform-update-tenant-name-${tenantId}`,
      this.cacheTTL,
      {
        context: AppContext.ADMIN,
        isolation: CacheIsolation.ADMIN
      }
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to update tenant name:', result.error);
      throw result.error;
    }

    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(tenantId);

    return result.data || null;
  }

  /**
   * Update tenant profile branding
   */
  async updateTenantProfileBranding(tenantId: string, brandingData: {
    business_name?: string;
    business_description?: string;
    logo_url?: string;
    banner_url?: string;
  }): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/tenant/profile`,
        { 
          method: 'PATCH',
          body: JSON.stringify({
            tenant_id: tenantId,
            ...brandingData
          })
        },
        `platform-update-tenant-profile-branding-${tenantId}`
      );

      // Invalidate tenant cache - use enhanced pattern matching
    await this.invalidateCachePattern(`platform-tenant-${tenantId}*`);
    await this.invalidateCachePattern(`platform-tenant-profile-${tenantId}*`);

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update tenant profile branding:', error);
      throw error;
    }
  }

  /**
   * Get tenant fulfillment settings
   */
  async getTenantFulfillmentSettings(tenantId: string): Promise<FulfillmentSettings | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<{success: boolean; settings: FulfillmentSettings}>(
      `/api/tenants/${tenantId}/fulfillment-settings`,
      {},
      `platform-tenant-fulfillment-settings-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get tenant fulfillment settings:', result.error);
      return null;
    }

    return result.data?.settings || null;
  }

  /**
   * Update tenant fulfillment settings
   */
  async updateTenantFulfillmentSettings(tenantId: string, settings: FulfillmentSettings): Promise<FulfillmentSettings | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<{success: boolean; settings: FulfillmentSettings}>(
      `/api/tenants/${tenantId}/fulfillment-settings`,
      { 
        method: 'PUT',
        body: JSON.stringify(settings)
      },
      `platform-update-tenant-fulfillment-settings-${tenantId}`
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to update tenant fulfillment settings:', result.error);
      throw result.error;
    }

    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(tenantId);
    await unifiedCapabilityService.invalidateTenantCapabilities(tenantId);

    return result.data?.settings || null;
  }

  /**
   * Get tenant commerce settings
   */
  async getTenantCommerceSettings(tenantId: string): Promise<any | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${encodeURIComponent(tenantId)}/commerce-settings`,
      {},
      `platform-tenant-commerce-settings-${tenantId}`,
      this.cacheTTL
    );

    return result.data?.settings || null;
  }

  /**
   * Update tenant commerce settings
   */
  async updateTenantCommerceSettings(tenantId: string, settings: any): Promise<any | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${encodeURIComponent(tenantId)}/commerce-settings`,
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      },
      `platform-tenant-commerce-settings-${tenantId}`,
      this.cacheTTL
    );

    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(tenantId);
    await unifiedCapabilityService.invalidateTenantCapabilities(tenantId);

    return result.data?.settings || null;
  }

  /**
   * Get tenant product options settings
   */
  async getTenantProductOptionsSettings(tenantId: string): Promise<any | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${encodeURIComponent(tenantId)}/product-options`,
      {},
      `platform-tenant-product-options-settings-${tenantId}`,
      this.cacheTTL
    );

    return result.data?.settings || null;
  }

  /**
   * Update tenant product options settings
   */
  async updateTenantProductOptionsSettings(tenantId: string, settings: any): Promise<any | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${encodeURIComponent(tenantId)}/product-options`,
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      },
      `platform-tenant-product-options-settings-${tenantId}`
    );

    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(tenantId);
    await unifiedCapabilityService.invalidateTenantCapabilities(tenantId);

    return result.data?.settings || null;
  }

  /**
   * Get tenant featured options settings
   */
  async getTenantFeaturedOptionsSettings(tenantId: string): Promise<any | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${encodeURIComponent(tenantId)}/featured-options`,
      {},
      `platform-tenant-featured-options-settings-${tenantId}`,
      this.cacheTTL
    );

    return result.data?.settings || null;
  }

  /**
   * Update tenant featured options settings
   */
  async updateTenantFeaturedOptionsSettings(tenantId: string, settings: any): Promise<any | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${encodeURIComponent(tenantId)}/featured-options`,
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      },
      `platform-tenant-featured-options-settings-${tenantId}`
    );

    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(tenantId);
    await unifiedCapabilityService.invalidateTenantCapabilities(tenantId);

    return result.data?.settings || null;
  }

  /**
   * Get tenant integration options settings
   */
  async getTenantIntegrationOptionsSettings(tenantId: string): Promise<any | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${encodeURIComponent(tenantId)}/integration-options`,
      {},
      `platform-tenant-integration-options-settings-${tenantId}`,
      this.cacheTTL
    );

    return result.data?.settings || null;
  }

  /**
   * Update tenant integration options settings
   */
  async updateTenantIntegrationOptionsSettings(tenantId: string, settings: any): Promise<any | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${encodeURIComponent(tenantId)}/integration-options`,
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      },
      `platform-tenant-integration-options-settings-${tenantId}`
    );

    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(tenantId);

    return result.data?.settings || null;
  }

  /**
   * Get tenant barcode scan settings
   */
  async getTenantBarcodeScanSettings(tenantId: string): Promise<any | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${encodeURIComponent(tenantId)}/barcode-scan`,
      {},
      `platform-tenant-barcode-scan-settings-${tenantId}`,
      this.cacheTTL
    );

    return result.data?.settings || null;
  }

  /**
   * Update tenant barcode scan settings
   */
  async updateTenantBarcodeScanSettings(tenantId: string, settings: any): Promise<any | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${encodeURIComponent(tenantId)}/barcode-scan`,
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      },
      `platform-tenant-barcode-scan-settings-${tenantId}`
    );

    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(tenantId);
    await unifiedCapabilityService.invalidateTenantCapabilities(tenantId);

    return result.data?.settings || null;
  }

  /**
   * Get tenant storefront type settings
   */
  async getTenantStorefrontTypeSettings(tenantId: string): Promise<any | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${encodeURIComponent(tenantId)}/storefront-type`,
      {},
      `platform-tenant-storefront-type-settings-${tenantId}`,
      this.cacheTTL
    );

    return result.data?.settings || null;
  }

  /**
   * Update tenant storefront type settings
   */
  async updateTenantStorefrontTypeSettings(tenantId: string, settings: any): Promise<any | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${encodeURIComponent(tenantId)}/storefront-type`,
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      },
      `platform-tenant-storefront-type-settings-${tenantId}`
    );

    await this.invalidateTenantCaches(tenantId);
    await unifiedCapabilityService.invalidateTenantCapabilities(tenantId);

    return result.data?.settings || null;
  }

  /**
   * Get tenant product type settings
   */
  async getTenantProductTypeSettings(tenantId: string): Promise<any | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${encodeURIComponent(tenantId)}/product-type`,
      {},
      `platform-tenant-product-type-settings-${tenantId}`,
      this.cacheTTL
    );

    return result.data?.settings || null;
  }

  /**
   * Update tenant product type settings
   */
  async updateTenantProductTypeSettings(tenantId: string, settings: any): Promise<any | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${encodeURIComponent(tenantId)}/product-type`,
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      },
      `platform-tenant-product-type-settings-${tenantId}`
    );

    await this.invalidateTenantCaches(tenantId);
    await unifiedCapabilityService.invalidateTenantCapabilities(tenantId);

    return result.data?.settings || null;
  }

  /**
   * Get consolidated dashboard data for tenant
   */
  async getDashboardConsolidated(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/dashboard/consolidated/${encodeURIComponent(tenantId)}`,
        {},
        `platform-dashboard-consolidated-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get dashboard consolidated data:', error);
      throw error;
    }
  }

  /**
   * Get Google feed jobs setup status
   */
  async getGoogleFeedJobsSetupStatus(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/feed-jobs/setup-status/${tenantId}`,
        {},
        `platform-google-feed-jobs-setup-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Google feed jobs setup status:', error);
      throw error;
    }
  }

  /**
   * Get Google Business Profile status
   */
  async getGoogleGBPStatus(tenantId: string): Promise<GoogleGBPStatus | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/status?tenantId=${tenantId}`,
        {},
        `platform-google-gbp-status-${tenantId}`,
        this.cacheTTL
      );

      return result?.data || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Google GBP status:', error);
      return null;
    }
  }

  /**
   * Get Google OAuth merchants
   */
  async getGoogleOAuthMerchants(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/oauth/merchants?tenantId=${tenantId}`,
        {},
        `platform-google-oauth-merchants-${tenantId}`,
        this.cacheTTL
      );
      

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Google OAuth merchants:', error);
      throw error;
    }
  }

  /**
   * Link Google merchant account
   */
  async linkGoogleMerchant(tenantId: string, merchantId: string, merchantName: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/oauth/link-merchant`,
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId, merchantId, merchantName })
        },
        `platform-google-link-merchant-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to link Google merchant:', error);
      throw error;
    }
  }

  /**
   * Disconnect Google OAuth
   */
  async disconnectGoogleOAuth(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/oauth/disconnect`,
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId })
        },
        `platform-google-oauth-disconnect-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to disconnect Google OAuth:', error);
      throw error;
    }
  }

  /**
   * Disconnect Google Business Profile
   */
  async disconnectGoogleGBP(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/disconnect`,
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId })
        },
        `platform-google-gbp-disconnect-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to disconnect Google GBP:', error);
      throw error;
    }
  }

  /**
   * Get Google Business media
   */
  async getGoogleBusinessMedia(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/media?tenantId=${tenantId}`,
        {},
        `platform-google-business-media-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Google Business media:', error);
      throw error;
    }
  }

  /**
   * Get Google Business posts
   */
  async getGoogleBusinessPosts(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/posts?tenantId=${tenantId}`,
        {},
        `platform-google-business-posts-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Google Business posts:', error);
      throw error;
    }
  }

  /**
   * Get Google Business reviews
   */
  async getGoogleBusinessReviews(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/reviews?tenantId=${tenantId}`,
        {},
        `platform-google-business-reviews-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Google Business reviews:', error);
      throw error;
    }
  }

  /**
   * Get Google Business attributes
   */
  async getGoogleBusinessAttributes(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/attributes?tenantId=${tenantId}`,
        {},
        `platform-google-business-attributes-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Google Business attributes:', error);
      throw error;
    }
  }

  /**
   * Upload Google Business media
   */
  async uploadGoogleBusinessMedia(tenantId: string, photoUrl: string, category: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/media`,
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId, photoUrl, category })
        },
        `platform-google-business-upload-media-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to upload Google Business media:', error);
      throw error;
    }
  }

  /**
   * Create Google Business post
   */
  async createGoogleBusinessPost(tenantId: string, summary: string, topicType: string = 'STANDARD'): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/posts`,
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId, summary, topicType })
        },
        `platform-google-business-create-post-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to create Google Business post:', error);
      throw error;
    }
  }

  /**
   * Reply to Google Business review
   */
  async replyGoogleBusinessReview(tenantId: string, reviewName: string, comment: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/reviews/${encodeURIComponent(reviewName)}/reply`,
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId, comment })
        },
        `platform-google-business-reply-review-${tenantId}-${reviewName}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to reply to Google Business review:', error);
      throw error;
    }
  }

  /**
   * Save Google Business common attributes
   */
  async saveGoogleBusinessCommonAttributes(tenantId: string, attributes: any): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/attributes/common`,
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId, ...attributes })
        },
        `platform-google-business-save-attributes-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to save Google Business attributes:', error);
      throw error;
    }
  }

  /**
   * Get Google Business linked location
   */
  async getGoogleBusinessLinkedLocation(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/linked-location?tenantId=${tenantId}`,
        {},
        `platform-google-business-linked-location-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Google Business linked location:', error);
      throw error;
    }
  }

  /**
   * Get Google Business locations
   */
  async getGoogleBusinessLocations(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/locations?tenantId=${tenantId}`,
        {},
        `platform-google-business-locations-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Google Business locations:', error);
      throw error;
    }
  }

  /**
   * Link Google Business location
   */
  async linkGoogleBusinessLocation(tenantId: string, locationId: string, locationName: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/link-location`,
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId, locationId, locationName })
        },
        `platform-google-business-link-location-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to link Google Business location:', error);
      throw error;
    }
  }

  /**
   * Sync Google Business data
   */
  async syncGoogleBusiness(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/sync`,
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId })
        },
        `platform-google-business-sync-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to sync Google Business:', error);
      throw error;
    }
  }

  /**
   * Get Google Business sync tracking
   */
  async getGoogleBusinessSyncTracking(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/sync-tracking?tenantId=${tenantId}`,
        {},
        `platform-google-business-sync-tracking-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Google Business sync tracking:', error);
      throw error;
    }
  }

  /**
   * Get Google Business comparison data
   */
  async getGoogleBusinessComparison(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/business/compare?tenantId=${tenantId}`,
        {},
        `platform-google-business-comparison-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Google Business comparison:', error);
      throw error;
    }
  }

  /**
   * Get Google Merchant Center sync status
   */
  async getGoogleMerchantSyncStatus(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/merchant/sync-status?tenantId=${tenantId}`,
        {},
        `platform-google-merchant-sync-status-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Google Merchant sync status:', error);
      throw error;
    }
  }

  /**
   * Update Google Merchant settings
   */
  async updateGoogleMerchantSettings(tenantId: string, settings: any): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/merchant/settings`,
        { 
          method: 'PATCH',
          body: JSON.stringify({ tenantId, ...settings })
        },
        `platform-google-merchant-settings-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update Google Merchant settings:', error);
      throw error;
    }
  }

  /**
   * Sync Google Merchant products
   */
  async syncGoogleMerchant(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/google/merchant/sync`,
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId })
        },
        `platform-google-merchant-sync-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to sync Google Merchant:', error);
      throw error;
    }
  }

  /**
   * Get per-product GMC sync status
   */
  async getGMCProductSyncStatus(
    tenantId: string,
    options?: { status?: string; search?: string; limit?: number; offset?: number }
  ): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const params = new URLSearchParams({ tenantId });
      if (options?.status && options.status !== 'all') params.set('status', options.status);
      if (options?.search) params.set('search', options.search);
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.offset) params.set('offset', String(options.offset));

      const result = await this.makeDefaultRequest<any>(
        `/api/google/merchant/product-sync-status?${params.toString()}`,
        {},
        `platform-gmc-product-sync-status-${tenantId}-${params.toString()}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get GMC product sync status:', error);
      throw error;
    }
  }

  /**
   * Get Square integration status
   */
  async getSquareStatus(tenantId: string): Promise<SquareStatus | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<SquareStatus>(
      `/api/integrations/${tenantId}/square/status`,
      {},
      `platform-square-status-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get Square status:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get Square OAuth authorization URL
   */
  async getSquareOAuthAuthorize(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/integrations/${tenantId}/square/oauth/authorize`,
      {},
      `platform-square-oauth-authorize-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get Square OAuth authorize:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Disconnect Square integration
   */
  async disconnectSquare(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/integrations/${tenantId}/square/disconnect`,
      { 
        method: 'POST',
        body: JSON.stringify({})
      },
      `platform-square-disconnect-${tenantId}`
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to disconnect Square:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Start Square sync
   */
  async startSquareSync(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/integrations/${tenantId}/square/sync`,
      { 
        method: 'POST',
        body: JSON.stringify({})
      },
      `platform-square-sync-${tenantId}`
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to start Square sync:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Get tenant data for onboarding
   */
  async getOnboardingTenantData(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const [tenant, profile] = await Promise.all([
      this.getTenant(tenantId),
      this.getTenantProfile(tenantId),
    ]);

    // Merge data with priority: profile > tenant.metadata > tenant.name
    const mergedData = {
      ...tenant,
      ...tenant?.metadata,
      business_name: profile?.business_name || tenant?.name || '',
      phone_number: normalizePhoneInput(profile?.phone_number || tenant?.metadata?.phone_number || ''),
      email: profile?.email || tenant?.metadata?.email || '',
      website: profile?.website || tenant?.metadata?.website || '',
      contact_person: profile?.contact_person || tenant?.metadata?.contact_person || '',
      ...profile,
    };

    return mergedData;
  }

  /**
   * Save onboarding business profile
   */
  async saveOnboardingProfile(tenantId: string, data: any): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      '/api/tenant/profile',
      { 
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          ...data,
        })
      },
      `platform-onboarding-save-profile-${tenantId}`
    );

    if (!result.success) {
      // Extract validation errors from the error details
      const error = result.error as any;
      if (error?.details?.fieldErrors) {
        const fieldErrors = error.details.fieldErrors;
        const fieldNames: Record<string, string> = {
          email: 'Email',
          phone_number: 'Phone number',
          business_name: 'Business name',
          address_line1: 'Address',
          city: 'City',
          state: 'State',
          postal_code: 'Postal code',
          country_code: 'Country',
          website: 'Website',
          contact_person: 'Contact person',
        };
        
        // Build a user-friendly error message
        const messages: string[] = [];
        for (const [field, errors] of Object.entries(fieldErrors)) {
          const fieldName = fieldNames[field] || field;
          const errorList = errors as string[];
          messages.push(`${fieldName}: ${errorList.join(', ')}`);
        }
        
        throw new Error(messages.join(' | ') || 'Please check your input');
      }
      
      throw new Error(error?.message || 'Failed to save business profile. Please try again.');
    }
    

    // Invalidate tenant complete cache for this tenant
    await this.invalidateTenantCaches(tenantId);
    
    // Invalidate directory listing cache since business profile data is embedded
    await this.invalidateCache(`directory-listing-${tenantId}`);
    
    return result.data;
  }

  /**
      };

      console.log('[PlatformHomeSingleton] Transformed result:', transformedResult);

      return transformedResult;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get complete tenant data:', error);
      throw error;
    }
  }

  /**
   * Get complete categories data for tenant
   */
  async getCategoriesComplete(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/v1/tenants/${encodeURIComponent(tenantId)}/categories/complete`,
        {},
        `platform-categories-complete-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get complete categories data:', error);
      throw error;
    }
  }

  /**
   * Get tenant tier
   */
  async getTenantTier(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/tier`,
      {},
      `platform-tenant-tier-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get tenant tier:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Get Sentry configuration
   */
  async getSentryConfig(): Promise<SentryConfig | null> {
    const result = await this.makeDefaultRequest<SentryConfig>(
      '/api/admin/sentry/config',
      {},
      'platform-sentry-config',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get Sentry config:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get upgrade requests for tenant
   */
  async getUpgradeRequests(tenantId: string, status?: string): Promise<UpgradeRequest[] | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const statusParam = status ? `&status=${status}` : '';
    const result = await this.makeDefaultRequest<UpgradeRequestsResponse>(
      `/api/upgrade-requests?tenantId=${tenantId}${statusParam}`,
      {},
      `platform-upgrade-requests-${tenantId}-${status || 'all'}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to get upgrade requests:', result.error);
      return null;
    }

    return result.data?.data || null;
  }

  /**
   * Create upgrade request
   */
  async createUpgradeRequest(requestData: {
    tenantId: string;
    business_name?: string;
    currentTier: string;
    requestedTier: string;
    notes?: string;
  }): Promise<UpgradeRequest | null> {
    const result = await this.makeDefaultRequest<UpgradeRequest>(
      '/api/upgrade-requests',
      { 
        method: 'POST',
        body: JSON.stringify(requestData)
      },
      `platform-create-upgrade-request-${requestData.tenantId}`
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to create upgrade request:', result.error);
      throw result.error;
    }

    // Invalidate upgrade requests cache - use enhanced pattern matching
    await this.invalidateCachePattern(`platform-upgrade-requests-${requestData.tenantId}*`);

    return result.data || null;
  }

  /**
   * Assign tenant to organization
   */
  async assignTenantToOrganization(organizationId: string, tenantId: string): Promise<void> {
    try {
      if (!organizationId || !tenantId) {
        throw new Error('Organization ID and Tenant ID are required');
      }

      await this.makeDefaultRequest<void>(
        `/api/organizations/${organizationId}/tenants`,
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId })
        },
        `org-assign-${organizationId}-${tenantId}`
      );
      
      // Invalidate tenant complete cache for this tenant
      await this.invalidateTenantCaches(tenantId);
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to assign tenant to organization:', error);
      throw error;
    }
  }

  /**
   * Remove tenant from organization
   */
  async removeTenantFromOrganization(organizationId: string, tenantId: string): Promise<void> {
    try {
      if (!organizationId || !tenantId) {
        throw new Error('Organization ID and Tenant ID are required');
      }

      await this.makeDefaultRequest<void>(
        `/api/organizations/${organizationId}/tenants/${tenantId}`,
        { method: 'DELETE' },
        `org-remove-${organizationId}-${tenantId}`
      );

      // Invalidate tenant complete cache for this tenant
      await this.invalidateTenantCaches(tenantId);

    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to remove tenant from organization:', error);
      throw error;
    }
  }

  /**
   * Create organization request
   */
  async createOrganizationRequest(requestData: {
    tenantId: string;
    organizationId: string;
    requestedBy: string;
    notes?: string;
    requestType?: string;
  }): Promise<PendingRequest | null> {
    const result = await this.makeDefaultRequest<PendingRequest>(
      '/api/organization-requests',
      { 
        method: 'POST',
        body: JSON.stringify(requestData)
      },
      `platform-create-org-request-${requestData.tenantId}`
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to create organization request:', result.error);
      throw result.error;
    }

    // Invalidate pending request cache - use enhanced pattern matching
    await this.invalidateCachePattern(`platform-pending-request-${requestData.tenantId}*`);

    return result.data || null;
  }

  /**
   * Delete pending request
   */
  async deletePendingRequest(requestId: string): Promise<void> {
    try {
      if (!requestId) {
        throw new Error('Request ID is required');
      }

      await this.makeDefaultRequest<void>(
        `/api/organization-requests/${requestId}`,
        { method: 'DELETE' },
        `platform-delete-pending-request-${requestId}`
      );

      // Invalidate pending request cache - use enhanced pattern matching
      await this.invalidateCachePattern(`platform-pending-request-*`);
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to delete pending request:', error);
      throw error;
    }
  }

  /**
   * Update pending request
   */
  async updatePendingRequest(requestId: string, updates: Partial<PendingRequest>): Promise<PendingRequest | null> {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    const result = await this.makeDefaultRequest<PendingRequest>(
      `/api/organization-requests/${requestId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates)
      },
      `platform-pending-request-${requestId}`
    );

    if (!result.success) {
      console.error('[PlatformHomeSingleton] Failed to update pending request:', result.error);
      throw result.error;
    }

    // Invalidate pending request cache - use enhanced pattern matching
    await this.invalidateCachePattern(`platform-pending-request-*`);

    return result.data || null;
  }

}

// Export singleton instance
export const platformHomeService = PlatformHomeSingletonService.getInstance();
