/**
 * Platform Analytics Service
 * 
 * Handles all analytics API calls using the platform's request infrastructure
 * Ensures consistent API handling, caching, and remote deployment compatibility
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

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
    url: string;
    category: string;
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

export class PlatformAnalyticsService extends AdminApiSingleton {
  private static instance: PlatformAnalyticsService;

  private constructor() {
    super('platform-analytics', { encrypt: false });
  }

  public static getInstance(): PlatformAnalyticsService {
    if (!PlatformAnalyticsService.instance) {
      PlatformAnalyticsService.instance = new PlatformAnalyticsService();
    }
    return PlatformAnalyticsService.instance;
  }

  /**
   * Get overview metrics and KPIs
   */
  async getOverviewMetrics(filters: AnalyticsFilters = {}): Promise<OverviewMetrics> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        queryParams.append(key, value.toString());
      }
    });

    try {
      const result = await this.makeDefaultRequest<OverviewMetrics>(
        `/api/admin/analytics/overview?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!result || !result.data) {
        throw new Error('No data received from analytics API');
      }
      
      return result.data;
    } catch (error) {
      console.error('PlatformAnalyticsService.getOverviewMetrics error:', error);
      // Return fallback data to prevent UI crashes
      return {
        totalPageViews: 0,
        uniqueVisitors: 0,
        avgSessionDuration: 0,
        bounceRate: 0,
        topPageTypes: [],
        trends: {
          pageViewsChange: 0,
          visitorsChange: 0,
          durationChange: 0
        }
      };
    }
  }

  /**
   * Get page traffic analytics
   */
  async getPageTrafficAnalytics(filters: AnalyticsFilters = {}): Promise<PageTrafficData> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        queryParams.append(key, value.toString());
      }
    });

    try {
      const result = await this.makeDefaultRequest<PageTrafficData>(
        `/api/admin/analytics/page-traffic?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!result || !result.data) {
        throw new Error('No data received from analytics API');
      }
      
      return result.data;
    } catch (error) {
      console.error('PlatformAnalyticsService.getPageTrafficAnalytics error:', error);
      // Return fallback data to prevent UI crashes
      return {
        pageTypeBreakdown: [],
        topPages: []
      };
    }
  }

  /**
   * Get user behavior analytics
   */
  async getUserBehaviorAnalytics(filters: AnalyticsFilters = {}): Promise<UserBehaviorData> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        queryParams.append(key, value.toString());
      }
    });

    try {
      const result = await this.makeDefaultRequest<UserBehaviorData>(
        `/api/admin/analytics/user-behavior?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!result || !result.data) {
        throw new Error('No data received from analytics API');
      }
      
      return result.data;
    } catch (error) {
      console.error('PlatformAnalyticsService.getUserBehaviorAnalytics error:', error);
      // Return fallback data to prevent UI crashes
      return {
        journeyFunnel: [],
        engagementMetrics: {
          pagesPerSession: 0,
          sessionDuration: 0,
          returnVisitorRate: 0,
          clickThroughRate: 0
        },
        timeOfDayEngagement: []
      };
    }
  }

  /**
   * Get time series analytics
   */
  async getTimeSeriesAnalytics(filters: AnalyticsFilters = {}): Promise<TimeSeriesData> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        queryParams.append(key, value.toString());
      }
    });

    try {
      const result = await this.makeDefaultRequest<TimeSeriesData>(
        `/api/admin/analytics/time-series?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!result || !result.data) {
        throw new Error('No data received from analytics API');
      }
      
      return result.data;
    } catch (error) {
      console.error('PlatformAnalyticsService.getTimeSeriesAnalytics error:', error);
      // Return fallback data to prevent UI crashes
      return {
        dailyMetrics: [],
        trends: {
          currentPeriod: {
            pageViews: 0,
            uniqueVisitors: 0,
            sessions: 0,
            avgSessionDuration: 0
          },
          previousPeriod: {
            pageViews: 0,
            uniqueVisitors: 0,
            sessions: 0,
            avgSessionDuration: 0
          },
          changes: {
            pageViewsChange: 0,
            visitorsChange: 0,
            sessionsChange: 0,
            durationChange: 0
          }
        }
      };
    }
  }

  /**
   * Get popular content analytics
   */
  async getPopularContentAnalytics(filters: AnalyticsFilters = {}): Promise<PopularContentData> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        queryParams.append(key, value.toString());
      }
    });

    try {
      const result = await this.makeDefaultRequest<PopularContentData>(
        `/api/admin/analytics/popular-content?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!result || !result.data) {
        throw new Error('No data received from analytics API');
      }
      
      return result.data;
    } catch (error) {
      console.error('PlatformAnalyticsService.getPopularContentAnalytics error:', error);
      // Return fallback data to prevent UI crashes
      return {
        contentItems: [],
        contentByType: {
          stores: 0,
          products: 0,
          categories: 0
        }
      };
    }
  }

  /**
   * Get geographic analytics
   */
  async getGeographicAnalytics(filters: AnalyticsFilters = {}): Promise<GeographicData> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        queryParams.append(key, value.toString());
      }
    });

    try {
      const result = await this.makeDefaultRequest<GeographicData>(
        `/api/admin/analytics/geographic?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!result || !result.data) {
        throw new Error('No data received from analytics API');
      }
      
      return result.data;
    } catch (error) {
      console.error('PlatformAnalyticsService.getGeographicAnalytics error:', error);
      // Return fallback data to prevent UI crashes
      return {
        countries: [],
        cities: [],
        summary: {
          totalCountries: 0,
          totalUsers: 0,
          avgSessionDuration: 0
        }
      };
    }
  }

  /**
   * Export analytics data (for reporting)
   */
  async exportAnalyticsData(
    type: 'overview' | 'page-traffic' | 'user-behavior' | 'time-series' | 'popular-content' | 'geographic',
    filters: AnalyticsFilters = {},
    format: 'json' | 'csv' = 'json'
  ): Promise<Blob> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        queryParams.append(key, value.toString());
      }
    });
    
    queryParams.append('format', format);

    const response = await this.makeDefaultRequest<any>(
      `/api/admin/analytics/${type}/export?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Convert response to blob for download
    return new Blob([JSON.stringify(response)], { 
      type: format === 'csv' ? 'text/csv' : 'application/json' 
    });
  }

  /**
   * Get analytics health status
   */
  async getAnalyticsHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastDataUpdate: string;
    cacheStatus: string;
    databaseStatus: string;
  }> {
    const result = await this.makeDefaultRequest<{
      status: 'healthy' | 'degraded' | 'unhealthy';
      lastDataUpdate: string;
      cacheStatus: string;
      databaseStatus: string;
    }>(
      '/api/admin/analytics/health',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    return result.data;
  }

  /**
   * Refresh analytics cache
   */
  async refreshAnalyticsCache(): Promise<{
    success: boolean;
    message: string;
    refreshedEndpoints: string[];
  }> {
    const result = await this.makeDefaultRequest<{
      success: boolean;
      message: string;
      refreshedEndpoints: string[];
    }>(
      '/api/admin/analytics/refresh-cache',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    return result.data;
  }
}

// Export singleton instance
export const platformAnalyticsService = PlatformAnalyticsService.getInstance();
