/**
 * Advanced Analytics Service
 * 
 * Comprehensive analytics service with real-time tracking and insights
 * Integrates with platform caching and data warehouse
 */

import { ApiSystemSingleton } from '@/providers/base/ApiSystemSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface AnalyticsEvent {
  type: 'page_view' | 'product_view' | 'add_to_cart' | 'purchase' | 'search' | 'filter' | 'review' | 'share' | 'wishlist';
  userId?: string;
  sessionId: string;
  productId?: string;
  categoryId?: string;
  tenantId?: string;
  properties: Record<string, any>;
  timestamp: Date;
  location?: { lat: number; lng: number };
  device: {
    type: 'mobile' | 'desktop' | 'tablet';
    os?: string;
    browser?: string;
  };
  referrer?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}

export interface AnalyticsMetrics {
  pageViews: {
    total: number;
    unique: number;
    bounceRate: number;
    avgSessionDuration: number;
  };
  products: {
    totalViews: number;
    uniqueProducts: number;
    topProducts: Array<{
      productId: string;
      views: number;
      addToCarts: number;
      purchases: number;
      conversionRate: number;
    }>;
  };
  conversion: {
    addToCartRate: number;
    purchaseRate: number;
    revenue: number;
    averageOrderValue: number;
  };
  engagement: {
    timeOnPage: number;
    scrollDepth: number;
    interactions: number;
    shares: number;
    reviews: number;
  };
  geographic: {
    topRegions: Array<{
      region: string;
      users: number;
      sessions: number;
      conversionRate: number;
    }>;
  };
  performance: {
    pageLoadTime: number;
    apiResponseTime: number;
    errorRate: number;
  };
}

export interface RealTimeMetrics {
  activeUsers: number;
  currentSessions: number;
  liveEvents: AnalyticsEvent[];
  trendingProducts: Array<{
    productId: string;
    views: number;
    trend: 'up' | 'down' | 'stable';
    change: number;
  }>;
  conversionFunnel: {
    visitors: number;
    productViews: number;
    addToCarts: number;
    checkouts: number;
    purchases: number;
  };
}

/**
 * Advanced Analytics Service
 * 
 * Provides comprehensive analytics with real-time tracking
 * Leverages platform caching and optimized data pipelines
 */
class AdvancedAnalyticsService extends ApiSystemSingleton {
  private static instance: AdvancedAnalyticsService;
  private eventQueue: AnalyticsEvent[] = [];
  private isProcessingQueue = false;
  private sessionId: string;

  private constructor() {
    super('advanced-analytics-service', { encrypt: false });
    this.sessionId = this.generateSessionId();
    this.initializeEventTracking();
  }

  public static getInstance(): AdvancedAnalyticsService {
    if (!AdvancedAnalyticsService.instance) {
      AdvancedAnalyticsService.instance = new AdvancedAnalyticsService();
    }
    return AdvancedAnalyticsService.instance;
  }

