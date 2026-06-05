/**
 * Shared Platform Dashboard Interfaces
 * 
 * Common interfaces used by both public and authenticated platform dashboard services
 */

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

export interface PlatformActivity {
  id: string;
  type: 'tenant_created' | 'item_added' | 'user_registered' | 'subscription_updated';
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
  // Additional fields for authenticated version
  tenantId?: string;
  tenantName?: string;
  details?: string;
}

export interface PlatformDashboardData {
  stats: PlatformStats;
  topTenants: TenantMetrics[];
  recentActivity: PlatformActivity[];
}
