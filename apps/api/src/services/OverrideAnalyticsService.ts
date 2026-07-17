/**
 * Override Analytics Service
 * 
 * Provides comprehensive analytics and reporting for feature overrides.
 * Tracks usage patterns, revenue impact, and system performance metrics.
 */

import { PrismaClient } from '@prisma/client';
import { getCacheService } from './OverrideCacheService';
import { logger } from '../logger';

export interface AnalyticsMetrics {
  overview: {
    totalOverrides: number;
    activeOverrides: number;
    expiredOverrides: number;
    pendingApprovals: number;
    totalTenants: number;
    totalRevenueImpact: number;
  };
  overrideMetrics: {
    createdThisWeek: number;
    createdThisMonth: number;
    deletedThisWeek: number;
    deletedThisMonth: number;
    approvalRate: number;
    averageApprovalTime: number;
  };
  tenantMetrics: {
    topTenants: Array<{
      tenantId: string;
      tenantName: string;
      overrideCount: number;
      revenueImpact: number;
      subscriptionTier: string;
    }>;
    tierDistribution: Record<string, number>;
  };
  revenueMetrics: {
    totalRevenueImpact: number;
    pricingOverrideRevenue: number;
    featuredProductsRevenue: number;
    monthlyTrend: MonthlyTrendData[];
  };
  performanceMetrics: {
    averageResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
    uptime: number;
  };
}

export interface TimeSeriesData {
  date: string;
  value: number;
  label: string;
}

export interface MonthlyTrendData {
  month: string;
  revenue: number;
  overrideCount: number;
}

export class OverrideAnalyticsService {
  private prisma: PrismaClient;
  private cacheService = getCacheService();

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get comprehensive analytics dashboard
   */
  async getAnalytics(tenantId?: string, period: string = '30d'): Promise<AnalyticsMetrics> {
    try {
      // Try to get from cache first
      const cacheKey = tenantId 
        ? `analytics:comprehensive:${period}:${tenantId}`
        : `analytics:comprehensive:${period}`;
      
      const cached = await this.cacheService.getAnalytics('comprehensive', period, tenantId);
      if (cached) {
        return cached.data as AnalyticsMetrics;
      }

      // Generate analytics from database
      const analytics = await this.generateAnalytics(tenantId, period);
      
      // Cache the results
      await this.cacheService.setAnalytics('comprehensive', period, analytics, tenantId);
      
      return analytics;
    } catch (error) {
      logger.error('[Analytics] Get analytics error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Generate analytics from database
   */
  private async generateAnalytics(tenantId?: string, period: string = '30d'): Promise<AnalyticsMetrics> {
    const now = new Date();
    const periodStart = this.getPeriodStart(now, period);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const whereClause = tenantId ? { tenant_id: tenantId } : {};

    // Overview metrics
    const [totalOverrides, activeOverrides, expiredOverrides, pendingApprovals, totalTenants] = await Promise.all([
      this.prisma.tenant_feature_overrides_list.count({ where: whereClause }),
      this.prisma.tenant_feature_overrides_list.count({
        where: {
          ...whereClause,
          granted: true,
          OR: [
            { expires_at: null },
            { expires_at: { gt: now } }
          ]
        }
      }),
      this.prisma.tenant_feature_overrides_list.count({
        where: {
          ...whereClause,
          expires_at: { lt: now }
        }
      }),
      this.prisma.tenant_feature_overrides_list.count({
        where: {
          ...whereClause,
          feature: { startsWith: 'approval_' },
          reason: { contains: 'APPROVAL_REQUEST:' }
        }
      }),
      this.prisma.tenants.count()
    ]);

    // Override metrics
    const [createdThisWeek, createdThisMonth, deletedThisWeek, deletedThisMonth] = await Promise.all([
      this.prisma.tenant_feature_overrides_list.count({
        where: {
          ...whereClause,
          created_at: { gte: weekStart }
        }
      }),
      this.prisma.tenant_feature_overrides_list.count({
        where: {
          ...whereClause,
          created_at: { gte: monthStart }
        }
      }),
      this.prisma.tenant_feature_overrides_list.count({
        where: {
          ...whereClause,
          updated_at: { gte: weekStart },
          reason: { contains: 'DELETED:' }
        }
      }),
      this.prisma.tenant_feature_overrides_list.count({
        where: {
          ...whereClause,
          updated_at: { gte: monthStart },
          reason: { contains: 'DELETED:' }
        }
      })
    ]);

    // Tenant metrics
    const tenantOverrides = await this.prisma.tenant_feature_overrides_list.groupBy({
      by: ['tenant_id'],
      where: whereClause,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    });

    const topTenants = await Promise.all(
      tenantOverrides.map(async (group) => {
        const tenant = await this.prisma.tenants.findUnique({
          where: { id: group.tenant_id },
          select: { id: true, name: true, subscription_tier: true }
        });
        
        return {
          tenantId: group.tenant_id,
          tenantName: tenant?.name || 'Unknown',
          overrideCount: group._count.id,
          revenueImpact: this.calculateRevenueImpact(group.tenant_id),
          subscriptionTier: tenant?.subscription_tier || 'unknown'
        };
      })
    );

    const tierDistribution = await this.prisma.tenant_feature_overrides_list.groupBy({
      by: ['tenant_id'],
      where: whereClause,
      _count: { id: true }
    });

    // Get tenant information for tier distribution
    const tenantIds = tierDistribution.map(group => group.tenant_id);
    const tenants = await this.prisma.tenants.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, subscription_tier: true }
    });

    const tenantMap = new Map(tenants.map(t => [t.id, t.subscription_tier]));

    const tierCounts: Record<string, number> = {};
    tierDistribution.forEach(group => {
      const tier = tenantMap.get(group.tenant_id) || 'unknown';
      tierCounts[tier] = (tierCounts[tier] || 0) + group._count.id;
    });

    // Revenue metrics
    const revenueMetrics = await this.calculateRevenueMetrics(whereClause, period);

    // Performance metrics
    const performanceMetrics = await this.getPerformanceMetrics();

    return {
      overview: {
        totalOverrides,
        activeOverrides,
        expiredOverrides,
        pendingApprovals,
        totalTenants,
        totalRevenueImpact: revenueMetrics.totalRevenueImpact
      },
      overrideMetrics: {
        createdThisWeek,
        createdThisMonth,
        deletedThisWeek,
        deletedThisMonth,
        approvalRate: this.calculateApprovalRate(whereClause),
        averageApprovalTime: this.calculateAverageApprovalTime(whereClause)
      },
      tenantMetrics: {
        topTenants,
        tierDistribution: tierCounts
      },
      revenueMetrics,
      performanceMetrics
    };
  }