  /**
   * Initialize event tracking
   */
  private initializeEventTracking(): void {
    // Track page views
    if (typeof window !== 'undefined') {
      this.trackPageView();
      
      // Track page unload
      window.addEventListener('beforeunload', () => {
        this.flushEventQueue();
      });
      
      // Track visibility changes
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushEventQueue();
        }
      });
    }
  }

  /**
   * Track page view event
   */
  trackPageView(path?: string, properties: Record<string, any> = {}): void {
    const event: AnalyticsEvent = {
      type: 'page_view',
      sessionId: this.sessionId,
      properties: {
        path: path || (typeof window !== 'undefined' ? window.location.pathname : ''),
        title: typeof document !== 'undefined' ? document.title : '',
        ...properties
      },
      timestamp: new Date(),
      device: this.getDeviceInfo(),
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      utm: this.getUTMParameters()
    };

    this.queueEvent(event);
  }

  /**
   * Track product view event
   */
  trackProductView(
    productId: string,
    properties: Record<string, any> = {}
  ): void {
    const event: AnalyticsEvent = {
      type: 'product_view',
      productId,
      sessionId: this.sessionId,
      properties,
      timestamp: new Date(),
      device: this.getDeviceInfo(),
      utm: this.getUTMParameters()
    };

    this.queueEvent(event);
  }

  /**
   * Track add to cart event
   */
  trackAddToCart(
    productId: string,
    quantity: number = 1,
    price: number,
    properties: Record<string, any> = {}
  ): void {
    const event: AnalyticsEvent = {
      type: 'add_to_cart',
      productId,
      sessionId: this.sessionId,
      properties: {
        quantity,
        price,
        ...properties
      },
      timestamp: new Date(),
      device: this.getDeviceInfo(),
      utm: this.getUTMParameters()
    };

    this.queueEvent(event);
  }

  /**
   * Track purchase event
   */
  trackPurchase(
    orderId: string,
    products: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>,
    totalAmount: number,
    properties: Record<string, any> = {}
  ): void {
    const event: AnalyticsEvent = {
      type: 'purchase',
      sessionId: this.sessionId,
      properties: {
        orderId,
        products,
        totalAmount,
        ...properties
      },
      timestamp: new Date(),
      device: this.getDeviceInfo(),
      utm: this.getUTMParameters()
    };

    this.queueEvent(event);
  }

  /**
   * Track search event
   */
  trackSearch(
    query: string,
    results: number,
    filters: Record<string, any> = {}
  ): void {
    const event: AnalyticsEvent = {
      type: 'search',
      sessionId: this.sessionId,
      properties: {
        query,
        results,
        filters
      },
      timestamp: new Date(),
      device: this.getDeviceInfo(),
      utm: this.getUTMParameters()
    };

    this.queueEvent(event);
  }

  /**
   * Track filter event
   */
  trackFilter(
    category: string,
    filters: Record<string, any>,
    results: number
  ): void {
    const event: AnalyticsEvent = {
      type: 'filter',
      sessionId: this.sessionId,
      properties: {
        category,
        filters,
        results
      },
      timestamp: new Date(),
      device: this.getDeviceInfo(),
      utm: this.getUTMParameters()
    };

    this.queueEvent(event);
  }

  /**
   * Track review event
   */
  trackReview(
    productId: string,
    rating: number,
    properties: Record<string, any> = {}
  ): void {
    const event: AnalyticsEvent = {
      type: 'review',
      productId,
      sessionId: this.sessionId,
      properties: {
        rating,
        ...properties
      },
      timestamp: new Date(),
      device: this.getDeviceInfo(),
      utm: this.getUTMParameters()
    };

    this.queueEvent(event);
  }

  /**
   * Track share event
   */
  trackShare(
    productId: string,
    platform: 'facebook' | 'twitter' | 'linkedin' | 'email' | 'whatsapp' | 'other',
    properties: Record<string, any> = {}
  ): void {
    const event: AnalyticsEvent = {
      type: 'share',
      productId,
      sessionId: this.sessionId,
      properties: {
        platform,
        ...properties
      },
      timestamp: new Date(),
      device: this.getDeviceInfo(),
      utm: this.getUTMParameters()
    };

    this.queueEvent(event);
  }

  /**
   * Track wishlist event
   */
  trackWishlist(
    productId: string,
    action: 'add' | 'remove',
    properties: Record<string, any> = {}
  ): void {
    const event: AnalyticsEvent = {
      type: 'wishlist',
      productId,
      sessionId: this.sessionId,
      properties: {
        action,
        ...properties
      },
      timestamp: new Date(),
      device: this.getDeviceInfo(),
      utm: this.getUTMParameters()
    };

    this.queueEvent(event);
  }
 
  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    try {
      const response = await this.makeEnhancedDefaultRequest<{
        metrics: RealTimeMetrics;
      }>(
        '/behavior/metrics',
        {},
        'analytics-realtime',
        30 * 1000 // 30 seconds cache for real-time data
      );

      if (!response.success) {
        clientLogger.error('[AdvancedAnalyticsService] Failed to get real-time metrics:', { detail: response.error });
        return this.getDefaultRealTimeMetrics();
      }

      return response.data?.metrics || this.getDefaultRealTimeMetrics();
    } catch (error) {
      clientLogger.error('[AdvancedAnalyticsService] Error getting real-time metrics:', { detail: error });
      return this.getDefaultRealTimeMetrics();
    }
  }

  /**
   * Get product performance analytics
   */
  async getProductPerformance(
    productId: string,
    timeRange: '24h' | '7d' | '30d' = '7d'
  ): Promise<{
    views: number;
    uniqueViews: number;
    addToCarts: number;
    purchases: number;
    revenue: number;
    conversionRate: number;
    averageRating: number;
    reviewCount: number;
    trending: 'up' | 'down' | 'stable';
    comparison: {
      previousPeriod: number;
      change: number;
      changePercent: number;
    };
  }> {
    try {
      const cacheKey = `analytics-product-${productId}-${timeRange}`;
      
      const response = await this.makeEnhancedDefaultRequest<{
        performance: any;
      }>(
        `/behavior/analytics?hours=${this.timeRangeToHours(timeRange)}`,
        {},
        cacheKey,
        10 * 60 * 1000 // 10 minutes cache for product analytics
      );

      if (!response.success) {
        clientLogger.error('[AdvancedAnalyticsService] Failed to get product performance:', { detail: response.error });
        return this.getDefaultProductPerformance();
      }

      return response.data?.performance || this.getDefaultProductPerformance();
    } catch (error) {
      clientLogger.error('[AdvancedAnalyticsService] Error getting product performance:', { detail: error });
      return this.getDefaultProductPerformance();
    }
  }

  /**
   * Get user behavior analytics
   */
  async getUserBehavior(
    userId: string,
    timeRange: '7d' | '30d' | '90d' = '30d'
  ): Promise<{
    sessions: number;
    pageViews: number;
    sessionDuration: number;
    productsViewed: number;
    productsPurchased: number;
    totalSpent: number;
    favoriteCategories: Array<{
      category: string;
      views: number;
      purchases: number;
    }>;
    journey: Array<{
      timestamp: Date;
      event: string;
      productId?: string;
      properties: Record<string, any>;
    }>;
  }> {
    try {
      const cacheKey = `analytics-user-${userId}-${timeRange}`;
      
      const response = await this.makeEnhancedDefaultRequest<{
        behavior: any;
      }>(
        `/behavior/patterns/${userId}?days=${this.timeRangeToDays(timeRange)}`,
        {},
        cacheKey,
        15 * 60 * 1000 // 15 minutes cache for user analytics
      );

      if (!response.success) {
        clientLogger.error('[AdvancedAnalyticsService] Failed to get user behavior:', { detail: response.error });
        return this.getDefaultUserBehavior();
      }

      return response.data?.behavior || this.getDefaultUserBehavior();
    } catch (error) {
      clientLogger.error('[AdvancedAnalyticsService] Error getting user behavior:', { detail: error });
      return this.getDefaultUserBehavior();
    }
  }

  /**
   * Queue event for batch processing
   */
  private queueEvent(event: AnalyticsEvent): void {
    this.eventQueue.push(event);
    
    // Process queue if it gets too large
    if (this.eventQueue.length >= 10) {
      this.flushEventQueue();
    }
  }

  /**
   * Flush event queue to server
   */
  private async flushEventQueue(): Promise<void> {
    if (this.isProcessingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await this.makeEnhancedDefaultRequest<void>(
        '/behavior/events/batch',
        {
          method: 'POST',
          body: JSON.stringify({ events })
        },
        `analytics-events-${Date.now()}`,
        0 // No caching for event tracking
      );
    } catch (error) {
      clientLogger.error('[AdvancedAnalyticsService] Failed to flush events:', { detail: error });
      // Re-queue events on failure
      this.eventQueue.unshift(...events);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Convert timeRange string to hours
   */
  private timeRangeToHours(timeRange: '24h' | '7d' | '30d'): number {
    switch (timeRange) {
      case '24h': return 24;
      case '7d': return 168;
      case '30d': return 720;
      default: return 168;
    }
  }

  /**
   * Convert timeRange string to days
   */
  private timeRangeToDays(timeRange: '7d' | '30d' | '90d'): number {
    switch (timeRange) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      default: return 30;
    }
  }

  /**
   * Get device information
   */
  private getDeviceInfo(): AnalyticsEvent['device'] {
    if (typeof window === 'undefined') {
      return { type: 'desktop' };
    }

    const userAgent = navigator.userAgent.toLowerCase();
    
    let type: 'mobile' | 'desktop' | 'tablet' = 'desktop';
    if (/mobile|android|iphone|ipod/.test(userAgent)) {
      type = 'mobile';
    } else if (/tablet|ipad/.test(userAgent)) {
      type = 'tablet';
    }

    return {
      type,
      os: this.extractOS(userAgent),
      browser: this.extractBrowser(userAgent)
    };
  }

  /**
   * Extract OS from user agent
   */
  private extractOS(userAgent: string): string {
    if (/windows/.test(userAgent)) return 'Windows';
    if (/mac/.test(userAgent)) return 'macOS';
    if (/linux/.test(userAgent)) return 'Linux';
    if (/android/.test(userAgent)) return 'Android';
    if (/ios|iphone|ipad/.test(userAgent)) return 'iOS';
    return 'Unknown';
  }

  /**
   * Extract browser from user agent
   */
  private extractBrowser(userAgent: string): string {
    if (/chrome/.test(userAgent)) return 'Chrome';
    if (/firefox/.test(userAgent)) return 'Firefox';
    if (/safari/.test(userAgent)) return 'Safari';
    if (/edge/.test(userAgent)) return 'Edge';
    return 'Unknown';
  }

  /**
   * Get UTM parameters
   */
  private getUTMParameters(): AnalyticsEvent['utm'] {
    if (typeof window === 'undefined') {
      return {};
    }

    const params = new URLSearchParams(window.location.search);
    
    return {
      source: params.get('utm_source') || undefined,
      medium: params.get('utm_medium') || undefined,
      campaign: params.get('utm_campaign') || undefined,
      term: params.get('utm_term') || undefined,
      content: params.get('utm_content') || undefined
    };
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    if (typeof window === 'undefined') {
      return 'server-session';
    }

    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    
    return sessionId;
  }

  /**
   * Get default metrics
   */
  private getDefaultMetrics(): AnalyticsMetrics {
    return {
      pageViews: { total: 0, unique: 0, bounceRate: 0, avgSessionDuration: 0 },
      products: { totalViews: 0, uniqueProducts: 0, topProducts: [] },
      conversion: { addToCartRate: 0, purchaseRate: 0, revenue: 0, averageOrderValue: 0 },
      engagement: { timeOnPage: 0, scrollDepth: 0, interactions: 0, shares: 0, reviews: 0 },
      geographic: { topRegions: [] },
      performance: { pageLoadTime: 0, apiResponseTime: 0, errorRate: 0 }
    };
  }

  /**
   * Get default real-time metrics
   */
  private getDefaultRealTimeMetrics(): RealTimeMetrics {
    return {
      activeUsers: 0,
      currentSessions: 0,
      liveEvents: [],
      trendingProducts: [],
      conversionFunnel: {
        visitors: 0,
        productViews: 0,
        addToCarts: 0,
        checkouts: 0,
        purchases: 0
      }
    };
  }

  /**
   * Get default product performance
   */
  private getDefaultProductPerformance() {
    return {
      views: 0,
      uniqueViews: 0,
      addToCarts: 0,
      purchases: 0,
      revenue: 0,
      conversionRate: 0,
      averageRating: 0,
      reviewCount: 0,
      trending: 'stable' as const,
      comparison: {
        previousPeriod: 0,
        change: 0,
        changePercent: 0
      }
    };
  }

  /**
   * Get default user behavior
   */
  private getDefaultUserBehavior() {
    return {
      sessions: 0,
      pageViews: 0,
      sessionDuration: 0,
      productsViewed: 0,
      productsPurchased: 0,
      totalSpent: 0,
      favoriteCategories: [],
      journey: []
    };
  }
}

// Export singleton instance
export const advancedAnalyticsService = AdvancedAnalyticsService.getInstance();
export default AdvancedAnalyticsService;
