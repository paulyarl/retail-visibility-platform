/**
 * Tenant Service
 * 
 * Provides business logic abstraction for tenant operations
 * with proper separation from HTTP concerns and database access.
 */

import { prisma } from '../prisma';
import { ResolvedTenant } from './UniversalIdentifierCache';

export interface TenantProfile {
  id: string;
  name: string;
  slug: string | null;
  subscriptionStatus: string;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  settings: any;
  businessInfo: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
}

export interface CompleteTenantData {
  profile: TenantProfile;
  usage: {
    totalItems: number;
    activeItems: number;
    categories: number;
    users: number;
    orders: number;
  };
  tier: {
    currentTier: string;
    limits: {
      items: number;
      users: number;
      categories: number;
      storage: number;
    };
    usage: {
      items: number;
      users: number;
      categories: number;
      storage: number;
    };
  };
  subscription: {
    status: string;
    plan: string;
    expiresAt?: string;
    features: string[];
  };
}

export interface TenantUsersList {
  users: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    joinedAt: string;
    lastActive?: string;
  }>;
  total: number;
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface TenantOrdersList {
  orders: Array<{
    id: string;
    status: string;
    total: number;
    createdAt: string;
    customerName: string;
    itemCount: number;
  }>;
  total: number;
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

/**
 * Tenant Service with business logic abstraction
 */
export class TenantService {
  private static instance: TenantService;

  private constructor() {
    console.log('[TenantService] Initialized service instance');
  }

  static getInstance(): TenantService {
    if (!TenantService.instance) {
      TenantService.instance = new TenantService();
    }
    return TenantService.instance;
  }

  /**
   * Get tenant profile by ID
   */
  async getTenantProfile(tenantId: string): Promise<TenantProfile | null> {
    try {
      console.log(`[TenantService] Getting profile for tenant: ${tenantId}`);
      
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          subscription_status: true,
          metadata: true,
          created_at: true
        }
      });

      if (!tenant) {
        console.log(`[TenantService] Tenant not found: ${tenantId}`);
        return null;
      }

      // Extract business info from metadata
      const businessInfo = (tenant.metadata && typeof tenant.metadata === 'object' && !Array.isArray(tenant.metadata)) 
        ? (tenant.metadata as any).businessInfo || {} 
        : {};

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug || '',
        subscriptionStatus: tenant.subscription_status || 'unknown',
        metadata: tenant.metadata,
        createdAt: tenant.created_at.toISOString(),
        updatedAt: tenant.created_at.toISOString(), // Use created_at as fallback
        settings: {}, // Settings not available in schema
        businessInfo
      };
    } catch (error) {
      console.error(`[TenantService] Error getting profile for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get complete tenant data (profile + usage + tier + subscription)
   */
  async getTenantComplete(tenantId: string): Promise<CompleteTenantData | null> {
    try {
      console.log(`[TenantService] Getting complete data for tenant: ${tenantId}`);
      
      // Execute all queries in parallel for maximum performance
      const [tenant, itemCount, activeItemCount, categoryCount, userCount, orderCount] = await Promise.all([
        // Tenant profile
        prisma.tenants.findUnique({
          where: { id: tenantId },
          select: {
            id: true,
            name: true,
            slug: true,
            subscription_status: true,
            metadata: true,
            created_at: true
          }
        }),
        
        // Usage metrics
        prisma.inventory_items.count({
          where: { tenant_id: tenantId }
        }),
        
        prisma.inventory_items.count({
          where: {
            tenant_id: tenantId,
            availability: 'in_stock'
          }
        }),
        
        // Categories count - use platform_categories as fallback
        0, // Placeholder for categories count
        
        prisma.user_tenants.count({
          where: { tenant_id: tenantId }
        }),
        
        prisma.orders.count({
          where: { tenant_id: tenantId }
        })
      ]);

      if (!tenant) {
        console.log(`[TenantService] Tenant not found: ${tenantId}`);
        return null;
      }

      // Get tier information
      const tierInfo = await this.getTenantTierInfo(tenantId);
      
      // Get subscription information
      const subscriptionInfo = await this.getTenantSubscriptionInfo(tenantId);

      // Extract business info from metadata
      const metadata = tenant.metadata as any || {};
      const businessInfo = metadata.businessInfo || {};

      return {
        profile: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug || '',
          subscriptionStatus: tenant.subscription_status || '',
          metadata: tenant.metadata,
          createdAt: tenant.created_at.toISOString(),
          updatedAt: tenant.created_at.toISOString(), // Use created_at as fallback
          settings: metadata.settings || {},
          businessInfo
        },
        usage: {
          totalItems: itemCount,
          activeItems: activeItemCount,
          categories: categoryCount,
          users: userCount,
          orders: orderCount
        },
        tier: tierInfo,
        subscription: subscriptionInfo
      };
    } catch (error) {
      console.error(`[TenantService] Error getting complete data for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get tenant users with roles
   */
  async getTenantUsers(tenantId: string, options: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<TenantUsersList> {
    try {
      console.log(`[TenantService] Getting users for tenant: ${tenantId}`);
      
      const { page = 1, limit = 50, search } = options;
      const offset = (page - 1) * limit;

      const whereCondition: any = { tenant_id: tenantId };
      
      if (search) {
        whereCondition.users = {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } }
          ]
        };
      }

      const [userTenants, total] = await Promise.all([
        prisma.user_tenants.findMany({
          where: whereCondition,
          include: {
            users: {
              select: {
                id: true,
                email: true,
                last_login: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: offset,
          take: limit
        }),
        
        prisma.user_tenants.count({
          where: whereCondition
        })
      ]);

      const users = userTenants.map(ut => ({
        id: ut.user_id,
        email: ut.user_id, // Use user_id as email placeholder since relationship is missing
        name: ut.user_id, // Use user_id as name placeholder
        role: ut.role as string,
        joinedAt: ut.created_at.toISOString(),
        lastActive: undefined // Use undefined instead of null for optional field
      }));

      return {
        users,
        total,
        pagination: {
          page,
          limit,
          hasMore: offset + users.length < total
        }
      };
    } catch (error) {
      console.error(`[TenantService] Error getting users for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get tenant orders
   */
  async getTenantOrders(tenantId: string, options: {
    page?: number;
    limit?: number;
    status?: string;
  } = {}): Promise<TenantOrdersList> {
    try {
      console.log(`[TenantService] Getting orders for tenant: ${tenantId}`);
      
      const { page = 1, limit = 50, status } = options;
      const offset = (page - 1) * limit;

      const whereCondition: any = { tenant_id: tenantId };
      if (status) {
        whereCondition.status = status;
      }

      const [orders, total] = await Promise.all([
        prisma.orders.findMany({
          where: whereCondition,
          orderBy: { created_at: 'desc' },
          skip: offset,
          take: limit
        }),
        
        prisma.orders.count({
          where: whereCondition
        })
      ]);

      const formattedOrders = orders.map((order: any) => ({
        id: order.id,
        status: 'pending', // Default status since field doesn't exist
        total: 0, // Default total since total_amount doesn't exist
        createdAt: order.created_at.toISOString(),
        customerName: 'Unknown', // No customer relationship available
        itemCount: 0 // No order_items relationship available
      }));

      return {
        orders: formattedOrders,
        total,
        pagination: {
          page,
          limit,
          hasMore: offset + formattedOrders.length < total
        }
      };
    } catch (error) {
      console.error(`[TenantService] Error getting orders for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Update tenant profile
   */
  async updateTenantProfile(tenantId: string, data: {
    name?: string;
    businessInfo?: any;
    settings?: any;
  }): Promise<TenantProfile> {
    try {
      console.log(`[TenantService] Updating profile for tenant: ${tenantId}`);
      
      const updateData: any = {};
      
      if (data.name) {
        updateData.name = data.name;
      }
      
      if (data.businessInfo || data.settings) {
        const currentTenant = await prisma.tenants.findUnique({
          where: { id: tenantId },
          select: { metadata: true }
        });
        
        if (!currentTenant) {
          throw new Error('Tenant not found');
        }
        
        const currentMetadata = currentTenant.metadata as any || {};
        const updatedMetadata = { ...currentMetadata };
        
        if (data.businessInfo) {
          updatedMetadata.businessInfo = { ...updatedMetadata.businessInfo, ...data.businessInfo };
        }
        
        if (data.settings) {
          updatedMetadata.settings = { ...updatedMetadata.settings, ...data.settings };
        }
        
        updateData.metadata = updatedMetadata;
      }

      const tenant = await prisma.tenants.update({
        where: { id: tenantId },
        data: updateData,
        select: {
          id: true,
          name: true,
          slug: true,
          subscription_status: true,
          metadata: true,
          created_at: true
        }
      });

      // Invalidate cache for this tenant
      const { UniversalIdentifierCache } = await import('./UniversalIdentifierCache');
      const cache = UniversalIdentifierCache.getInstance();
      await cache.invalidateTenant(tenantId);

      const businessInfo = (tenant.metadata && typeof tenant.metadata === 'object' && !Array.isArray(tenant.metadata)) 
        ? (tenant.metadata as any).businessInfo || {} 
        : {};

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug || '',
        subscriptionStatus: tenant.subscription_status || 'unknown',
        metadata: tenant.metadata,
        createdAt: tenant.created_at.toISOString(),
        updatedAt: tenant.created_at.toISOString(), // Use created_at as fallback
        settings: {}, // Settings not available in schema
        businessInfo
      };
    } catch (error) {
      console.error(`[TenantService] Error updating profile for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Update tenant subdomain
   */
  async updateTenantSubdomain(tenantId: string, subdomain: string): Promise<TenantProfile> {
    try {
      console.log(`[TenantService] Updating subdomain for tenant: ${tenantId}`);
      
      // Check if subdomain is already taken
      const existing = await prisma.tenants.findFirst({
        where: {
          subdomain,
          id: { not: tenantId }
        }
      });

      if (existing) {
        throw new Error('Subdomain already taken');
      }

      const tenant = await prisma.tenants.update({
        where: { id: tenantId },
        data: {
          subdomain
        },
        select: {
          id: true,
          name: true,
          slug: true,
          subscription_status: true,
          metadata: true,
          created_at: true
        }
      });

      // Invalidate cache
      const { UniversalIdentifierCache } = await import('./UniversalIdentifierCache');
      const cache = UniversalIdentifierCache.getInstance();
      await cache.invalidateTenant(tenantId);

      const metadata = tenant.metadata as any || {};
      const businessInfo = metadata.businessInfo || {};

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug || '',
        subscriptionStatus: tenant.subscription_status || '',
        metadata: tenant.metadata,
        createdAt: tenant.created_at.toISOString(),
        updatedAt: tenant.created_at.toISOString(), // Use created_at as fallback
        settings: (tenant.metadata as any)?.settings || {},
        businessInfo
      };
    } catch (error) {
      console.error(`[TenantService] Error updating subdomain for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get tenant tier information
   */
  private async getTenantTierInfo(tenantId: string): Promise<CompleteTenantData['tier']> {
    try {
      // Get tenant with subscription tier
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: {
          subscription_tier: true,
          subscription_status: true,
        }
      });

      const tierKey = tenant?.subscription_tier || 'starter';

      // Get tier configuration from database
      const tierConfig = await prisma.subscription_tiers_list.findUnique({
        where: { tier_key: tierKey },
        select: {
          max_skus: true,
          max_locations: true,
          tier_key: true,
          name: true,
        }
      });

      // Fallback limits if tier not found in database
      const defaultLimits: Record<string, { items: number; users: number; categories: number; storage: number }> = {
        google_only: { items: 250, users: 1, categories: 25, storage: 1024 * 1024 * 50 },
        starter: { items: 500, users: 3, categories: 50, storage: 1024 * 1024 * 100 },
        professional: { items: 5000, users: 10, categories: 200, storage: 1024 * 1024 * 1024 },
        enterprise: { items: Infinity, users: Infinity, categories: Infinity, storage: Infinity },
        organization: { items: 10000, users: 50, categories: 500, storage: 1024 * 1024 * 1024 * 10 },
        chain_starter: { items: 2500, users: 10, categories: 100, storage: 1024 * 1024 * 500 },
        chain_professional: { items: 25000, users: 50, categories: 500, storage: 1024 * 1024 * 1024 * 5 },
        chain_enterprise: { items: Infinity, users: Infinity, categories: Infinity, storage: Infinity },
      };

      const limits = tierConfig 
        ? {
            items: tierConfig.max_skus || defaultLimits[tierKey]?.items || 500,
            users: defaultLimits[tierKey]?.users || 5,
            categories: 100,
            storage: defaultLimits[tierKey]?.storage || 1024 * 1024 * 100,
          }
        : defaultLimits[tierKey] || defaultLimits.starter;

      // Get actual usage metrics
      const [itemCount, userCount] = await Promise.all([
        prisma.inventory_items.count({ where: { tenant_id: tenantId } }),
        prisma.user_tenants.count({ where: { tenant_id: tenantId } }),
      ]);

      return {
        currentTier: tierKey,
        limits,
        usage: {
          items: itemCount,
          users: userCount,
          categories: 0, // Categories not tracked per tenant currently
          storage: 0, // Storage not tracked currently
        }
      };
    } catch (error) {
      console.error(`[TenantService] Error getting tier info for ${tenantId}:`, error);
      // Return defaults on error
      return {
        currentTier: 'starter',
        limits: { items: 500, users: 3, categories: 50, storage: 1024 * 1024 * 100 },
        usage: { items: 0, users: 0, categories: 0, storage: 0 }
      };
    }
  }

  /**
   * Get tenant subscription information
   */
  private async getTenantSubscriptionInfo(tenantId: string): Promise<CompleteTenantData['subscription']> {
    try {
      // Get tenant subscription details
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: {
          subscription_tier: true,
          subscription_status: true,
          trial_ends_at: true,
          subscription_ends_at: true,
        }
      });

      if (!tenant) {
        return {
          status: 'inactive',
          plan: 'none',
          features: []
        };
      }

      // Get features for the tier
      const tierFeatures = await prisma.tier_features_list.findMany({
        where: {
          tier_id: `tier_${tenant.subscription_tier || 'starter'}`,
          is_enabled: true,
        },
        select: {
          feature_key: true,
        }
      });

      return {
        status: tenant.subscription_status || 'active',
        plan: tenant.subscription_tier || 'starter',
        expiresAt: tenant.subscription_ends_at?.toISOString() || tenant.trial_ends_at?.toISOString(),
        features: tierFeatures.map(f => f.feature_key),
      };
    } catch (error) {
      console.error(`[TenantService] Error getting subscription info for ${tenantId}:`, error);
      // Return defaults on error
      return {
        status: 'active',
        plan: 'starter',
        features: ['basic_analytics', 'inventory_management', 'customer_support']
      };
    }
  }
}
