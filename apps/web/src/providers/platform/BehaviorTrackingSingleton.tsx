/**
 * Behavior Tracking Singleton - Producer Pattern
 * 
 * Produces and manages user behavior tracking data
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';

// Behavior Tracking Data Interfaces
export interface TrackingEvent {
  id: string;
  userId?: string;
  tenantId?: string;
  sessionId: string;
  eventType: string;
  eventData: Record<string, any>;
  timestamp: string;
  userAgent?: string;
  ip?: string;
  referrer?: string;
  url: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface TrackingSession {
  id: string;
  userId?: string;
  tenantId?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  pageViews: number;
  events: number;
  bounceRate?: number;
  exitPage?: string;
  entryPage?: string;
  userAgent?: string;
  ip?: string;
  location?: {
    country?: string;
    city?: string;
    region?: string;
  };
}

export interface BehaviorAnalytics {
  totalEvents: number;
  uniqueUsers: number;
  uniqueSessions: number;
  averageSessionDuration: number;
  bounceRate: number;
  topPages: Array<{
    url: string;
    views: number;
    uniqueViews: number;
    averageTimeOnPage: number;
  }>;
  topEvents: Array<{
    eventType: string;
    count: number;
    uniqueUsers: number;
  }>;
  userFlows: Array<{
    fromPage: string;
    toPage: string;
    count: number;
  }>;
  timeRange: string;
}

export interface BehaviorTrackingConfig {
  enableTracking: boolean;
  batchSize: number;
  batchInterval: number; // milliseconds
  retentionDays: number;
  enableRealTime: boolean;
  trackedEvents: string[];
  exemptPages: string[];
}

/**
 * Behavior Tracking Singleton - Producer Pattern
 * 
 * Produces behavior tracking data and manages user analytics
 */
