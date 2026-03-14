/**
 * Analytics Service
 * Handles data aggregation and queries for admin analytics dashboard
 */

import { prisma } from '../../prisma';
import { Prisma } from '@prisma/client';
import { BaseService } from '../BaseService';
import { getCacheService } from '../OverrideCacheService';

// Wrapper to adapt OverrideCacheService to expected interface
class AnalyticsCacheAdapter {
  private cacheService = getCacheService();

  async get(key: string) {
    try {
      const cached = await this.cacheService.getAnalytics('general', key);
      return cached?.data || null;
    } catch (error) {
      console.warn('[AnalyticsCacheAdapter] Cache get failed:', error);
      return null;
    }
  }

  async set(key: string, data: any, ttlSeconds: number) {
    try {
      await this.cacheService.setAnalytics('general', key, data);
    } catch (error) {
      console.warn('[AnalyticsCacheAdapter] Cache set failed:', error);
    }
  }
}

// No-op cache fallback for when Redis fails
class NoOpCacheAdapter {
  async get(key: string) {
    return null;
  }

  async set(key: string, data: any, ttlSeconds: number) {
    // Do nothing
  }
}

export interface AnalyticsFilters {
  period?: string;
  startDate?: string;
  endDate?: string;
  pageType?: string;
  entityType?: string;
  region?: string;
}

export interface OverviewMetrics {
  totalPageViews: number;
  uniqueVisitors: number;
  avgSessionDuration: number;
  bounceRate: number;
  topPageTypes: Array<{
    pageType: string;
    views: number;
    percentage: number;
  }>;
  trends: {
    pageViewsChange: number;
    visitorsChange: number;
    durationChange: number;
  };
}

export interface PageTrafficData {
  pageTypeBreakdown: Array<{
    pageType: string;
    views: number;
    uniqueVisitors: number;
    avgSessionDuration: number;
    bounceRate: number;
    trend: number;
  }>;
  topPages: Array<{
    path: string;
    title: string;
    views: number;
    uniqueVisitors: number;
    entityType: string;
    entityId: string;
    avgDuration: number;
  }>;
}

export interface UserBehaviorData {
  journeyFunnel: Array<{
    step: string;
    users: number;
    conversionRate: number;
    avgTime: number;
  }>;
  engagementMetrics: {
    pagesPerSession: number;
    sessionDuration: number;
    returnVisitorRate: number;
    clickThroughRate: number;
  };
  timeOfDayEngagement: Array<{
    period: string;
    pageViews: number;
    uniqueUsers: number;
    avgSessionDuration: number;
    returnVisitors: number;
  }>;
}

export interface TimeSeriesData {
  dailyMetrics: Array<{
    date: string;
    pageViews: number;
    uniqueVisitors: number;
    sessions: number;
    avgSessionDuration: number;
    bounceRate: number;
  }>;
  trends: {
    currentPeriod: {
      pageViews: number;
      uniqueVisitors: number;
      sessions: number;
      avgSessionDuration: number;
    };
    previousPeriod: {
      pageViews: number;
      uniqueVisitors: number;
      sessions: number;
      avgSessionDuration: number;
    };
    changes: {
      pageViewsChange: number;
      visitorsChange: number;
      sessionsChange: number;
      durationChange: number;
    };
  };
}

export interface PopularContentData {
  contentItems: Array<{
    id: string;
    name: string;
    type: 'store' | 'product' | 'category';
    views: number;
    uniqueVisitors: number;
    avgTimeOnPage: number;
    trend: number;
    url?: string;
    category?: string;
  }>;
  contentByType: {
    stores: number;
    products: number;
    categories: number;
  };
}

export interface GeographicData {
  countries: Array<{
    country: string;
    region: string;
    users: number;
    pageViews: number;
    avgSessionDuration: number;
    bounceRate: number;
    trend: number;
  }>;
  cities: Array<{
    city: string;
    country: string;
    users: number;
    pageViews: number;
    avgSessionDuration: number;
  }>;
  summary: {
    totalCountries: number;
    totalUsers: number;
    avgSessionDuration: number;
  };
}

