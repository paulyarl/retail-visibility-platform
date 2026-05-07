import { UniversalSingleton, SingletonMetrics } from '../lib/UniversalSingleton';
import { prisma } from '../prisma';

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalItems: number;
  activeItems: number;
  totalUsers: number;
  activeUsers: number;
  totalOrganizations: number;
  systemHealth: {
    database: 'healthy' | 'degraded' | 'down';
    cache: 'healthy' | 'degraded' | 'down';
    api: 'healthy' | 'degraded' | 'down';
  };
  growthMetrics: {
    newTenantsThisMonth: number;
    newItemsThisMonth: number;
    newUsersThisMonth: number;
  };
}

export interface TenantMetrics {
  id: string;
  name: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  locationStatus: string;
  itemCount: number;
  userCount: number;
  lastActive: string;
  healthScore: number;
}

export interface PlatformDashboardData {
  stats: PlatformStats;
  topTenants: TenantMetrics[];
  recentActivity: Array<{
    type: 'tenant_created' | 'item_added' | 'user_registered';
    tenantId: string;
    tenantName: string;
    timestamp: string;
    details: string;
  }>;
}

/**
 * Platform Dashboard Singleton Service
 * Provides cached, optimized access to platform-wide dashboard data
 * Reduces database load and improves performance across all admin dashboards
 */
export class PlatformDashboardSingletonService extends UniversalSingleton {
  private readonly TOP_TENANTS_LIMIT = 10;
  private readonly RECENT_ACTIVITY_LIMIT = 20;

  constructor() {
    super('platform-dashboard', {
      enableCache: true,
      defaultTTL: 5 * 60, // 5 minutes in seconds
      maxCacheSize: 50,
      enableMetrics: true,
      enableLogging: true
    });
  }

  /**
   * Get complete platform dashboard data
   * Combines stats, top tenants, and recent activity in one call
   */
  async getPlatformDashboardData(): Promise<PlatformDashboardData> {
    const cacheKey = this.generatePlatformCacheKey('dashboard-data');
    
    // Check cache first
    const cached = await this.getFromCache<PlatformDashboardData>(cacheKey);
    if (cached) {
      return cached;
    }

    this.metrics.apiCalls++;

    try {
      // Fetch all data in parallel for maximum efficiency
      const [stats, topTenants, recentActivity] = await Promise.all([
        this.getPlatformStats(),
        this.getTopTenants(),
        this.getRecentActivity()
      ]);

      const dashboardData: PlatformDashboardData = {
        stats,
        topTenants,
        recentActivity
      };

      // Cache the results
      await this.setCache(cacheKey, dashboardData);
      
      return dashboardData;

    } catch (error) {
      this.metrics.errors++;
      this.logError('Failed to fetch platform dashboard data', error as Error);
      throw error;
    }
  }