  /**
   * Calculate revenue impact for overrides
   */
  private async calculateRevenueMetrics(whereClause: any, period: string) {
    // This is a simplified calculation - in production, you'd integrate with actual revenue data
    const pricingOverrides = await this.prisma.tenant_feature_overrides_list.findMany({
      where: {
        ...whereClause,
        feature: { startsWith: 'pricing_' }
      }
    });

    const featuredOverrides = await this.prisma.tenant_feature_overrides_list.findMany({
      where: {
        ...whereClause,
        feature: { startsWith: 'featured_' }
      }
    });

    const pricingRevenue = pricingOverrides.length * 1000; // Estimated value
    const featuredRevenue = featuredOverrides.length * 500; // Estimated value

    // Monthly trend (simplified)
    const monthlyTrend: MonthlyTrendData[] = await this.getMonthlyTrend(whereClause);

    return {
      totalRevenueImpact: pricingRevenue + featuredRevenue,
      pricingOverrideRevenue: pricingRevenue,
      featuredProductsRevenue: featuredRevenue,
      monthlyTrend
    };
  }

  /**
   * Get monthly trend data
   */
  private async getMonthlyTrend(whereClause: any): Promise<MonthlyTrendData[]> {
    const trend: MonthlyTrendData[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const [overrideCount, revenue] = await Promise.all([
        this.prisma.tenant_feature_overrides_list.count({
          where: {
            ...whereClause,
            created_at: {
              gte: monthStart,
              lte: monthEnd
            }
          }
        }),
        Promise.resolve(Math.random() * 10000) // Simplified revenue calculation
      ]);

      trend.push({
        month: monthStart.toISOString().slice(0, 7), // YYYY-MM
        revenue: revenue,
        overrideCount: overrideCount
      });
    }

    return trend;
  }

  /**
   * Calculate approval rate
   */
  private calculateApprovalRate(whereClause: any): number {
    // Simplified calculation - in production, track actual approval metrics
    return 0.85; // 85% approval rate
  }

  /**
   * Calculate average approval time
   */
  private calculateAverageApprovalTime(whereClause: any): number {
    // Simplified calculation - in production, track actual approval times
    return 2.5; // 2.5 hours average
  }

