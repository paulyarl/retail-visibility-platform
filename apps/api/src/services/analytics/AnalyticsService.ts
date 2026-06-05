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
      const singlePageSessions = await prisma.user_behavior_simple.groupBy({
        by: ['session_id'],
        where: dateFilter,
        _count: true,
        having: {
          id: {
            _count: {
              equals: 1
            }
          }
        }
      });

      const totalSessions = totalMetrics._count?.session_id || 0;
      const bounceSessions = singlePageSessions.length;
      const bounceRate = totalSessions > 0 ? (bounceSessions / totalSessions) * 100 : 0;

      const result: OverviewMetrics = {
        totalPageViews: totalMetrics._count?.id || 0,
        uniqueVisitors: totalMetrics._count?.user_id || 0,
        avgSessionDuration: totalMetrics._avg?.duration_seconds || 0,
        bounceRate,
        topPageTypes: pageTypeBreakdown.map((pt: any) => ({
          pageType: pt.page_type || 'unknown',
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
          const trend = await this.calculatePageTypeTrend(pt.page_type!, filters);
          const bounceRate = await this.calculateBounceRateForPageType(pt.page_type!, filters);

          return {
            pageType: pt.page_type || 'unknown',
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
        },
        take: 10
      });

      // Filter out null entity_id and entity_name in JavaScript
      const filteredTopPages = topPages.filter((page: any) => page.entity_id !== null && page.entity_name !== null);

      const result: PageTrafficData = {
        pageTypeBreakdown: pageTypeBreakdownWithTrends,
        topPages: filteredTopPages.map((page: any) => ({
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
        },
        take: 20
      });

      // Filter out null entity_id and entity_name in JavaScript
      const filteredPopularContent = popularContent.filter((item: any) => item.entity_id !== null && item.entity_name !== null);

      // Calculate trends and format content items
      const contentItems = await Promise.all(
        filteredPopularContent.map(async (item: any) => {
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

      // Get geographic data - simplified without raw queries
      const geoData = await prisma.user_behavior_simple.groupBy({
        by: ['location_lat', 'location_lng'],
        where: dateFilter,
        _count: {
          user_id: true,
          id: true
        },
        _avg: {
          duration_seconds: true
        }
      });

      // Filter out null locations in JavaScript
      const filteredGeoData = geoData.filter((item: any) => item.location_lat !== null && item.location_lng !== null);

      // Simplified region mapping
      const regionMap = new Map<string, { users: number; pageViews: number; duration: number }>();
      filteredGeoData.forEach(item => {
        let region = 'Other';
        const lat = item.location_lat?.toNumber() || 0;
        const lng = item.location_lng?.toNumber() || 0;
        
        if (lat >= 25 && lat <= 49 && lng >= -125 && lng <= -67) region = 'North America';
        else if (lat >= 35 && lat <= 72 && lng >= -10 && lng <= 40) region = 'Europe';
        else if (lat >= -50 && lat <= -10 && lng >= 110 && lng <= 180) region = 'Australia';
        
        const current = regionMap.get(region) || { users: 0, pageViews: 0, duration: 0 };
        regionMap.set(region, {
          users: current.users + (item._count.user_id || 0),
          pageViews: current.pageViews + item._count.id,
          duration: current.duration + (item._avg.duration_seconds || 0)
        });
      });

      const result: GeographicData = {
        countries: Array.from(regionMap.entries()).map(([region, data]) => ({
          country: region,
          region,
          users: data.users,
          pageViews: data.pageViews,
          avgSessionDuration: data.duration / (geoData.length || 1),
          bounceRate: 0, // Simplified
          trend: 0, // Simplified
        })).sort((a, b) => b.users - a.users).slice(0, 20),
        cities: filteredGeoData.slice(0, 20).map(item => ({
          city: `${item.location_lat?.toFixed(2)}, ${item.location_lng?.toFixed(2)}`,
          country: 'Unknown',
          users: item._count.user_id || 0,
          pageViews: item._count.id,
          avgSessionDuration: item._avg.duration_seconds || 0,
        })),
        summary: {
          totalCountries: regionMap.size,
          totalUsers: Array.from(regionMap.values()).reduce((sum, d) => sum + d.users, 0),
          avgSessionDuration: filteredGeoData.length > 0 
            ? Array.from(regionMap.values()).reduce((sum, d) => sum + d.duration, 0) / filteredGeoData.length 
            : 0
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
      filter.page_type = filters.pageType;
    }

    if (filters.entityType && filters.entityType !== 'all') {
      filter.entity_type = filters.entityType;
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
        page_type: pageType
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

    const bounceSessions = await prisma.user_behavior_simple.groupBy({
      by: ['session_id'],
      where: {
        ...dateFilter,
        page_type: pageType
      },
      _count: true,
      having: {
        id: {
          _count: {
            equals: 1
          }
        }
      }
    });

    const totalSessions = await prisma.user_behavior_simple.groupBy({
      by: ['session_id'],
      where: {
        ...dateFilter,
        page_type: pageType
      },
      _count: true
    });

    const totalSessionCount = totalSessions.length;
    const bounceCount = bounceSessions.length;

    return totalSessionCount > 0 ? (bounceCount / totalSessionCount) * 100 : 0;
  }

  private async getUsersAtJourneyStep(step: string, filters: AnalyticsFilters): Promise<number> {
    // Simplified journey step calculation - would need more complex logic for real funnel analysis
    const dateFilter = this.buildDateFilter(filters);

    // Map step names to actual logic - simplified for now
    const stepLogic: Record<string, any> = {
      'Landing Page': {}, // All users
      'Browse Directory': { page_type: 'directory' },
      'View Storefront': { page_type: 'storefront' },
      'View Products': { entity_type: 'product' },
      'Add to Cart': { entity_type: 'product' }, // Simplified - would need context tracking
      'Checkout': { entity_type: 'product' } // Simplified - would need context tracking
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
      'Browse Directory': { page_type: 'directory' },
      'View Storefront': { page_type: 'storefront' },
      'View Products': { entity_type: 'product' },
      'Add to Cart': { entity_type: 'product' }, // Simplified
      'Checkout': { entity_type: 'product' } // Simplified
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

    // Calculate various engagement metrics using Prisma methods
    const sessionStats = await prisma.user_behavior_simple.groupBy({
      by: ['session_id'],
      where: dateFilter,
      _count: true,
      _sum: {
        duration_seconds: true
      }
    });

    const pagesPerSession = sessionStats.length > 0 
      ? sessionStats.reduce((sum, s) => sum + s._count, 0) / sessionStats.length 
      : 0;
    const avgSessionDuration = sessionStats.length > 0
      ? sessionStats.reduce((sum, s) => sum + (s._sum.duration_seconds || 0), 0) / sessionStats.length
      : 0;

    // Return visitor calculation (simplified)
    const returnVisitors = await prisma.user_behavior_simple.groupBy({
      by: ['user_id'],
      where: dateFilter,
      _count: true,
      having: {
        id: {
          _count: {
            gt: 1 // More than one session
          }
        }
      }
    });

    // Filter out null user_ids in JavaScript
    const filteredReturnVisitors = returnVisitors.filter((v: any) => v.user_id !== null);

    return {
      pagesPerSession,
      sessionDuration: avgSessionDuration,
      returnVisitorRate: filteredReturnVisitors.length, // Simplified - would need proper calculation
      clickThroughRate: 0 // Would need more complex logic
    };
  }

  private async getTimeOfDayEngagement(filters: AnalyticsFilters): Promise<any[]> {
    const dateFilter = this.buildDateFilter(filters);

    // Get hourly data using Prisma methods
    const hourlyData = await prisma.user_behavior_simple.groupBy({
      by: ['timestamp'],
      where: dateFilter,
      _count: {
        user_id: true,
        id: true
      },
      _avg: {
        duration_seconds: true
      }
    });

    // Group by hour
    const hourMap = new Map<number, { users: number; views: number; duration: number }>();
    hourlyData.forEach(item => {
      const hour = item.timestamp ? new Date(item.timestamp).getHours() : 0;
      const current = hourMap.get(hour) || { users: 0, views: 0, duration: 0 };
      hourMap.set(hour, {
        users: current.users + (item._count.user_id || 0),
        views: current.views + item._count.id,
        duration: current.duration + (item._avg.duration_seconds || 0)
      });
    });

    // Map to time periods and calculate return visitors (simplified)
    return Array.from(hourMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hour, data]) => ({
        period: `${hour}:00`,
        pageViews: data.views,
        uniqueUsers: data.users,
        avgSessionDuration: data.duration / (hourlyData.length || 1),
        returnVisitors: Math.floor(data.users * 0.3) // Simplified
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

    const bounceSessions = await prisma.user_behavior_simple.groupBy({
      by: ['session_id'],
      where: dateFilter,
      _count: true,
      having: {
        id: {
          _count: {
            equals: 1
          }
        }
      }
    });

    const totalSessions = await prisma.user_behavior_simple.groupBy({
      by: ['session_id'],
      where: dateFilter,
      _count: true
    });

    const totalSessionCount = totalSessions?.length || 0;
    const bounceCount = bounceSessions.length;

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