  /**
   * Get platform-wide statistics
   */
  async getPlatformStats(): Promise<PlatformStats> {
    const cacheKey = this.generatePlatformCacheKey('stats');
    
    const cached = await this.getFromCache<PlatformStats>(cacheKey);
    if (cached) {
      return cached;
    }

    this.metrics.apiCalls++;

    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Parallel queries for maximum performance
      const [
        totalTenants,
        activeTenants,
        totalItems,
        activeItems,
        totalUsers,
        activeUsers,
        newTenantsThisMonth,
        newItemsThisMonth,
        newUsersThisMonth
      ] = await Promise.all([
        prisma.tenants.count(),
        prisma.tenants.count({ where: { location_status: 'active' } }),
        prisma.inventory_items.count(),
        prisma.inventory_items.count({ where: { item_status: 'active' } }),
        prisma.users.count(),
        prisma.users.count({ where: { last_login: { gte: startOfMonth } } }),
        prisma.tenants.count({ where: { created_at: { gte: startOfMonth } } }),
        prisma.inventory_items.count({ where: { created_at: { gte: startOfMonth } } }),
        prisma.users.count({ where: { created_at: { gte: startOfMonth } } })
      ]);

      const stats: PlatformStats = {
        totalTenants,
        activeTenants,
        totalItems,
        activeItems,
        totalUsers,
        activeUsers,
        totalOrganizations: 0, // TODO: Add organizations count when table is available
        systemHealth: await this.getSystemHealth(),
        growthMetrics: {
          newTenantsThisMonth,
          newItemsThisMonth,
          newUsersThisMonth
        }
      };

      await this.setCache(cacheKey, stats);
      return stats;

    } catch (error) {
      this.logError('Failed to fetch platform stats', error as Error);
      throw error;
    }
  }

  /**
   * Get top performing tenants
   */
  async getTopTenants(): Promise<TenantMetrics[]> {
    const cacheKey = this.generatePlatformCacheKey('top-tenants');
    
    const cached = await this.getFromCache<TenantMetrics[]>(cacheKey);
    if (cached) {
      return cached;
    }

    this.metrics.apiCalls++;

    try {
      const tenants = await prisma.tenants.findMany({
        take: this.TOP_TENANTS_LIMIT,
        select: {
          id: true,
          name: true,
          subscription_tier: true,
          subscription_status: true,
          location_status: true,
          created_at: true,
          _count: {
            select: {
              inventory_items: true,
              user_tenants: true
            }
          }
        },
        orderBy: [
          { created_at: 'desc' }
        ],
        where: {
          subscription_status: 'active'
        }
      });

      // Sort by item count manually since _count can't be used in orderBy
      const sortedTenants = tenants.sort((a, b) => b._count.inventory_items - a._count.inventory_items);

      const tenantMetrics: TenantMetrics[] = sortedTenants.map(tenant => ({
        id: tenant.id,
        name: tenant.name,
        subscriptionTier: tenant.subscription_tier || 'unknown',
        subscriptionStatus: tenant.subscription_status || 'unknown',
        locationStatus: tenant.location_status,
        itemCount: tenant._count.inventory_items,
        userCount: tenant._count.user_tenants,
        lastActive: tenant.created_at.toISOString(),
        healthScore: this.calculateHealthScore(tenant)
      }));

      await this.setCache(cacheKey, tenantMetrics);
      return tenantMetrics;

    } catch (error) {
      this.logError('Failed to fetch top tenants', error as Error);
      throw error;
    }
  }

  /**
   * Get recent platform activity
   */
  async getRecentActivity(): Promise<Array<{
    type: 'tenant_created' | 'item_added' | 'user_registered';
    tenantId: string;
    tenantName: string;
    timestamp: string;
    details: string;
  }>> {
    const cacheKey = this.generatePlatformCacheKey('recent-activity');
    
    const cached = await this.getFromCache<Array<{
      type: 'tenant_created' | 'item_added' | 'user_registered';
      tenantId: string;
      tenantName: string;
      timestamp: string;
      details: string;
    }>>(cacheKey);
    if (cached) {
      return cached;
    }

    this.metrics.apiCalls++;

    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Get recent activities from different sources
      const [recentTenants, recentItems, recentUsers] = await Promise.all([
        prisma.tenants.findMany({
          take: 5,
          where: { created_at: { gte: oneDayAgo } },
          select: { id: true, name: true, created_at: true },
          orderBy: { created_at: 'desc' }
        }),
        prisma.inventory_items.findMany({
          take: 10,
          where: { created_at: { gte: oneDayAgo } },
          select: { 
            id: true, 
            name: true, 
            created_at: true,
            tenant_id: true,
            tenants: { select: { name: true } }
          },
          orderBy: { created_at: 'desc' }
        }),
        prisma.users.findMany({
          take: 5,
          where: { created_at: { gte: oneDayAgo } },
          select: { 
            id: true, 
            email: true, 
            created_at: true,
            user_tenants: { 
              select: { 
                tenant_id: true,
                tenants: { select: { name: true } }
              },
              take: 1
            }
          },
          orderBy: { created_at: 'desc' }
        })
      ]);

      const activities = [
        ...recentTenants.map(tenant => ({
          type: 'tenant_created' as const,
          tenantId: tenant.id,
          tenantName: tenant.name,
          timestamp: tenant.created_at.toISOString(),
          details: 'New tenant joined the platform'
        })),
        ...recentItems.map(item => ({
          type: 'item_added' as const,
          tenantId: item.tenant_id,
          tenantName: item.tenants?.name || 'Unknown',
          timestamp: item.created_at.toISOString(),
          details: `Added item: ${item.name}`
        })),
        ...recentUsers.map(user => ({
          type: 'user_registered' as const,
          tenantId: user.user_tenants[0]?.tenant_id || '',
          tenantName: user.user_tenants[0]?.tenants?.name || 'Unknown',
          timestamp: user.created_at.toISOString(),
          details: `User registered: ${user.email}`
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
       .slice(0, this.RECENT_ACTIVITY_LIMIT);

      await this.setCache(cacheKey, activities);
      return activities;

    } catch (error) {
      this.logError('Failed to fetch recent activity', error as Error);
      throw error;
    }
  }

  /**
   * Get system health status
   */
  private async getSystemHealth(): Promise<PlatformStats['systemHealth']> {
    try {
      // Check database health
      const dbHealth = await this.checkDatabaseHealth();
      
      // Check cache health (Redis)
      const cacheHealth = await this.checkCacheHealth();
      
      // API health (basic check)
      const apiHealth = 'healthy'; // Could add more sophisticated checks

      return {
        database: dbHealth,
        cache: cacheHealth,
        api: apiHealth
      };

    } catch (error) {
      this.logError('Failed to check system health', error as Error);
      return {
        database: 'degraded',
        cache: 'degraded',
        api: 'degraded'
      };
    }
  }

  /**
   * Check database connectivity
   */
  private async checkDatabaseHealth(): Promise<'healthy' | 'degraded' | 'down'> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return 'healthy';
    } catch (error) {
      return 'down';
    }
  }

  /**
   * Check cache connectivity
   */
  private async checkCacheHealth(): Promise<'healthy' | 'degraded' | 'down'> {
    try {
      // Simple cache test - try to set and get a value
      const testKey = 'health-check-' + Date.now();
      await this.setCache(testKey, { test: true });
      const result = await this.getFromCache(testKey);
      await this.clearCache(testKey);
      
      return result ? 'healthy' : 'degraded';
    } catch (error) {
      return 'down';
    }
  }

  /**
   * Calculate tenant health score
   */
  private calculateHealthScore(tenant: any): number {
    let score = 100;
    
    // Deduct points for inactive status
    if (tenant.subscription_status !== 'active') score -= 30;
    if (tenant.location_status !== 'active') score -= 20;
    
    // Deduct points for low activity
    const daysSinceUpdate = (Date.now() - tenant.created_at.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 30) score -= 20;
    else if (daysSinceUpdate > 7) score -= 10;
    
    // Deduct points for no items
    if (tenant._count.inventory_items === 0) score -= 15;
    
    return Math.max(0, score);
  }

  /**
   * Generate platform-specific cache key
   */
  private generatePlatformCacheKey(...parts: string[]): string {
    return `platform-${parts.join('-')}`;
  }

  /**
   * Clear all platform dashboard caches
   */
  async clearPlatformCache(): Promise<void> {
    const patterns = [
      'platform-dashboard-data',
      'platform-stats',
      'platform-top-tenants',
      'platform-recent-activity'
    ];

    for (const pattern of patterns) {
      await this.clearCache(pattern);
    }

    this.logInfo('Platform dashboard cache cleared');
  }

  /**
   * Get singleton metrics
   */
  getMetrics(): SingletonMetrics {
    return this.metrics;
  }
}

// Export singleton instance
export const platformDashboardSingleton = new PlatformDashboardSingletonService();