class BehaviorTrackingSingleton extends UniversalSingleton {
  private static instance: BehaviorTrackingSingleton;
  private trackingConfig: BehaviorTrackingConfig;
  private eventQueue: TrackingEvent[] = [];
  private sessionData: Map<string, TrackingSession> = new Map();
  private batchInterval: NodeJS.Timeout | null = null;
  private currentSessionId: string | null = null;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
    this.trackingConfig = {
      enableTracking: true,
      batchSize: 50,
      batchInterval: 30000, // 30 seconds
      retentionDays: 90,
      enableRealTime: true,
      trackedEvents: [
        'page_view',
        'product_view',
        'store_view',
        'search',
        'click',
        'scroll',
        'form_submit',
        'purchase',
        'signup',
        'login'
      ],
      exemptPages: ['/admin', '/api']
    };
    this.initializeTracking();
  }

  static getInstance(): BehaviorTrackingSingleton {
    if (!BehaviorTrackingSingleton.instance) {
      BehaviorTrackingSingleton.instance = new BehaviorTrackingSingleton('behavior-tracking-singleton');
    }
    return BehaviorTrackingSingleton.instance;
  }

  // ====================
  // TRACKING INITIALIZATION
  // ====================

  private initializeTracking(): void {
    if (this.trackingConfig.enableTracking && this.trackingConfig.enableRealTime) {
      // Start batch processing
      this.batchInterval = setInterval(() => {
        this.processBatch();
      }, this.trackingConfig.batchInterval);
    }

    // Initialize session
    this.initializeSession();
  }

  private initializeSession(): void {
    this.currentSessionId = this.generateSessionId();
    
    const session: TrackingSession = {
      id: this.currentSessionId,
      startTime: new Date().toISOString(),
      pageViews: 0,
      events: 0,
      entryPage: window.location.pathname,
      userAgent: navigator.userAgent,
      ip: this.getClientIP()
    };

    this.sessionData.set(this.currentSessionId, session);
  }

  // ====================
  // EVENT TRACKING PRODUCTION
  // ====================

  /**
   * Track a behavior event
   */
  async trackEvent(
    eventType: string,
    eventData: Record<string, any>,
    options: {
      userId?: string;
      tenantId?: string;
      priority?: 'low' | 'normal' | 'high' | 'critical';
    } = {}
  ): Promise<void> {
    if (!this.trackingConfig.enableTracking) return;
    if (!this.trackingConfig.trackedEvents.includes(eventType)) return;

    const event: TrackingEvent = {
      id: this.generateEventId(),
      userId: options.userId,
      tenantId: options.tenantId,
      sessionId: this.currentSessionId || 'unknown',
      eventType,
      eventData,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      ip: this.getClientIP(),
      referrer: document.referrer,
      url: window.location.pathname,
      priority: options.priority || this.getEventPriority(eventType)
    };

    // Add to queue
    this.eventQueue.push(event);

    // Update session data
    this.updateSessionData(event);

    // Process immediately for critical events
    if (event.priority === 'critical') {
      await this.sendEvent(event);
    }

    // Process batch if queue is full
    if (this.eventQueue.length >= this.trackingConfig.batchSize) {
      await this.processBatch();
    }
  }

  /**
   * Track page view
   */
  async trackPageView(
    url: string,
    options: {
      userId?: string;
      tenantId?: string;
      referrer?: string;
    } = {}
  ): Promise<void> {
    await this.trackEvent('page_view', {
      url,
      referrer: options.referrer || document.referrer,
      title: document.title,
      timestamp: new Date().toISOString()
    }, options);

    // Update session page view count
    if (this.currentSessionId) {
      const session = this.sessionData.get(this.currentSessionId);
      if (session) {
        session.pageViews++;
      }
    }
  }

  /**
   * Track user interaction
   */
  async trackInteraction(
    interactionType: string,
    target: string,
    options: {
      userId?: string;
      tenantId?: string;
      value?: any;
    } = {}
  ): Promise<void> {
    await this.trackEvent('user_interaction', {
      interactionType,
      target,
      value: options.value,
      timestamp: new Date().toISOString()
    }, options);
  }

  /**
   * Track search query
   */
  async trackSearch(
    query: string,
    results: number,
    options: {
      userId?: string;
      tenantId?: string;
      category?: string;
    } = {}
  ): Promise<void> {
    await this.trackEvent('search', {
      query,
      results,
      category: options.category,
      timestamp: new Date().toISOString()
    }, options);
  }

  /**
   * Track conversion event
   */
  async trackConversion(
    conversionType: string,
    value: number,
    options: {
      userId?: string;
      tenantId?: string;
      currency?: string;
      productId?: string;
    } = {}
  ): Promise<void> {
    await this.trackEvent('conversion', {
      conversionType,
      value,
      currency: options.currency || 'USD',
      productId: options.productId,
      timestamp: new Date().toISOString()
    }, { ...options, priority: 'high' });
  }

  // ====================
  // BATCH PROCESSING
  // ====================

  /**
   * Process batch of events
   */
  private async processBatch(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const batch = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await this.sendBatch(batch);
    } catch (error) {
      console.error('Error processing behavior tracking batch:', error);
      // Re-add failed events to queue for retry
      this.eventQueue.unshift(...batch);
    }
  }

  /**
   * Send single event to API
   */
  private async sendEvent(event: TrackingEvent): Promise<void> {
    try {
      const response = await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });

      if (!response.ok) {
        throw new Error('Failed to send tracking event');
      }
    } catch (error) {
      console.error('Error sending tracking event:', error);
      throw error;
    }
  }

  /**
   * Send batch of events to API
   */
  private async sendBatch(events: TrackingEvent[]): Promise<void> {
    try {
      const response = await fetch('/api/analytics/events/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events })
      });

      if (!response.ok) {
        throw new Error('Failed to send tracking batch');
      }
    } catch (error) {
      console.error('Error sending tracking batch:', error);
      throw error;
    }
  }

  // ====================
  // SESSION MANAGEMENT
  // ====================

  /**
   * Update session data with event
   */
  private updateSessionData(event: TrackingEvent): void {
    const session = this.sessionData.get(event.sessionId);
    if (!session) return;

    session.events++;
    
    if (event.eventType === 'page_view') {
      session.pageViews++;
    }

    // Update exit page
    session.exitPage = event.url;
  }

  /**
   * End current session
   */
  async endSession(): Promise<void> {
    if (!this.currentSessionId) return;

    const session = this.sessionData.get(this.currentSessionId);
    if (!session) return;

    session.endTime = new Date().toISOString();
    session.duration = Date.now() - new Date(session.startTime).getTime();
    
    // Calculate bounce rate
    session.bounceRate = session.pageViews <= 1 ? 100 : 0;

    // Send session data
    await this.sendSession(session);

    // Remove from active sessions
    this.sessionData.delete(this.currentSessionId);
    this.currentSessionId = null;
  }

  /**
   * Send session data to API
   */
  private async sendSession(session: TrackingSession): Promise<void> {
    try {
      const response = await fetch('/api/analytics/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session)
      });

      if (!response.ok) {
        throw new Error('Failed to send session data');
      }
    } catch (error) {
      console.error('Error sending session data:', error);
    }
  }

  // ====================
  // TRACKING CONFIGURATION
  // ====================

  /**
   * Update tracking configuration
   */
  async updateTrackingConfig(config: Partial<BehaviorTrackingConfig>): Promise<void> {
    this.trackingConfig = { ...this.trackingConfig, ...config };
    
    // Cache configuration
    await this.setCache('tracking-config', this.trackingConfig);

    // Restart batch processing if needed
    if (config.batchInterval !== undefined || config.enableRealTime !== undefined) {
      if (this.batchInterval) {
        clearInterval(this.batchInterval);
        this.batchInterval = null;
      }

      if (this.trackingConfig.enableRealTime && this.trackingConfig.enableTracking) {
        this.batchInterval = setInterval(() => {
          this.processBatch();
        }, this.trackingConfig.batchInterval);
      }
    }
  }

  /**
   * Get tracking configuration
   */
  async getTrackingConfig(): Promise<BehaviorTrackingConfig> {
    const cached = await this.getFromCache<BehaviorTrackingConfig>('tracking-config');
    if (cached) {
      return cached;
    }

    await this.setCache('tracking-config', this.trackingConfig);
    return this.trackingConfig;
  }

  // ====================
  // BEHAVIOR ANALYTICS
  // ====================

  /**
   * Get behavior analytics
   */
  async getBehaviorAnalytics(hours: number = 24): Promise<BehaviorAnalytics> {
    const cacheKey = `behavior-analytics-${hours}`;
    
    const cached = await this.getFromCache<BehaviorAnalytics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/analytics/behavior?hours=${hours}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch behavior analytics');
      }

      const analytics = await response.json();
      
      await this.setCache(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error('Error fetching behavior analytics:', error);
      
      // Return default analytics
      return {
        totalEvents: 0,
        uniqueUsers: 0,
        uniqueSessions: 0,
        averageSessionDuration: 0,
        bounceRate: 0,
        topPages: [],
        topEvents: [],
        userFlows: [],
        timeRange: `${hours} hours`
      };
    }
  }

  /**
   * Get user behavior patterns
   */
  async getUserBehaviorPatterns(userId: string, days: number = 30): Promise<{
    mostActiveHours: number[];
    preferredPages: string[];
    interactionPatterns: Record<string, number>;
    conversionEvents: number;
    averageSessionDuration: number;
  }> {
    const cacheKey = `user-behavior-${userId}-${days}`;
    
    const cached = await this.getFromCache<{
      mostActiveHours: number[];
      preferredPages: string[];
      interactionPatterns: Record<string, number>;
      conversionEvents: number;
      averageSessionDuration: number;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/analytics/users/${userId}/behavior?days=${days}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user behavior patterns');
      }

      const patterns = await response.json();
      
      await this.setCache(cacheKey, patterns);
      return patterns;
    } catch (error) {
      console.error('Error fetching user behavior patterns:', error);
      
      // Return default patterns
      return {
        mostActiveHours: [],
        preferredPages: [],
        interactionPatterns: {},
        conversionEvents: 0,
        averageSessionDuration: 0
      };
    }
  }

  // ====================
  // TRACKING SPECIFIC METRICS
  // ====================

  protected getCustomMetrics(): Record<string, any> {
    return {
      eventsQueued: this.eventQueue.length,
      activeSessions: this.sessionData.size,
      trackingEnabled: this.trackingConfig.enableTracking,
      batchProcessingActive: !!this.batchInterval,
      lastBatchProcess: new Date().toISOString(),
      eventsProcessed: 0
    };
  }

  // ====================
  // UTILITY METHODS
  // ====================

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getClientIP(): string {
    // In a real implementation, this would come from the server
    // For now, return a placeholder
    return 'client_ip';
  }

  private getEventPriority(eventType: string): 'low' | 'normal' | 'high' | 'critical' {
    const priorityMap: Record<string, 'low' | 'normal' | 'high' | 'critical'> = {
      'purchase': 'critical',
      'signup': 'critical',
      'login': 'high',
      'product_view': 'high',
      'store_view': 'high',
      'search': 'normal',
      'click': 'normal',
      'page_view': 'normal',
      'scroll': 'low'
    };

    return priorityMap[eventType] || 'normal';
  }

  // ====================
  // CLEANUP
  // ====================

  /**
   * Cleanup tracking resources
   */
  async cleanup(): Promise<void> {
    // End current session
    await this.endSession();
    
    // Process remaining events
    await this.processBatch();
    
    // Clear batch interval
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
    
    // Clear cache
    await this.clearCache();
  }
}

// Export singleton instance
export const behaviorTrackingSingleton = BehaviorTrackingSingleton.getInstance();

export default BehaviorTrackingSingleton;
