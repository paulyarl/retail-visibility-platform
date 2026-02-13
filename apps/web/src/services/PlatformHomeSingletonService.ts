/**
 * Platform Home Page Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached platform home page operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';
import { platformDashboardService } from './PlatformDashboardSingletonService';

export interface Tenant {
  id: string;
  name: string;
  logoUrl?: string;
  bannerUrl?: string;
  subscriptionTier?: string;
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

export interface BusinessProfile {
  businessName?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  website?: string;
  email?: string;
  description?: string;
  logoUrl?: string;
  hours?: {
    monday?: { open: string; close: string; };
    tuesday?: { open: string; close: string; };
    wednesday?: { open: string; close: string; };
    thursday?: { open: string; close: string; };
    friday?: { open: string; close: string; };
    saturday?: { open: string; close: string; };
    sunday?: { userPreference: string; };
  };
  addressLine1?: string;
  addressLine2?: string;
  countryCode?: string;
  contactPerson?: string;
  socialLinks?: Record<string, any>;
  seoTags?: Record<string, any>;
  latitude?: number;
  longitude?: number;
  displayMap?: boolean;
  mapPrivacyMode?: string;
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
  tier?: string;
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
export class PlatformHomeSingletonService extends AuthenticatedApiSingleton {
  private static instance: PlatformHomeSingletonService;
  protected readonly cacheTTL = 10 * 60 * 1000; // 10 minutes

  /**
   * Get singleton instance
   */
  static getInstance(): PlatformHomeSingletonService {
    if (!PlatformHomeSingletonService.instance) {
      PlatformHomeSingletonService.instance = new PlatformHomeSingletonService('platform-home');
    }
    return PlatformHomeSingletonService.instance;
  }

  /**
   * Get all tenants for the current user
   */
  async getTenants(): Promise<Tenant[] | null> {
    try {
      const result = await this.makeAuthenticatedRequest<Tenant[]>(
        '/api/tenants',
        {},
        'platform-tenants',
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get tenants:', error);
      return null;
    }
  }

  /**
   * Get all organizations
   */
  async getOrganizations(): Promise<Organization[] | null> {
    try {
      const result = await this.makeAuthenticatedRequest<Organization[]>(
        '/api/organizations',
        {},
        'platform-organizations',
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get organizations:', error);
      return null;
    }
  }

  /**
   * Get pending upgrade request for tenant
   */
  async getPendingUpgradeRequest(tenantId: string): Promise<PendingRequest | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<PendingRequest>(
        `/api/organization-requests?tenantId=${tenantId}&status=pending`,
        {},
        `platform-pending-request-${tenantId}`,
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get pending upgrade request:', error);
      return null;
    }
  }

  /**
   * Get tenant details
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<Tenant>(
        `/api/tenants/${tenantId}`,
        {},
        `platform-tenant-${tenantId}`,
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get tenant details:', error);
      return null;
    }
  }

  /**
   * Get tenant profile
   */
  async getTenantProfile(tenantId: string): Promise<BusinessProfile | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<BusinessProfile>(
        `/api/tenant/profile?tenant_id=${encodeURIComponent(tenantId)}`,
        {},
        `platform-tenant-profile-${tenantId}`,
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get tenant profile:', error);
      return null;
    }
  }

  /**
   * Update tenant profile
   */
  async updateTenantProfile(tenantId: string, profileData: Partial<BusinessProfile>): Promise<BusinessProfile | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<BusinessProfile>(
        '/api/tenant/profile',
        { 
          method: 'PATCH',
          body: JSON.stringify({ tenant_id: tenantId, ...profileData })
        },
        `platform-tenant-profile-${tenantId}`
      );

      // Invalidate tenant complete cache for this tenant
      await this.invalidateCache(`platform-tenant-complete-${tenantId}`);
      
      // Invalidate tenant profile cache
      await this.invalidateCache(`platform-tenant-profile-${tenantId}*`);

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update tenant profile:', error);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences | null> {
    try {
      const result = await this.makeAuthenticatedRequest<UserPreferences>(
        '/api/user/preferences',
        { 
          method: 'PATCH',
          body: JSON.stringify(preferences)
        },
        'platform-user-preferences'
      );

      // Invalidate user preferences cache
      await this.invalidateCache('platform-user-preferences*');

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update user preferences:', error);
      throw error;
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(): Promise<UserPreferences | null> {
    try {
      const result = await this.makeAuthenticatedRequest<UserPreferences>(
        '/api/user/preferences',
        {},
        'platform-user-preferences',
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get user preferences:', error);
      return null;
    }
  }

  /**
   * Get scan session
   */
  async getScanSession(sessionId: string): Promise<ScanSession | null> {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      const result = await this.makeAuthenticatedRequest<ScanSession>(
        `/api/scan-sessions/${sessionId}`,
        {},
        `platform-scan-session-${sessionId}`,
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get scan session:', error);
      return null;
    }
  }

  /**
   * Lookup barcode in scan session
   */
  async lookupBarcode(sessionId: string, barcode: string): Promise<any> {
    try {
      if (!sessionId || !barcode) {
        throw new Error('Session ID and barcode are required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/scan/${sessionId}/lookup-barcode`,
        { 
          method: 'POST',
          body: JSON.stringify({ barcode })
        },
        `platform-scan-lookup-${sessionId}-${barcode}`
      );

      // Invalidate scan session cache
      await this.invalidateCache(`platform-scan-session-${sessionId}*`);

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to lookup barcode:', error);
      throw error;
    }
  }

  /**
   * Delete scan result
   */
  async deleteScanResult(sessionId: string, resultId: string): Promise<void> {
    try {
      if (!sessionId || !resultId) {
        throw new Error('Session ID and result ID are required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/scan/${sessionId}/results/${resultId}`,
        { method: 'DELETE' },
        `platform-scan-delete-${sessionId}-${resultId}`
      );

      // Invalidate scan session cache
      await this.invalidateCache(`platform-scan-session-${sessionId}*`);
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to delete scan result:', error);
      throw error;
    }
  }

  /**
   * Commit scan session
   */
  async commitScanSession(sessionId: string): Promise<any> {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/scan/${sessionId}/commit`,
        { 
          method: 'POST',
          body: JSON.stringify({ skipValidation: false })
        },
        `platform-scan-commit-${sessionId}`
      );

      // Invalidate scan session cache
      await this.invalidateCache(`platform-scan-session-${sessionId}*`);

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to commit scan session:', error);
      throw error;
    }
  }

  /**
   * Delete scan session
   */
  async deleteScanSession(sessionId: string): Promise<void> {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/scan/${sessionId}`,
        { method: 'DELETE' },
        `platform-scan-delete-${sessionId}`
      );

      // Invalidate scan session cache
      await this.invalidateCache(`platform-scan-session-${sessionId}*`);
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to delete scan session:', error);
      throw error;
    }
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
    try {
      const result = await this.makeAuthenticatedRequest<Tenant>(
        '/api/tenants',
        { 
          method: 'POST',
          body: JSON.stringify(tenantData)
        },
        'platform-create-tenant'
      );

      // Invalidate tenant complete cache for this tenant
      await this.invalidateCache(`platform-tenant-complete-${result?.id}`);
      
      // Invalidate tenants cache
      await this.invalidateCache('platform-tenants*');
      
      // Invalidate platform dashboard cache since tenants affect stats
      await platformDashboardService.invalidateCache('platform-dashboard-complete');

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to create tenant:', error);
      throw error;
    }
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<Tenant>(
        `/api/tenants/${tenantId}`,
        { 
          method: 'PUT',
          body: JSON.stringify(updates)
        },
        `platform-tenant-${tenantId}`
      );

      // Invalidate tenant complete cache for this tenant
      await this.invalidateCache(`platform-tenant-complete-${tenantId}`);
      
      // Invalidate tenant cache
      await this.invalidateCache(`platform-tenant-${tenantId}*`);
      await this.invalidateCache('platform-tenants*');
      
      // Invalidate platform dashboard cache since tenants affect stats
      await platformDashboardService.invalidateCache('platform-dashboard-complete');

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update tenant:', error);
      throw error;
    }
  }

  /**
   * Delete tenant
   */
  async deleteTenant(tenantId: string): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/tenants/${tenantId}`,
        { method: 'DELETE' },
        `platform-delete-tenant-${tenantId}`
      );

      // Invalidate tenant complete cache for this tenant
      await this.invalidateCache(`platform-tenant-complete-${tenantId}`);
      
      // Invalidate tenants cache
      await this.invalidateCache('platform-tenants*');
      
      // Invalidate platform dashboard cache since tenants affect stats
      await platformDashboardService.invalidateCache('platform-dashboard-complete');
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to delete tenant:', error);
      throw error;
    }
  }

  /**
   * Get tenant users
   */
  async getTenantUsers(tenantId: string): Promise<TenantUser[] | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<TenantUser[]>(
        `/api/tenants/${tenantId}/users`,
        {},
        `platform-tenant-users-${tenantId}`,
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get tenant users:', error);
      return null;
    }
  }

  /**
   * Add user to tenant
   */
  async addTenantUser(tenantId: string, userData: {
    email: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  }): Promise<TenantUser | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<TenantUser>(
        `/api/tenants/${tenantId}/users`,
        { 
          method: 'POST',
          body: JSON.stringify(userData)
        },
        `platform-add-tenant-user-${tenantId}`
      );

      // Invalidate tenant users cache
      await this.invalidateCache(`platform-tenant-users-${tenantId}*`);

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to add tenant user:', error);
      throw error;
    }
  }

  /**
   * Update tenant user role
   */
  async updateTenantUserRole(tenantId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'): Promise<TenantUser | null> {
    try {
      if (!tenantId || !userId) {
        throw new Error('Tenant ID and User ID are required');
      }

      const result = await this.makeAuthenticatedRequest<TenantUser>(
        `/api/tenants/${tenantId}/users/${userId}`,
        { 
          method: 'PUT',
          body: JSON.stringify({ role })
        },
        `platform-update-tenant-user-${tenantId}-${userId}`
      );

      // Invalidate tenant users cache
      await this.invalidateCache(`platform-tenant-users-${tenantId}*`);

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update tenant user role:', error);
      throw error;
    }
  }

  /**
   * Remove user from tenant
   */
  async removeTenantUser(tenantId: string, userId: string): Promise<void> {
    try {
      if (!tenantId || !userId) {
        throw new Error('Tenant ID and User ID are required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/tenants/${tenantId}/users/${userId}`,
        { method: 'DELETE' },
        `platform-remove-tenant-user-${tenantId}-${userId}`
      );

      // Invalidate tenant users cache
      await this.invalidateCache(`platform-tenant-users-${tenantId}*`);
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to remove tenant user:', error);
      throw error;
    }
  }

  /**
   * Get all admin users
   */
  async getAdminUsers(): Promise<AdminUser[] | null> {
    try {
      const result = await this.makeAuthenticatedRequest<{ users: AdminUser[] }>(
        '/api/admin/users',
        {},
        'platform-admin-users',
        this.cacheTTL
      );

      return result?.users || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get admin users:', error);
      return null;
    }
  }

  /**
   * Delete admin user
   */
  async deleteAdminUser(userId: string): Promise<void> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/admin/users/${userId}`,
        { method: 'DELETE' },
        `platform-delete-admin-user-${userId}`
      );

      // Invalidate admin users cache
      await this.invalidateCache('platform-admin-users*');
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to delete admin user:', error);
      throw error;
    }
  }

  /**
   * Get admin tier system tiers
   */
  async getAdminTiers(): Promise<DbTier[] | null> {
    try {
      const result = await this.makeAuthenticatedRequest<{ tiers: DbTier[] }>(
        '/api/admin/tier-system/tiers',
        {},
        'platform-admin-tiers',
        this.cacheTTL
      );

      return result?.tiers || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get admin tiers:', error);
      return null;
    }
  }

  /**
   * Get admin tier tenants
   */
  async getAdminTierTenants(): Promise<Tenant[] | null> {
    try {
      const result = await this.makeAuthenticatedRequest<Tenant[]>(
        '/api/admin/tiers/tenants',
        {},
        'platform-admin-tier-tenants',
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get admin tier tenants:', error);
      return null;
    }
  }

  /**
   * Update tenant tier and status
   */
  async updateTenantTier(tenantId: string, updates: {
    subscriptionTier: string;
    subscriptionStatus: string;
    reason?: string;
  }): Promise<Tenant | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<Tenant>(
        `/api/admin/tiers/tenants/${tenantId}`,
        { 
          method: 'PATCH',
          body: JSON.stringify(updates)
        },
        `platform-update-tenant-tier-${tenantId}`
      );

      // Invalidate tenant complete cache for this tenant
      await this.invalidateCache(`platform-tenant-complete-${tenantId}`);
      
      // Invalidate relevant caches
      await this.invalidateCache('platform-admin-tier-tenants*');
      await this.invalidateCache('platform-tenants*');
      await this.invalidateCache(`platform-tenant-${tenantId}*`);

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update tenant tier:', error);
      throw error;
    }
  }

  /**
   * Get featuring stats
   */
  async getFeaturingStats(): Promise<FeaturingStats | null> {
    try {
      const result = await this.makeAuthenticatedRequest<FeaturingStats>(
        '/api/admin/products/featuring/stats',
        {},
        'platform-featuring-stats',
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get featuring stats:', error);
      return null;
    }
  }

  /**
   * Get featured products
   */
  async getFeaturedProducts(limit: number, offset: number): Promise<FeaturedProduct[] | null> {
    try {
      const result = await this.makeAuthenticatedRequest<FeaturedProduct[]>(
        `/api/admin/products/featured?limit=${limit}&offset=${offset}`,
        {},
        'platform-featured-products',
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get featured products:', error);
      return null;
    }
  }

  /**
   * Unfeature product
   */
  async unfeatureProduct(tenantId: string, productId: string): Promise<void> {
    try {
      if (!tenantId || !productId) {
        throw new Error('Tenant ID and Product ID are required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/tenants/${tenantId}/products/${productId}/feature`,
        { method: 'DELETE' },
        `platform-unfeature-product-${tenantId}-${productId}`
      );

      // Invalidate featured products cache
      await this.invalidateCache('platform-featured-products*');
      await this.invalidateCache('platform-featuring-stats*');
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to unfeature product:', error);
      throw error;
    }
  }

  /**
   * Update product priority
   */
  async updateProductPriority(tenantId: string, productId: string, priority: number): Promise<void> {
    try {
      if (!tenantId || !productId) {
        throw new Error('Tenant ID and Product ID are required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/tenants/${tenantId}/products/${productId}/feature/priority`,
        { 
          method: 'PATCH',
          body: JSON.stringify({ priority })
        },
        `platform-update-product-priority-${tenantId}-${productId}`
      );

      // Invalidate featured products cache
      await this.invalidateCache('platform-featured-products*');
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update product priority:', error);
      throw error;
    }
  }

  /**
   * Get platform categories
   */
  async getPlatformCategories(): Promise<PlatformCategory[] | null> {
    try {
      const result = await this.makeAuthenticatedRequest<{ data: { categories: PlatformCategory[] } }>(
        '/api/admin/platform-categories',
        {},
        'platform-platform-categories',
        this.cacheTTL
      );

      return result?.data.categories || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get platform categories:', error);
      return null;
    }
  }

  /**
   * Create platform category
   */
  async createPlatformCategory(categoryData: Partial<PlatformCategory>): Promise<PlatformCategory | null> {
    try {
      const result = await this.makeAuthenticatedRequest<PlatformCategory>(
        '/api/admin/platform-categories',
        { 
          method: 'POST',
          body: JSON.stringify(categoryData)
        },
        'platform-create-platform-category'
      );

      // Invalidate platform categories cache
      await this.invalidateCache('platform-platform-categories*');

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to create platform category:', error);
      throw error;
    }
  }

  /**
   * Update platform category
   */
  async updatePlatformCategory(categoryId: string, categoryData: Partial<PlatformCategory>): Promise<PlatformCategory | null> {
    try {
      if (!categoryId) {
        throw new Error('Category ID is required');
      }

      const result = await this.makeAuthenticatedRequest<PlatformCategory>(
        `/api/admin/platform-categories/${categoryId}`,
        { 
          method: 'PATCH',
          body: JSON.stringify(categoryData)
        },
        `platform-update-platform-category-${categoryId}`
      );

      // Invalidate platform categories cache
      await this.invalidateCache('platform-platform-categories*');

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update platform category:', error);
      throw error;
    }
  }

  /**
   * Delete platform category
   */
  async deletePlatformCategory(categoryId: string): Promise<void> {
    try {
      if (!categoryId) {
        throw new Error('Category ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/admin/platform-categories/${categoryId}`,
        { method: 'DELETE' },
        `platform-delete-platform-category-${categoryId}`
      );

      // Invalidate platform categories cache
      await this.invalidateCache('platform-platform-categories*');
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to delete platform category:', error);
      throw error;
    }
  }

  /**
   * Reorder platform categories
   */
  async reorderPlatformCategories(categoryIds: string[]): Promise<void> {
    try {
      await this.makeAuthenticatedRequest<void>(
        '/api/admin/platform-categories/reorder',
        { 
          method: 'POST',
          body: JSON.stringify({ categoryIds })
        },
        'platform-reorder-platform-categories'
      );

      // Invalidate platform categories cache
      await this.invalidateCache('platform-platform-categories*');
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to reorder platform categories:', error);
      throw error;
    }
  }

  /**
   * Bulk import platform categories
   */
  async bulkImportPlatformCategories(source: string): Promise<any> {
    try {
      const result = await this.makeAuthenticatedRequest<any>(
        '/api/platform/categories/bulk-import',
        { 
          method: 'POST',
          body: JSON.stringify({ source })
        },
        'platform-bulk-import-categories'
      );

      // Invalidate platform categories cache
      await this.invalidateCache('platform-platform-categories*');

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to bulk import platform categories:', error);
      throw error;
    }
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
      const result = await this.makeAuthenticatedRequest<any>(
        '/api/platform/categories',
        { 
          method: 'POST',
          body: JSON.stringify(categoryData)
        },
        'platform-create-category-from-google'
      );

      // Invalidate platform categories cache
      await this.invalidateCache('platform-platform-categories*');

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to create platform category from Google:', error);
      throw error;
    }
  }

  /**
   * Get tier system tiers
   */
  async getTierSystemTiers(): Promise<Tier[] | null> {
    try {
      const result = await this.makeAuthenticatedRequest<Tier[]>(
        '/api/admin/tier-system/tiers',
        {},
        'platform-tier-system-tiers',
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get tier system tiers:', error);
      return null;
    }
  }

  /**
   * Update tier active status
   */
  async updateTierStatus(tierId: string, isActive: boolean): Promise<Tier | null> {
    try {
      if (!tierId) {
        throw new Error('Tier ID is required');
      }

      const result = await this.makeAuthenticatedRequest<Tier>(
        `/api/admin/tier-system/tiers/${tierId}`,
        { 
          method: 'PATCH',
          body: JSON.stringify({ isActive })
        },
        `platform-update-tier-status-${tierId}`
      );

      // Invalidate tier system cache
      await this.invalidateCache('platform-tier-system-tiers*');

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update tier status:', error);
      throw error;
    }
  }

  /**
   * Update tier
   */
  async updateTier(tierId: string, tierData: Partial<Tier>): Promise<Tier | null> {
    try {
      if (!tierId) {
        throw new Error('Tier ID is required');
      }

      const result = await this.makeAuthenticatedRequest<Tier>(
        `/api/admin/tier-system/tiers/${tierId}`,
        { 
          method: 'PUT',
          body: JSON.stringify(tierData)
        },
        `platform-update-tier-${tierId}`
      );

      // Invalidate tier system cache
      await this.invalidateCache('platform-tier-system-tiers*');

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update tier:', error);
      throw error;
    }
  }

  /**
   * Update tier sort order
   */
  async updateTierSortOrder(tierId: string, sortOrder: number): Promise<void> {
    try {
      if (!tierId) {
        throw new Error('Tier ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/admin/tier-system/tiers/${tierId}/sort-order`,
        { 
          method: 'PATCH',
          body: JSON.stringify({ sortOrder })
        },
        `platform-update-tier-sort-order-${tierId}`
      );

      // Invalidate tier system cache
      await this.invalidateCache('platform-tier-system-tiers*');
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update tier sort order:', error);
      throw error;
    }
  }

  /**
   * Create tier
   */
  async createTier(tierData: Omit<Tier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tier | null> {
    try {
      const result = await this.makeAuthenticatedRequest<Tier>(
        '/api/admin/tier-system/tiers',
        { 
          method: 'POST',
          body: JSON.stringify({
            ...tierData,
            id: `tier_${tierData.tierKey}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        },
        'platform-create-tier'
      );

      // Invalidate tier system cache
      await this.invalidateCache('platform-tier-system-tiers*');

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to create tier:', error);
      throw error;
    }
  }

  /**
   * Delete tier
   */
  async deleteTier(tierId: string): Promise<void> {
    try {
      if (!tierId) {
        throw new Error('Tier ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/admin/tier-system/tiers/${tierId}`,
        { method: 'DELETE' },
        `platform-delete-tier-${tierId}`
      );

      // Invalidate tier system cache
      await this.invalidateCache('platform-tier-system-tiers*');
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to delete tier:', error);
      throw error;
    }
  }

  /**
   * Get admin directory stats
   */
  async getAdminDirectoryStats(): Promise<DirectoryStats | null> {
    try {
      const result = await this.makeAuthenticatedRequest<DirectoryStats>(
        '/api/admin/directory/stats',
        {},
        'platform-admin-directory-stats',
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get admin directory stats:', error);
      return null;
    }
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
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.tier) params.append('tier', filters.tier);
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());

      const result = await this.makeAuthenticatedRequest<{
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
        'platform-admin-directory-listings',
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get admin directory listings:', error);
      return null;
    }
  }

  /**
   * Feature directory listing
   */
  async featureDirectoryListing(tenantId: string, until: Date, priority?: number): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/admin/directory/feature/${tenantId}`,
        { 
          method: 'POST',
          body: JSON.stringify({ 
            until: until.toISOString(),
            priority: priority || 0
          })
        },
        `platform-feature-directory-listing-${tenantId}`
      );

      // Invalidate directory listings cache
      await this.invalidateCache('platform-admin-directory-listings*');
      await this.invalidateCache('platform-admin-directory-stats*');
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

      await this.makeAuthenticatedRequest<void>(
        `/api/admin/directory/unfeature/${tenantId}`,
        { method: 'DELETE' },
        `platform-unfeature-directory-listing-${tenantId}`
      );

      // Invalidate directory listings cache
      await this.invalidateCache('platform-admin-directory-listings*');
      await this.invalidateCache('platform-admin-directory-stats*');
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to unfeature directory listing:', error);
      throw error;
    }
  }

  /**
   * Get admin enrichment analytics
   */
  async getAdminEnrichmentAnalytics(): Promise<Analytics | null> {
    try {
      const result = await this.makeAuthenticatedRequest<Analytics>(
        `/api/admin/enrichment/analytics?_t=${Date.now()}`,
        {},
        'platform-admin-enrichment-analytics',
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get admin enrichment analytics:', error);
      return null;
    }
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

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/admin/enrichment/search?${searchParams}`,
        {},
        'platform-admin-enrichment-search',
        this.cacheTTL
      );

      return result;
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

      const result = await this.makeAuthenticatedRequest<any>(
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
    try {
      const result = await this.makeAuthenticatedRequest<{ data: SubdomainStats }>(
        '/api/analytics/subdomain-stats',
        {},
        'platform-admin-subdomain-stats',
        this.cacheTTL
      );

      return result?.data || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get admin subdomain stats:', error);
      return null;
    }
  }

  /**
   * Get tenant logo
   */
  async getTenantLogo(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/public/tenant/${encodeURIComponent(tenantId)}/logo`,
        {},
        `platform-tenant-logo-${tenantId}`,
        this.cacheTTL
      );

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

      const result = await this.makeAuthenticatedRequest<any>(
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

      // Invalidate tenant cache
      await this.invalidateCache(`platform-tenant-${tenantId}*`);
      await this.invalidateCache(`platform-tenant-logo-${tenantId}*`);

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

      const result = await this.makeAuthenticatedRequest<any>(
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

      // Invalidate tenant cache
      await this.invalidateCache(`platform-tenant-${tenantId}*`);

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
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<Tenant>(
        `/api/tenants/${encodeURIComponent(tenantId)}`,
        { 
          method: 'PUT',
          body: JSON.stringify({ name })
        },
        `platform-update-tenant-name-${tenantId}`
      );

      // Invalidate tenant cache
      await this.invalidateCache(`platform-tenant-${tenantId}*`);

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update tenant name:', error);
      throw error;
    }
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      // Invalidate tenant cache
      await this.invalidateCache(`platform-tenant-${tenantId}*`);
      await this.invalidateCache(`platform-tenant-profile-${tenantId}*`);

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
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<FulfillmentSettings>(
        `/api/tenants/${tenantId}/fulfillment-settings`,
        {},
        `platform-tenant-fulfillment-settings-${tenantId}`,
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get tenant fulfillment settings:', error);
      return null;
    }
  }

  /**
   * Update tenant fulfillment settings
   */
  async updateTenantFulfillmentSettings(tenantId: string, settings: FulfillmentSettings): Promise<FulfillmentSettings | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<FulfillmentSettings>(
        `/api/tenants/${tenantId}/fulfillment-settings`,
        { 
          method: 'PUT',
          body: JSON.stringify(settings)
        },
        `platform-update-tenant-fulfillment-settings-${tenantId}`
      );

      // Invalidate fulfillment settings cache
      await this.invalidateCache(`platform-tenant-fulfillment-settings-${tenantId}*`);

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update tenant fulfillment settings:', error);
      throw error;
    }
  }

  /**
   * Get Clover integration status
   */
  async getCloverStatus(tenantId: string): Promise<CloverStatus | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<CloverStatus>(
        `/api/integrations/${tenantId}/clover/status`,
        {},
        `platform-clover-status-${tenantId}`,
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Clover status:', error);
      return null;
    }
  }

  /**
   * Enable Clover demo mode
   */
  async enableCloverDemo(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/integrations/${tenantId}/clover/demo/enable`,
        { method: 'POST' },
        `platform-clover-demo-enable-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to enable Clover demo:', error);
      throw error;
    }
  }

  /**
   * Disable Clover demo mode
   */
  async disableCloverDemo(tenantId: string, keepItems: boolean = true): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/integrations/${tenantId}/clover/demo/disable`,
        { 
          method: 'POST',
          body: JSON.stringify({ keepItems })
        },
        `platform-clover-demo-disable-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to disable Clover demo:', error);
      throw error;
    }
  }

  /**
   * Get Clover OAuth authorization URL
   */
  async getCloverOAuthUrl(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/integrations/${tenantId}/clover/oauth/authorize`,
        { method: 'GET' },
        `platform-clover-oauth-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Clover OAuth URL:', error);
      throw error;
    }
  }

  /**
   * Start Clover sync
   */
  async startCloverSync(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/integrations/${tenantId}/clover/sync`,
        { method: 'POST' },
        `platform-clover-sync-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to start Clover sync:', error);
      throw error;
    }
  }

  /**
   * Disconnect Clover integration
   */
  async disconnectClover(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/integrations/${tenantId}/clover/disconnect`,
        { method: 'POST' },
        `platform-clover-disconnect-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to disconnect Clover:', error);
      throw error;
    }
  }

  /**
   * Get Clover demo scenarios
   */
  async getCloverDemoScenarios(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/integrations/${tenantId}/clover/demo/scenarios`,
        {},
        `platform-clover-demo-scenarios-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Clover demo scenarios:', error);
      throw error;
    }
  }

  /**
   * Get Clover mappings
   */
  async getCloverMappings(tenantId: string, isDemo: boolean = false): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const endpoint = isDemo 
        ? `/api/integrations/${tenantId}/clover/demo/mappings`
        : `/api/integrations/${tenantId}/clover/mappings`;

      const result = await this.makeAuthenticatedRequest<any>(
        endpoint,
        {},
        `platform-clover-mappings-${tenantId}-${isDemo ? 'demo' : 'prod'}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Clover mappings:', error);
      throw error;
    }
  }

  /**
   * Get Clover sync history
   */
  async getCloverSyncHistory(tenantId: string, isDemo: boolean = false): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const endpoint = isDemo 
        ? `/api/integrations/${tenantId}/clover/demo/sync-history`
        : `/api/integrations/${tenantId}/clover/sync-history`;

      const result = await this.makeAuthenticatedRequest<any>(
        endpoint,
        {},
        `platform-clover-sync-history-${tenantId}-${isDemo ? 'demo' : 'prod'}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Clover sync history:', error);
      throw error;
    }
  }

  /**
   * Get Clover category mappings
   */
  async getCloverCategoryMappings(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/integrations/${tenantId}/clover/category-mappings`,
        {},
        `platform-clover-category-mappings-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Clover category mappings:', error);
      throw error;
    }
  }

  /**
   * Start Clover simulation
   */
  async startCloverSimulation(tenantId: string, scenario: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/integrations/${tenantId}/clover/demo/simulate`,
        { 
          method: 'POST',
          body: JSON.stringify({ scenario })
        },
        `platform-clover-simulation-start-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to start Clover simulation:', error);
      throw error;
    }
  }

  /**
   * Execute Clover simulation
   */
  async executeCloverSimulation(tenantId: string, simulationId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/integrations/${tenantId}/clover/demo/simulate/${simulationId}/execute`,
        { method: 'POST' },
        `platform-clover-simulation-execute-${tenantId}-${simulationId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to execute Clover simulation:', error);
      throw error;
    }
  }

  /**
   * Cancel Clover simulation
   */
  async cancelCloverSimulation(tenantId: string, simulationId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/integrations/${tenantId}/clover/demo/simulate/${simulationId}/cancel`,
        { method: 'POST' },
        `platform-clover-simulation-cancel-${tenantId}-${simulationId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to cancel Clover simulation:', error);
      throw error;
    }
  }

  /**
   * Resolve Clover mapping conflict
   */
  async resolveCloverMappingConflict(tenantId: string, mappingId: string, resolution: any, isDemo: boolean = false): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const endpoint = isDemo 
        ? `/api/integrations/${tenantId}/clover/demo/mappings/${mappingId}/resolve`
        : `/api/integrations/${tenantId}/clover/mappings/${mappingId}/resolve`;

      const result = await this.makeAuthenticatedRequest<any>(
        endpoint,
        { 
          method: 'POST',
          body: JSON.stringify({ resolution })
        },
        `platform-clover-resolve-conflict-${tenantId}-${mappingId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to resolve Clover mapping conflict:', error);
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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
   * Get Google Business comparison data
   */
  async getGoogleBusinessComparison(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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
   * Get Square integration status
   */
  async getSquareStatus(tenantId: string): Promise<SquareStatus | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<SquareStatus>(
        `/api/integrations/${tenantId}/square/status`,
        {},
        `platform-square-status-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Square status:', error);
      return null;
    }
  }

  /**
   * Get Square OAuth authorization URL
   */
  async getSquareOAuthAuthorize(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/integrations/${tenantId}/square/oauth/authorize`,
        {},
        `platform-square-oauth-authorize-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Square OAuth authorize:', error);
      throw error;
    }
  }

  /**
   * Disconnect Square integration
   */
  async disconnectSquare(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/integrations/${tenantId}/square/disconnect`,
        { 
          method: 'POST',
          body: JSON.stringify({})
        },
        `platform-square-disconnect-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to disconnect Square:', error);
      throw error;
    }
  }

  /**
   * Start Square sync
   */
  async startSquareSync(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/integrations/${tenantId}/square/sync`,
        { 
          method: 'POST',
          body: JSON.stringify({})
        },
        `platform-square-sync-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to start Square sync:', error);
      throw error;
    }
  }

  /**
   * Get current user information
   */
  async getUser(): Promise<any> {
    try {
      const result = await this.makeAuthenticatedRequest<any>(
        '/auth/me',
        {},
        'platform-user-info',
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get user:', error);
      return null;
    }
  }

  /**
   * Get tenant data for onboarding
   */
  async getOnboardingTenantData(tenantId: string): Promise<any> {
    try {
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
        business_name: profile?.businessName || tenant?.name || '',
        phone: profile?.phone || tenant?.metadata?.phone || '',
        email: profile?.email || tenant?.metadata?.email || '',
        website: profile?.website || tenant?.metadata?.website || '',
        contact_person: profile?.contactPerson || tenant?.metadata?.contact_person || '',
        ...profile,
      };

      return mergedData;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get onboarding tenant data:', error);
      return {};
    }
  }

  /**
   * Save onboarding business profile
   */
  async saveOnboardingProfile(tenantId: string, data: any): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
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

      // Extract validation errors from the details field
      if (result?.details?.fieldErrors) {
        const fieldErrors = result.details.fieldErrors;
        const firstError = Object.values(fieldErrors).flat()[0];
        throw new Error(String(firstError) || 'Validation failed');
      }
      
      if (result?.error) {
        throw new Error(result.error || 'Failed to save business profile');
      }
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to save onboarding profile:', error);
      throw error;
    }
  }

  /**
   * Check for active scan sessions
   */
  async checkActiveScanSessions(tenantId: string): Promise<ScanSession | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<ScanSession[]>(
        `/api/scan/sessions?tenantId=${tenantId}&status=active`,
        {},
        `platform-scan-active-sessions-${tenantId}`,
        this.cacheTTL
      );

      return Array.isArray(result) && result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to check scan sessions:', error);
      return null;
    }
  }

  /**
   * Create a new scan session
   */
  async createScanSession(tenantId: string): Promise<ScanSession> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<ScanSession>(
        '/api/scan/sessions',
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId })
        },
        `platform-scan-create-session-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to create scan session:', error);
      throw error;
    }
  }

  /**
   * End a scan session
   */
  async endScanSession(sessionId: string): Promise<void> {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/scan/sessions/${sessionId}`,
        { 
          method: 'PUT',
          body: JSON.stringify({ status: 'completed' })
        },
        `platform-scan-end-session-${sessionId}`
      );
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to end scan session:', error);
      throw error;
    }
  }

  /**
   * Start a new scan
   */
  async startScan(tenantId: string, deviceType: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        '/api/scan/start',
        {
          method: 'POST',
          body: JSON.stringify({ tenantId, deviceType })
        },
        `platform-start-scan-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to start scan:', error);
      throw error;
    }
  }

  /**
   * Get complete tenant data including tier and usage
   */
  async getTenantComplete(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${encodeURIComponent(tenantId)}/complete`,
        {},
        `platform-tenant-complete-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get complete tenant data:', error);
      throw error;
    }
  }

  /**
   * Get consolidated dashboard data for tenant
   */
  async getDashboardConsolidated(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
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
   * Get complete categories data for tenant
   */
  async getCategoriesComplete(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
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
   * Get tenant categories
   */
  async getTenantCategories(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/categories`,
        {},
        `platform-tenant-categories-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get tenant categories:', error);
      throw error;
    }
  }

  /**
   * Get tenant tier
   */
  async getTenantTier(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/tier`,
        {},
        `platform-tenant-tier-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get tenant tier:', error);
      throw error;
    }
  }

  /**
   * Get tenant usage statistics
   */
  async getTenantUsage(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/usage`,
        {},
        `platform-tenant-usage-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get tenant usage:', error);
      throw error;
    }
  }

  /**
   * Get tenant category by ID
   */
  async getTenantCategory(tenantId: string, categoryId: string): Promise<any> {
    try {
      if (!tenantId || !categoryId) {
        throw new Error('Tenant ID and Category ID are required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/v1/tenants/${tenantId}/categories/${categoryId}`,
        {},
        `platform-tenant-category-${tenantId}-${categoryId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get tenant category:', error);
      throw error;
    }
  }

  /**
   * Update tenant category
   */
  async updateTenantCategory(tenantId: string, categoryId: string, categoryData: any): Promise<any> {
    try {
      if (!tenantId || !categoryId) {
        throw new Error('Tenant ID and Category ID are required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/v1/tenants/${tenantId}/categories/${categoryId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(categoryData)
        },
        `platform-update-tenant-category-${tenantId}-${categoryId}`
      );

      // Invalidate categories complete cache for this tenant
      await this.invalidateCache(`platform-categories-complete-${tenantId}`);
      
      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update tenant category:', error);
      throw error;
    }
  }

  /**
   * Delete tenant category
   */
  async deleteTenantCategory(tenantId: string, categoryId: string): Promise<any> {
    try {
      if (!tenantId || !categoryId) {
        throw new Error('Tenant ID and Category ID are required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/v1/tenants/${tenantId}/categories/${categoryId}`,
        {
          method: 'DELETE'
        },
        `platform-delete-tenant-category-${tenantId}-${categoryId}`
      );

      // Invalidate categories complete cache for this tenant
      await this.invalidateCache(`platform-categories-complete-${tenantId}`);
      
      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to delete tenant category:', error);
      throw error;
    }
  }

  /**
   * Create tenant category
   */
  async createTenantCategory(tenantId: string, categoryData: any): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/v1/tenants/${tenantId}/categories`,
        {
          method: 'POST',
          body: JSON.stringify(categoryData)
        },
        `platform-create-tenant-category-${tenantId}`
      );

      // Invalidate categories complete cache for this tenant
      await this.invalidateCache(`platform-categories-complete-${tenantId}`);
      
      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to create tenant category:', error);
      throw error;
    }
  }

  /**
   * Get tenant subdomain
   */
  async getTenantSubdomain(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}`,
        {},
        `platform-tenant-subdomain-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get tenant subdomain:', error);
      throw error;
    }
  }

  /**
   * Get user subdomains
   */
  async getUserSubdomains(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/my-subdomains?tenantId=${tenantId}`,
        {},
        `platform-user-subdomains-${tenantId}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get user subdomains:', error);
      throw error;
    }
  }

  /**
   * Check subdomain availability
   */
  async checkSubdomainAvailability(subdomain: string): Promise<any> {
    try {
      if (!subdomain) {
        throw new Error('Subdomain is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/check-subdomain/${subdomain}`,
        {},
        `platform-check-subdomain-${subdomain}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to check subdomain availability:', error);
      throw error;
    }
  }

  /**
   * Update tenant subdomain
   */
  async updateTenantSubdomain(tenantId: string, subdomain: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/subdomain`,
        { 
          method: 'PUT',
          body: JSON.stringify({ subdomain })
        },
        `platform-update-tenant-subdomain-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update tenant subdomain:', error);
      throw error;
    }
  }

  /**
   * Delete tenant subdomain
   */
  async deleteTenantSubdomain(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/subdomain`,
        { method: 'DELETE' },
        `platform-delete-tenant-subdomain-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to delete tenant subdomain:', error);
      throw error;
    }
  }

  /**
   * Delete subdomain by tenant ID
   */
  async deleteSubdomainByTenantId(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/subdomain`,
        { method: 'DELETE' },
        `platform-delete-subdomain-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to delete subdomain:', error);
      throw error;
    }
  }

  /**
   * Get Sentry configuration
   */
  async getSentryConfig(): Promise<SentryConfig | null> {
    try {
      const result = await this.makeAuthenticatedRequest<SentryConfig>(
        '/api/admin/sentry/config',
        {},
        'platform-sentry-config',
        this.cacheTTL
      );

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get Sentry config:', error);
      return null;
    }
  }

  /**
   * Get upgrade requests for tenant
   */
  async getUpgradeRequests(tenantId: string, status?: string): Promise<UpgradeRequest[] | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const statusParam = status ? `&status=${status}` : '';
      const result = await this.makeAuthenticatedRequest<UpgradeRequestsResponse>(
        `/api/upgrade-requests?tenantId=${tenantId}${statusParam}`,
        {},
        `platform-upgrade-requests-${tenantId}-${status || 'all'}`,
        this.cacheTTL
      );

      return result?.data || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to get upgrade requests:', error);
      return null;
    }
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
    try {
      const result = await this.makeAuthenticatedRequest<UpgradeRequest>(
        '/api/upgrade-requests',
        { 
          method: 'POST',
          body: JSON.stringify(requestData)
        },
        `platform-create-upgrade-request-${requestData.tenantId}`
      );

      // Invalidate upgrade requests cache
      await this.invalidateCache(`platform-upgrade-requests-${requestData.tenantId}*`);

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to create upgrade request:', error);
      throw error;
    }
  }

  /**
   * Assign tenant to organization
   */
  async assignTenantToOrganization(organizationId: string, tenantId: string): Promise<void> {
    try {
      if (!organizationId || !tenantId) {
        throw new Error('Organization ID and Tenant ID are required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/organizations/${organizationId}/tenants`,
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId })
        },
        `org-assign-${organizationId}-${tenantId}`
      );

      // Invalidate relevant caches
      await this.invalidateCache('platform-tenants*');
      await this.invalidateCache('platform-organizations*');
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

      await this.makeAuthenticatedRequest<void>(
        `/api/organizations/${organizationId}/tenants/${tenantId}`,
        { method: 'DELETE' },
        `org-remove-${organizationId}-${tenantId}`
      );

      // Invalidate relevant caches
      await this.invalidateCache('platform-tenants*');
      await this.invalidateCache('platform-organizations*');
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
    try {
      const result = await this.makeAuthenticatedRequest<PendingRequest>(
        '/api/organization-requests',
        { 
          method: 'POST',
          body: JSON.stringify(requestData)
        },
        `platform-create-org-request-${requestData.tenantId}`
      );

      // Invalidate pending request cache
      await this.invalidateCache(`platform-pending-request-${requestData.tenantId}*`);

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to create organization request:', error);
      throw error;
    }
  }

  /**
   * Delete pending request
   */
  async deletePendingRequest(requestId: string): Promise<void> {
    try {
      if (!requestId) {
        throw new Error('Request ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/organization-requests/${requestId}`,
        { method: 'DELETE' },
        `platform-delete-pending-request-${requestId}`
      );

      // Invalidate pending request cache
      await this.invalidateCache(`platform-pending-request-*`);
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to delete pending request:', error);
      throw error;
    }
  }

  /**
   * Update pending request
   */
  async updatePendingRequest(requestId: string, updates: Partial<PendingRequest>): Promise<PendingRequest | null> {
    try {
      if (!requestId) {
        throw new Error('Request ID is required');
      }

      const result = await this.makeAuthenticatedRequest<PendingRequest>(
        `/api/organization-requests/${requestId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates)
        },
        `platform-pending-request-${requestId}`
      );

      // Invalidate pending request cache
      await this.invalidateCache(`platform-pending-request-*`);

      return result || null;
    } catch (error) {
      console.error('[PlatformHomeSingleton] Failed to update pending request:', error);
      throw error;
    }
  }

}

// Export singleton instance
export const platformHomeService = PlatformHomeSingletonService.getInstance();