export class AnalyticsService extends BaseService {
  private static instance: AnalyticsService;
  private cache: AnalyticsCacheAdapter | NoOpCacheAdapter;

  private constructor() {
    super();
    try {
      this.cache = new AnalyticsCacheAdapter();
    } catch (error) {
      console.warn('[AnalyticsService] Cache initialization failed, running without cache:', error);
      // Use no-op cache fallback
      this.cache = new NoOpCacheAdapter();
    }
  }

  private async safeCacheGet(key: string): Promise<any> {
    try {
      return await this.cache.get(key);
    } catch (error) {
      console.warn('[AnalyticsService] Cache read failed:', error);
      return null;
    }
  }

  private async safeCacheSet(key: string, data: any, ttlSeconds: number): Promise<void> {
    try {
      await this.cache.set(key, data, ttlSeconds);
    } catch (error) {
      console.warn('[AnalyticsService] Cache write failed:', error);
    }
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Get overview metrics for the analytics dashboard
   */
  async getOverviewMetrics(filters: AnalyticsFilters): Promise<OverviewMetrics> {
    const cacheKey = `analytics-overview-${JSON.stringify(filters)}`;
    const cached = await this.safeCacheGet(cacheKey);
    if (cached) return cached;

    try {
      const dateFilter = this.buildDateFilter(filters);

      // Get total metrics
      const totalMetrics = await prisma.user_behavior_simple.aggregate({
        where: dateFilter,
        _count: {
          id: true,
          user_id: true,
          session_id: true
        },
        _avg: {
          duration_seconds: true
        }
      });

      // Get page type breakdown
      const pageTypeBreakdown = await prisma.user_behavior_simple.groupBy({
        by: ['page_type'],
        where: dateFilter,
        _count: {
          id: true,
          user_id: true
        },
        _avg: {
          duration_seconds: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        }
      });

      // Calculate trends (compare with previous period)
      const trends = await this.calculateTrends(filters);

      // Calculate bounce rate (simplified: sessions with only 1 page view)
      const singlePageSessions = await prisma.$queryRaw`
        SELECT COUNT(*) as bounce_sessions
        FROM (
          SELECT session_id
          FROM user_behavior_simple
          WHERE ${dateFilter.timestamp ? Prisma.sql`timestamp >= ${dateFilter.timestamp.gte} AND timestamp <= ${dateFilter.timestamp.lte}` : Prisma.sql`true`}
          GROUP BY session_id
          HAVING COUNT(*) = 1
        ) as single_page_sessions
      `;

      const totalSessions = totalMetrics._count?.session_id || 0;
      const bounceSessions = (singlePageSessions as any)[0]?.bounce_sessions || 0;
      const bounceRate = totalSessions > 0 ? (bounceSessions / totalSessions) * 100 : 0;

      const result: OverviewMetrics = {
        totalPageViews: totalMetrics._count?.id || 0,
        uniqueVisitors: totalMetrics._count?.user_id || 0,
        avgSessionDuration: totalMetrics._avg?.duration_seconds || 0,
        bounceRate,
        topPageTypes: pageTypeBreakdown.map((pt: any) => ({
          pageType: pt.pageType || 'unknown',
          views: pt._count.id,
          percentage: totalMetrics._count.id > 0 ? (pt._count.id / totalMetrics._count.id) * 100 : 0
        })),
        trends
      };

      await this.safeCacheSet(cacheKey, result, 300); // Cache for 5 minutes
      return result;
    } catch (error) {
      console.error('[AnalyticsService] Error getting overview metrics:', error);
      throw error;
    }
  }

  /**
   * Get page traffic analytics
   */
  async getPageTrafficAnalytics(filters: AnalyticsFilters): Promise<PageTrafficData> {
    const cacheKey = `analytics-page-traffic-${JSON.stringify(filters)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const dateFilter = this.buildDateFilter(filters);

      // Page type breakdown with trends
      const pageTypeBreakdown = await prisma.user_behavior_simple.groupBy({
        by: ['page_type'],
        where: dateFilter,
        _count: {
          id: true,
          user_id: true,
          session_id: true
        },
        _avg: {
          duration_seconds: true
        }
      });

      // Calculate trends for each page type
      const pageTypeBreakdownWithTrends = await Promise.all(
        pageTypeBreakdown.map(async (pt: any) => {
          const trend = await this.calculatePageTypeTrend(pt.pageType!, filters);
          const bounceRate = await this.calculateBounceRateForPageType(pt.pageType!, filters);

          return {
            pageType: pt.pageType || 'unknown',
            views: pt._count.id,
            uniqueVisitors: pt._count.user_id || 0,
            avgSessionDuration: pt._avg.duration_seconds || 0,
            bounceRate,
            trend
          };
        })
      );

      // Get top pages
      const topPages = await prisma.user_behavior_simple.groupBy({
        by: ['entity_id', 'entity_name', 'entity_type', 'page_type'],
        where: {
          ...dateFilter,
          entity_id: { not: null },
          entity_name: { not: null }
        },
        _count: {
          id: true,
          user_id: true
        },
        _avg: {
          duration_seconds: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: 10
      });

      const result: PageTrafficData = {
        pageTypeBreakdown: pageTypeBreakdownWithTrends,
        topPages: topPages.map((page: any) => ({
          path: `/${page.page_type}/${page.entity_id}`,
          title: page.entity_name || 'Unknown',
          views: page._count.id,
          uniqueVisitors: page._count.user_id || 0,
          entityType: page.entity_type || 'unknown',
          entityId: page.entity_id!,
          avgDuration: page._avg.duration_seconds || 0
        }))
      };

      await this.cache.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      console.error('[AnalyticsService] Error getting page traffic analytics:', error);
      throw error;
    }
  }

  /**
   * Get user behavior analytics
   */
  async getUserBehaviorAnalytics(filters: AnalyticsFilters): Promise<UserBehaviorData> {
    const cacheKey = `analytics-user-behavior-${JSON.stringify(filters)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const dateFilter = this.buildDateFilter(filters);

      // Simplified journey funnel (would need more complex logic for real implementation)
      const journeySteps = [
        'Landing Page',
        'Browse Directory',
        'View Storefront',
        'View Products',
        'Add to Cart',
        'Checkout'
      ];

      const journeyFunnel = await Promise.all(
        journeySteps.map(async (step, index) => {
          const users = await this.getUsersAtJourneyStep(step, filters);
          const conversionRate = index === 0 ? 100 : await this.calculateConversionRate(index, filters);
          const avgTime = await this.getAvgTimeAtStep(step, filters);

          return {
            step,
            users,
            conversionRate,
            avgTime
          };
        })
      );

      // Engagement metrics
      const engagementMetrics = await this.calculateEngagementMetrics(filters);

      // Time of day engagement
      const timeOfDayEngagement = await this.getTimeOfDayEngagement(filters);

      const result: UserBehaviorData = {
        journeyFunnel,
        engagementMetrics,
        timeOfDayEngagement
      };

      await this.cache.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      console.error('[AnalyticsService] Error getting user behavior analytics:', error);
      throw error;
    }
  }

  /**
   * Get time series analytics
   */
  async getTimeSeriesAnalytics(filters: AnalyticsFilters): Promise<TimeSeriesData> {
    const cacheKey = `analytics-time-series-${JSON.stringify(filters)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const { period = 'month' } = filters;
      const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;

      // Generate daily metrics for the specified period
      const dailyMetrics = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const dayFilter = {
          ...this.buildDateFilter(filters),
          timestamp: {
            gte: new Date(dateStr + ' 00:00:00'),
            lt: new Date(dateStr + ' 23:59:59')
          }
        };

        const dayMetrics = await prisma.user_behavior_simple.aggregate({
          where: dayFilter,
          _count: {
            id: true,
            user_id: true,
            session_id: true
          },
          _avg: {
            duration_seconds: true
          }
        });

        dailyMetrics.push({
          date: dateStr,
          pageViews: dayMetrics._count?.id || 0,
          uniqueVisitors: dayMetrics._count?.user_id || 0,
          sessions: dayMetrics._count?.session_id || 0,
          avgSessionDuration: dayMetrics._avg?.duration_seconds || 0,
          bounceRate: await this.calculateBounceRateForDate(dateStr, filters)
        });
      }

      // Calculate trends
      const trends = await this.calculatePeriodTrends(dailyMetrics, period);

      const result: TimeSeriesData = {
        dailyMetrics,
        trends
      };

      await this.cache.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      console.error('[AnalyticsService] Error getting time series analytics:', error);
      throw error;
    }
  }

  /**
   * Get popular content analytics
   */
  async getPopularContentAnalytics(filters: AnalyticsFilters): Promise<PopularContentData> {
    const cacheKey = `analytics-popular-content-${JSON.stringify(filters)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const dateFilter = this.buildDateFilter(filters);

      // Get popular content by entity type
      const popularContent = await prisma.user_behavior_simple.groupBy({
        by: ['entity_id', 'entity_name', 'entity_type'],
        where: {
          ...dateFilter,
          entity_id: { not: null },
          entity_name: { not: null }
        },
        _count: {
          id: true,
          user_id: true
        },
        _avg: {
          duration_seconds: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: 20
      });

      // Calculate trends and format content items
      const contentItems = await Promise.all(
        popularContent.map(async (item: any) => {
          const trend = await this.calculateContentTrend(item.entity_id!, filters);

          return {
            id: item.entity_id!,
            name: item.entity_name || 'Unknown',
            type: (item.entity_type as 'store' | 'product' | 'category') || 'store',
            views: item._count.id,
            uniqueVisitors: item._count.user_id || 0,
            avgTimeOnPage: item._avg.duration_seconds || 0,
            trend,
            url: `/${item.entity_type}/${item.entity_id}`,
            category: item.entity_type
          };
        })
      );

      // Content by type summary
      const contentByType = {
        stores: contentItems.filter(item => item.type === 'store').length,
        products: contentItems.filter(item => item.type === 'product').length,
        categories: contentItems.filter(item => item.type === 'category').length
      };

      const result: PopularContentData = {
        contentItems,
        contentByType
      };

      await this.cache.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      console.error('[AnalyticsService] Error getting popular content analytics:', error);
      throw error;
    }
  }

  /**
   * Get geographic analytics
   */
  async getGeographicAnalytics(filters: AnalyticsFilters): Promise<GeographicData> {
    const cacheKey = `analytics-geographic-${JSON.stringify(filters)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const dateFilter = this.buildDateFilter(filters);

      // Get geographic data aggregated by location
      const geoData = await prisma.$queryRaw`
        SELECT
          CASE
            WHEN location_lat BETWEEN 25 AND 49 AND location_lng BETWEEN -125 AND -67 THEN 'North America'
            WHEN location_lat BETWEEN 35 AND 72 AND location_lng BETWEEN -10 AND 40 THEN 'Europe'
            WHEN location_lat BETWEEN -50 AND -10 AND location_lng BETWEEN 110 AND 180 THEN 'Australia'
            ELSE 'Other'
          END as region,
          COUNT(DISTINCT user_id) as users,
          COUNT(*) as page_views,
          AVG(duration_seconds) as avg_duration
        FROM user_behavior_simple
        WHERE location_lat IS NOT NULL
          AND location_lng IS NOT NULL
          ${dateFilter.timestamp ? Prisma.sql`AND timestamp >= ${dateFilter.timestamp.gte} AND timestamp <= ${dateFilter.timestamp.lte}` : Prisma.empty}
        GROUP BY region
        ORDER BY users DESC
      ` as any[];

      // For cities, we'd need reverse geocoding - simplified version
      const cities = await prisma.$queryRaw`
        SELECT
          ROUND(location_lat::numeric, 2) as lat_rounded,
          ROUND(location_lng::numeric, 2) as lng_rounded,
          COUNT(DISTINCT user_id) as users,
          COUNT(*) as page_views,
          AVG(duration_seconds) as avg_duration
        FROM user_behavior_simple
        WHERE location_lat IS NOT NULL
          AND location_lng IS NOT NULL
          ${dateFilter.timestamp ? Prisma.sql`AND timestamp >= ${dateFilter.timestamp.gte} AND timestamp <= ${dateFilter.timestamp.lte}` : Prisma.empty}
        GROUP BY lat_rounded, lng_rounded
        ORDER BY users DESC
        LIMIT 20
      ` as any[];

      const result: GeographicData = {
        countries: geoData.map(item => ({
          country: item.region, // Simplified - would need proper country mapping
          region: item.region,
          users: parseInt(item.users),
          pageViews: parseInt(item.page_views),
          avgSessionDuration: parseFloat(item.avg_duration) || 0,
          bounceRate: 0, // Would need more complex calculation
          trend: 0 // Would need trend calculation
        })),
        cities: cities.map(city => ({
          city: `${city.lat_rounded}, ${city.lng_rounded}`, // Would need reverse geocoding
          country: 'Unknown', // Would need reverse geocoding
          users: parseInt(city.users),
          pageViews: parseInt(city.page_views),
          avgSessionDuration: parseFloat(city.avg_duration) || 0
        })),
        summary: {
          totalCountries: geoData.length,
          totalUsers: geoData.reduce((sum, item) => sum + parseInt(item.users), 0),
          avgSessionDuration: geoData.length > 0 ?
            geoData.reduce((sum, item) => sum + parseFloat(item.avg_duration || 0), 0) / geoData.length : 0
        }
      };

      await this.cache.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      console.error('[AnalyticsService] Error getting geographic analytics:', error);
      throw error;
    }
  }

  // Helper methods for complex calculations

  private buildDateFilter(filters: AnalyticsFilters) {
    const filter: any = {};

    if (filters.startDate && filters.endDate) {
      filter.timestamp = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate)
      };
    } else if (filters.period) {
      const now = new Date();
      const periods = {
        day: 1,
        week: 7,
        month: 30,
        quarter: 90,
        year: 365
      };
      const days = periods[filters.period as keyof typeof periods] || 7;
      filter.timestamp = {
        gte: new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      };
    }

    if (filters.pageType && filters.pageType !== 'all') {
      filter.pageType = filters.pageType;
    }

    if (filters.entityType && filters.entityType !== 'all') {
      filter.entityType = filters.entityType;
    }

    return filter;
  }

  private async calculateTrends(filters: AnalyticsFilters) {
    // Simplified trend calculation - compare current period with previous period
    const currentPeriod = await this.getMetricsForPeriod(filters);
    const previousPeriodFilters = { ...filters, period: this.getPreviousPeriod(filters.period || 'week') };
    const previousPeriod = await this.getMetricsForPeriod(previousPeriodFilters);

    return {
      pageViewsChange: this.calculatePercentageChange(currentPeriod.pageViews, previousPeriod.pageViews),
      visitorsChange: this.calculatePercentageChange(currentPeriod.visitors, previousPeriod.visitors),
      durationChange: this.calculatePercentageChange(currentPeriod.avgDuration, previousPeriod.avgDuration)
    };
  }

  private async getMetricsForPeriod(filters: AnalyticsFilters) {
    const dateFilter = this.buildDateFilter(filters);
    const metrics = await prisma.user_behavior_simple.aggregate({
      where: dateFilter,
      _count: {
        id: true,
        user_id: true
      },
      _avg: {
        duration_seconds: true
      }
    });

    return {
      pageViews: metrics._count?.id || 0,
      visitors: metrics._count?.user_id || 0,
      avgDuration: metrics._avg?.duration_seconds || 0
    };
  }

  private getPreviousPeriod(period: string): string {
    const periodMap: Record<string, string> = {
      day: 'day',
      week: 'week',
      month: 'month',
      quarter: 'quarter',
      year: 'year'
    };
    return periodMap[period] || 'week';
  }

  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  // Additional helper methods would be implemented for:
  // - calculatePageTypeTrend
  // - calculateBounceRateForPageType
  // - getUsersAtJourneyStep
  // - calculateConversionRate
  // - getAvgTimeAtStep
  // - calculateEngagementMetrics
  // - getTimeOfDayEngagement
  // - calculateBounceRateForDate
  // - calculatePeriodTrends
  // - calculateContentTrend

  // These would require more complex SQL queries and business logic

  private async calculatePageTypeTrend(pageType: string, filters: AnalyticsFilters): Promise<number> {
    // Simplified trend calculation for page type
    const currentPeriod = await this.getMetricsForPageType(pageType, filters);
    const previousPeriodFilters = { ...filters, period: this.getPreviousPeriod(filters.period || 'week') };
    const previousPeriod = await this.getMetricsForPageType(pageType, previousPeriodFilters);

    return this.calculatePercentageChange(currentPeriod.views, previousPeriod.views);
  }

  private async getMetricsForPageType(pageType: string, filters: AnalyticsFilters) {
    const dateFilter = this.buildDateFilter(filters);
    const metrics = await prisma.user_behavior_simple.aggregate({
      where: {
        ...dateFilter,
        pageType
      },
      _count: {
        id: true
      }
    });

    return {
      views: metrics._count.id
    };
  }

  private async calculateBounceRateForPageType(pageType: string, filters: AnalyticsFilters): Promise<number> {
    // Simplified bounce rate calculation - sessions with only one page view for this page type
    const dateFilter = this.buildDateFilter(filters);

    const bounceSessions = await prisma.$queryRaw`
      SELECT COUNT(*) as bounce_count
      FROM (
        SELECT session_id
        FROM user_behavior_simple
        WHERE page_type = ${pageType}
          ${dateFilter.timestamp ? Prisma.sql`AND timestamp >= ${dateFilter.timestamp.gte} AND timestamp <= ${dateFilter.timestamp.lte}` : Prisma.empty}
        GROUP BY session_id
        HAVING COUNT(*) = 1
      ) as bounce_sessions
    ` as any[];

    const totalSessions = await prisma.user_behavior_simple.groupBy({
      by: ['session_id'],
      where: {
        ...dateFilter,
        page_type: pageType
      },
      _count: true
    });

    const totalSessionCount = totalSessions.length;
    const bounceCount = bounceSessions[0]?.bounce_count || 0;

    return totalSessionCount > 0 ? (bounceCount / totalSessionCount) * 100 : 0;
  }

  private async getUsersAtJourneyStep(step: string, filters: AnalyticsFilters): Promise<number> {
    // Simplified journey step calculation - would need more complex logic for real funnel analysis
    const dateFilter = this.buildDateFilter(filters);

    // Map step names to actual logic - simplified for now
    const stepLogic: Record<string, any> = {
      'Landing Page': {}, // All users
      'Browse Directory': { pageType: 'directory' },
      'View Storefront': { pageType: 'storefront' },
      'View Products': { entityType: 'product' },
      'Add to Cart': { context: { path: ['add_to_cart'] } }, // Would need JSON path query
      'Checkout': { context: { path: ['checkout'] } } // Would need JSON path query
    };

    const stepFilter = stepLogic[step] || {};

    const metrics = await prisma.user_behavior_simple.aggregate({
      where: {
        ...dateFilter,
        ...stepFilter
      },
      _count: {
        user_id: true
      }
    });

    return metrics._count?.user_id || 0;
  }

  private async calculateConversionRate(stepIndex: number, filters: AnalyticsFilters): Promise<number> {
    // Simplified conversion rate - would need proper funnel logic
    const currentStepUsers = await this.getUsersAtJourneyStep(['Landing Page', 'Browse Directory', 'View Storefront', 'View Products', 'Add to Cart', 'Checkout'][stepIndex], filters);
    const previousStepUsers = await this.getUsersAtJourneyStep(['Landing Page', 'Browse Directory', 'View Storefront', 'View Products', 'Add to Cart', 'Checkout'][stepIndex - 1], filters);

    return previousStepUsers > 0 ? (currentStepUsers / previousStepUsers) * 100 : 0;
  }

  private async getAvgTimeAtStep(step: string, filters: AnalyticsFilters): Promise<number> {
    const dateFilter = this.buildDateFilter(filters);
    const stepLogic: Record<string, any> = {
      'Landing Page': {},
      'Browse Directory': { pageType: 'directory' },
      'View Storefront': { pageType: 'storefront' },
      'View Products': { entityType: 'product' },
      'Add to Cart': { context: { path: ['add_to_cart'] } },
      'Checkout': { context: { path: ['checkout'] } }
    };

    const stepFilter = stepLogic[step] || {};

    const metrics = await prisma.user_behavior_simple.aggregate({
      where: {
        ...dateFilter,
        ...stepFilter
      },
      _avg: {
        duration_seconds: true
      }
    });

    return metrics._avg.duration_seconds || 0;
  }

  private async calculateEngagementMetrics(filters: AnalyticsFilters): Promise<any> {
    const dateFilter = this.buildDateFilter(filters);

    // Calculate various engagement metrics
    const sessionMetrics = await prisma.$queryRaw`
      SELECT
        AVG(page_count) as pages_per_session,
        AVG(duration_sum) as avg_session_duration
      FROM (
        SELECT
          session_id,
          COUNT(*) as page_count,
          SUM(duration_seconds) as duration_sum
        FROM user_behavior_simple
        WHERE ${dateFilter.timestamp ? Prisma.sql`timestamp >= ${dateFilter.timestamp.gte} AND timestamp <= ${dateFilter.timestamp.lte}` : Prisma.sql`true`}
        GROUP BY session_id
      ) as session_stats
    ` as any[];

    // Return visitor calculation (simplified)
    const returnVisitors = await prisma.user_behavior_simple.groupBy({
      by: ['user_id'],
      where: {
        ...dateFilter,
        user_id: { not: null }
      },
      _count: true,
      having: {
        id: {
          _count: {
            gt: 1 // More than one session
          }
        }
      }
    });

    return {
      pagesPerSession: sessionMetrics[0]?.pages_per_session || 0,
      sessionDuration: sessionMetrics[0]?.avg_session_duration || 0,
      returnVisitorRate: returnVisitors.length, // Simplified - would need proper calculation
      clickThroughRate: 0 // Would need more complex logic
    };
  }

  private async getTimeOfDayEngagement(filters: AnalyticsFilters): Promise<any[]> {
    const dateFilter = this.buildDateFilter(filters);

    const hourlyData = await prisma.$queryRaw`
      SELECT
        EXTRACT(HOUR FROM timestamp) as hour,
        COUNT(DISTINCT user_id) as users,
        COUNT(*) as views,
        AVG(duration_seconds) as avg_duration
      FROM user_behavior_simple
      WHERE ${dateFilter.timestamp ? Prisma.sql`timestamp >= ${dateFilter.timestamp.gte} AND timestamp <= ${dateFilter.timestamp.lte}` : Prisma.sql`true`}
      GROUP BY EXTRACT(HOUR FROM timestamp)
      ORDER BY hour
    ` as any[];

    // Map to time periods and calculate return visitors (simplified)
    return hourlyData.map((hour: any) => ({
      period: `${hour.hour}:00`,
      pageViews: parseInt(hour.views),
      uniqueUsers: parseInt(hour.users),
      avgSessionDuration: parseFloat(hour.avg_duration) || 0,
      returnVisitors: Math.floor(parseInt(hour.users) * 0.3) // Simplified
    }));
  }

  private async calculateBounceRateForDate(dateStr: string, filters: AnalyticsFilters): Promise<number> {
    const dateFilter = {
      ...this.buildDateFilter(filters),
      timestamp: {
        gte: new Date(dateStr + ' 00:00:00'),
        lt: new Date(dateStr + ' 23:59:59')
      }
    };

    const bounceSessions = await prisma.$queryRaw`
      SELECT COUNT(*) as bounce_count
      FROM (
        SELECT session_id
        FROM user_behavior_simple
        WHERE ${Prisma.sql`timestamp >= ${dateFilter.timestamp.gte} AND timestamp <= ${dateFilter.timestamp.lte}`}
        GROUP BY session_id
        HAVING COUNT(*) = 1
      ) as bounce_sessions
    ` as any[];

    const totalSessions = await prisma.user_behavior_simple.groupBy({
      by: ['session_id'],
      where: dateFilter,
      _count: true
    });

    const totalSessionCount = totalSessions?.length || 0;
    const bounceCount = bounceSessions[0]?.bounce_count || 0;

    return totalSessionCount > 0 ? (bounceCount / totalSessionCount) * 100 : 0;
  }

  private async calculatePeriodTrends(dailyMetrics: any[], period: string): Promise<any> {
    const midPoint = Math.floor(dailyMetrics.length / 2);
    const currentPeriod = dailyMetrics.slice(midPoint);
    const previousPeriod = dailyMetrics.slice(0, midPoint);

    const currentAvg = {
      pageViews: currentPeriod.reduce((sum, day) => sum + day.pageViews, 0) / currentPeriod.length,
      uniqueVisitors: currentPeriod.reduce((sum, day) => sum + day.uniqueVisitors, 0) / currentPeriod.length,
      sessions: currentPeriod.reduce((sum, day) => sum + day.sessions, 0) / currentPeriod.length,
      avgSessionDuration: currentPeriod.reduce((sum, day) => sum + day.avgSessionDuration, 0) / currentPeriod.length
    };

    const previousAvg = {
      pageViews: previousPeriod.reduce((sum, day) => sum + day.pageViews, 0) / previousPeriod.length,
      uniqueVisitors: previousPeriod.reduce((sum, day) => sum + day.uniqueVisitors, 0) / previousPeriod.length,
      sessions: previousPeriod.reduce((sum, day) => sum + day.sessions, 0) / previousPeriod.length,
      avgSessionDuration: previousPeriod.reduce((sum, day) => sum + day.avgSessionDuration, 0) / previousPeriod.length
    };

    return {
      currentPeriod: currentAvg,
      previousPeriod: previousAvg,
      changes: {
        pageViewsChange: this.calculatePercentageChange(currentAvg.pageViews, previousAvg.pageViews),
        visitorsChange: this.calculatePercentageChange(currentAvg.uniqueVisitors, previousAvg.uniqueVisitors),
        sessionsChange: this.calculatePercentageChange(currentAvg.sessions, previousAvg.sessions),
        durationChange: this.calculatePercentageChange(currentAvg.avgSessionDuration, previousAvg.avgSessionDuration)
      }
    };
  }

  private async calculateContentTrend(entityId: string, filters: AnalyticsFilters): Promise<number> {
    // Simplified trend calculation for content items
    const currentPeriod = await this.getContentMetricsForPeriod(entityId, filters);
    const previousPeriodFilters = { ...filters, period: this.getPreviousPeriod(filters.period || 'week') };
    const previousPeriod = await this.getContentMetricsForPeriod(entityId, previousPeriodFilters);

    return this.calculatePercentageChange(currentPeriod.views, previousPeriod.views);
  }

  private async getContentMetricsForPeriod(entityId: string, filters: AnalyticsFilters) {
    const dateFilter = this.buildDateFilter(filters);
    const metrics = await prisma.user_behavior_simple.aggregate({
      where: {
        ...dateFilter,
        entity_id: entityId
      },
      _count: {
        id: true
      }
    });

    return {
      views: metrics._count.id
    };
  }
}