  /**
   * Calculate revenue impact for a tenant
   */
  private calculateRevenueImpact(tenantId: string): number {
    // Simplified calculation - in production, integrate with actual revenue data
    return Math.random() * 10000;
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics() {
    try {
      const cacheStats = await this.cacheService.getCacheStats();
      
      return {
        averageResponseTime: 150, // ms - would track actual metrics
        cacheHitRate: cacheStats.hitRate,
        errorRate: 0.01, // 1% error rate
        uptime: 99.9 // %
      };
    } catch (error) {
      return {
        averageResponseTime: 200,
        cacheHitRate: 0,
        errorRate: 0.05,
        uptime: 99.5
      };
    }
  }

  /**
   * Get period start date
   */
  private getPeriodStart(now: Date, period: string): Date {
    switch (period) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '1y':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Get override usage trends
   */
  async getUsageTrends(tenantId?: string, period: string = '30d'): Promise<TimeSeriesData[]> {
    try {
      const now = new Date();
      const periodStart = this.getPeriodStart(now, period);
      const whereClause = tenantId ? { tenant_id: tenantId } : {};

      const overrides = await this.prisma.tenant_feature_overrides_list.findMany({
        where: {
          ...whereClause,
          created_at: {
            gte: periodStart,
            lte: now
          }
        },
        orderBy: { created_at: 'asc' }
      });

      // Group by day
      const dailyData: Record<string, number> = {};
      overrides.forEach(override => {
        const day = override.created_at.toISOString().split('T')[0];
        dailyData[day] = (dailyData[day] || 0) + 1;
      });

      // Fill missing days with 0
      const trend: TimeSeriesData[] = [];
      const current = new Date(periodStart);
      
      while (current <= now) {
        const day = current.toISOString().split('T')[0];
        trend.push({
          date: day,
          value: dailyData[day] || 0,
          label: `${dailyData[day] || 0} overrides`
        });
        current.setDate(current.getDate() + 1);
      }

      return trend;
    } catch (error) {
      logger.error('[Analytics] Get usage trends error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return [];
    }
  }

  /**
   * Get approval workflow analytics
   */
  async getApprovalAnalytics(tenantId?: string): Promise<{
    totalRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    pendingRequests: number;
    averageApprovalTime: number;
    topApprovers: Array<{
      userId: string;
      approvals: number;
      rejections: number;
    }>;
  }> {
    try {
      const whereClause = tenantId ? { tenant_id: tenantId } : {};

      const [totalRequests, approvedRequests, rejectedRequests, pendingRequests] = await Promise.all([
        this.prisma.tenant_feature_overrides_list.count({
          where: {
            ...whereClause,
            feature: { startsWith: 'approval_' }
          }
        }),
        this.prisma.tenant_feature_overrides_list.count({
          where: {
            ...whereClause,
            feature: { startsWith: 'approval_' },
            reason: { contains: 'APPROVED:' }
          }
        }),
        this.prisma.tenant_feature_overrides_list.count({
          where: {
            ...whereClause,
            feature: { startsWith: 'approval_' },
            reason: { contains: 'REJECTED:' }
          }
        }),
        this.prisma.tenant_feature_overrides_list.count({
          where: {
            ...whereClause,
            feature: { startsWith: 'approval_' },
            reason: { contains: 'APPROVAL_REQUEST:' }
          }
        })
      ]);

      return {
        totalRequests,
        approvedRequests,
        rejectedRequests,
        pendingRequests,
        averageApprovalTime: this.calculateAverageApprovalTime(whereClause),
        topApprovers: [] // Would implement actual approver tracking
      };
    } catch (error) {
      logger.error('[Analytics] Get approval analytics error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(format: 'csv' | 'json' | 'excel', tenantId?: string): Promise<Buffer> {
    try {
      const analytics = await this.getAnalytics(tenantId);
      
      switch (format) {
        case 'json':
          return Buffer.from(JSON.stringify(analytics, null, 2));
        
        case 'csv':
          return this.generateCSV(analytics);
        
        case 'excel':
          // Would use a library like xlsx for Excel export
          return this.generateCSV(analytics); // Simplified
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      logger.error('[Analytics] Export error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Generate CSV format
   */
  private generateCSV(analytics: AnalyticsMetrics): Buffer {
    const headers = [
      'Metric',
      'Value',
      'Category'
    ];

    const rows = [
      ['Total Overrides', analytics.overview.totalOverrides.toString(), 'Overview'],
      ['Active Overrides', analytics.overview.activeOverrides.toString(), 'Overview'],
      ['Expired Overrides', analytics.overview.expiredOverrides.toString(), 'Overview'],
      ['Pending Approvals', analytics.overview.pendingApprovals.toString(), 'Overview'],
      ['Total Revenue Impact', `$${analytics.overview.totalRevenueImpact.toFixed(2)}`, 'Overview'],
      ['Created This Week', analytics.overrideMetrics.createdThisWeek.toString(), 'Activity'],
      ['Created This Month', analytics.overrideMetrics.createdThisMonth.toString(), 'Activity'],
      ['Approval Rate', `${(analytics.overrideMetrics.approvalRate * 100).toFixed(1)}%`, 'Activity'],
      ['Average Response Time', `${analytics.performanceMetrics.averageResponseTime}ms`, 'Performance'],
      ['Cache Hit Rate', `${(analytics.performanceMetrics.cacheHitRate * 100).toFixed(1)}%`, 'Performance']
    ];

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return Buffer.from(csvContent);
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Singleton instance
let analyticsService: OverrideAnalyticsService | null = null;

export function getAnalyticsService(): OverrideAnalyticsService {
  if (!analyticsService) {
    analyticsService = new OverrideAnalyticsService();
  }
  return analyticsService;
}
