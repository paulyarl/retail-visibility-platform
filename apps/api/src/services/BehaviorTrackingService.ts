/**
 * Behavior Tracking Service - API Server Singleton
 * 
 * Handles behavior event processing, analytics, and batch operations
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';

// Behavior Tracking Types
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
  batchInterval: number;
  retentionDays: number;
  enableRealTime: boolean;
  trackedEvents: string[];
  exemptPages: string[];
}

/**
 * Behavior Tracking Service - API Server Singleton
 * 
 * Processes behavior events and manages user analytics
 */
class BehaviorTrackingService extends UniversalSingleton {
  private static instance: BehaviorTrackingService;
  private trackingConfig: BehaviorTrackingConfig;
  private eventQueue: TrackingEvent[] = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private sessionData: Map<string, TrackingSession> = new Map();

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
    this.trackingConfig = {
      enableTracking: true,
      batchSize: 100,
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

  static getInstance(): BehaviorTrackingService {
    if (!BehaviorTrackingService.instance) {
      BehaviorTrackingService.instance = new BehaviorTrackingService('behavior-tracking-service');
    }
    return BehaviorTrackingService.instance;
  }

  // ====================
  // INITIALIZATION
  // ====================

  private initializeTracking(): void {
    if (this.trackingConfig.enableTracking && this.trackingConfig.enableRealTime) {
      // Start batch processing
      this.batchInterval = setInterval(() => {
        this.processBatch();
      }, this.trackingConfig.batchInterval);
    }
  }

  // ====================
  // EVENT PROCESSING
  // ====================

  /**
   * Batch events for processing
   */
  async batchEvents(events: TrackingEvent[]): Promise<void> {
    // Add events to queue for batch processing
    events.forEach(event => {
      this.eventQueue.push({
        ...event,
        id: this.generateEventId(),
        timestamp: new Date().toISOString()
      });
    });

    // Process batch immediately if queue is getting full
    if (this.eventQueue.length >= this.trackingConfig.batchSize) {
      await this.processBatch();
    }
  }

  /**
   * Track a behavior event
   */
  async trackEvent(event: Omit<TrackingEvent, 'id' | 'timestamp'>): Promise<TrackingEvent> {
    if (!this.trackingConfig.enableTracking) {
      throw new Error('Behavior tracking is disabled');
    }

    if (!this.trackingConfig.trackedEvents.includes(event.eventType)) {
      throw new Error(`Event type ${event.eventType} is not tracked`);
    }

    const trackingEvent: TrackingEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      priority: this.getEventPriority(event.eventType)
    };

    // Add to queue
    this.eventQueue.push(trackingEvent);

    // Update session data
    this.updateSessionData(trackingEvent);

    // Process immediately for critical events
    if (trackingEvent.priority === 'critical') {
      await this.sendEvent(trackingEvent);
    }

    return trackingEvent;
  }

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
   * Send single event to database
   */
  private async sendEvent(event: TrackingEvent): Promise<void> {
    try {
      // Store event in database
      await this.storeEvent(event);
    } catch (error) {
      console.error('Error sending tracking event:', error);
      throw error;
    }
  }

  /**
   * Send batch of events to database
   */
  private async sendBatch(events: TrackingEvent[]): Promise<void> {
    try {
      // Store events in database
      await this.storeEvents(events);
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
   * Get session data
   */
  async getSessionData(sessionId: string): Promise<TrackingSession | null> {
    return this.sessionData.get(sessionId) || null;
  }

  /**
   * End session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessionData.get(sessionId);
    if (!session) return;

    session.endTime = new Date().toISOString();
    session.duration = Date.now() - new Date(session.startTime).getTime();
    
    // Calculate bounce rate
    session.bounceRate = session.pageViews <= 1 ? 100 : 0;

    // Store session data
    await this.storeSession(session);

    // Remove from active sessions
    this.sessionData.delete(sessionId);
  }

  /**
   * Store session data
   */
  private async storeSession(session: TrackingSession): Promise<void> {
    // Store session in database
    console.log('Storing session:', session.id);
  }

  // ====================
  // ANALYTICS AND REPORTING
  // ====================

  /**
   * Get behavior analytics (alias for getAnalytics)
   */
  async getBehaviorAnalytics(hours: number = 24): Promise<BehaviorAnalytics> {
    return this.getAnalytics(hours);
  }

  /**
   * Get behavior analytics
   */
  async getAnalytics(hours: number = 24): Promise<BehaviorAnalytics> {
    const cacheKey = `behavior-analytics-${hours}`;
    
    const cached = await this.getFromCache<BehaviorAnalytics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Calculate analytics from database
      const analytics = await this.calculateAnalytics(hours);
      
      await this.setCache(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error('Error calculating behavior analytics:', error);
      
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
      // Calculate patterns from database
      const patterns = await this.calculateUserPatterns(userId, days);
      
      await this.setCache(cacheKey, patterns);
      return patterns;
    } catch (error) {
      console.error('Error calculating user behavior patterns:', error);
      
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

  /**
   * Calculate analytics from database
   */
  private async calculateAnalytics(hours: number): Promise<BehaviorAnalytics> {
    // This would query the database for actual analytics
    return {
      totalEvents: await this.getTotalEvents(hours),
      uniqueUsers: await this.getUniqueUsers(hours),
      uniqueSessions: await this.getUniqueSessions(hours),
      averageSessionDuration: await this.getAverageSessionDuration(hours),
      bounceRate: await this.getBounceRate(hours),
      topPages: await this.getTopPages(hours),
      topEvents: await this.getTopEvents(hours),
      userFlows: await this.getUserFlows(hours),
      timeRange: `${hours} hours`
    };
  }

  /**
   * Calculate user patterns from database
   */
  private async calculateUserPatterns(userId: string, days: number): Promise<{
    mostActiveHours: number[];
    preferredPages: string[];
    interactionPatterns: Record<string, number>;
    conversionEvents: number;
    averageSessionDuration: number;
  }> {
    // This would query the database for user patterns
    return {
      mostActiveHours: [],
      preferredPages: [],
      interactionPatterns: {},
      conversionEvents: 0,
      averageSessionDuration: 0
    };
  }

  // ====================
  // CONFIGURATION MANAGEMENT
  // ====================

  /**
   * Update tracking configuration
   */
  async updateConfig(config: Partial<BehaviorTrackingConfig>): Promise<void> {
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
  async getConfig(): Promise<BehaviorTrackingConfig> {
    const cached = await this.getFromCache<BehaviorTrackingConfig>('tracking-config');
    if (cached) {
      return cached;
    }

    await this.setCache('tracking-config', this.trackingConfig);
    return this.trackingConfig;
  }

  // ====================
  // DATABASE OPERATIONS
  // ====================

  private async storeEvent(event: TrackingEvent): Promise<void> {
    // Store event in database
    console.log('Storing tracking event:', event.id);
  }

  private async storeEvents(events: TrackingEvent[]): Promise<void> {
    // Store events in database
    console.log(`Storing ${events.length} tracking events`);
  }

  private async getTotalEvents(hours: number): Promise<number> {
    // Query database for total events
    return 0;
  }

  private async getUniqueUsers(hours: number): Promise<number> {
    // Query database for unique users
    return 0;
  }

  private async getUniqueSessions(hours: number): Promise<number> {
    // Query database for unique sessions
    return 0;
  }

  private async getAverageSessionDuration(hours: number): Promise<number> {
    // Query database for average session duration
    return 0;
  }

  private async getBounceRate(hours: number): Promise<number> {
    // Query database for bounce rate
    return 0;
  }

  private async getTopPages(hours: number): Promise<Array<{
    url: string;
    views: number;
    uniqueViews: number;
    averageTimeOnPage: number;
  }>> {
    // Query database for top pages
    return [];
  }

  private async getTopEvents(hours: number): Promise<Array<{
    eventType: string;
    count: number;
    uniqueUsers: number;
  }>> {
    // Query database for top events
    return [];
  }

  private async getUserFlows(hours: number): Promise<Array<{
    fromPage: string;
    toPage: string;
    count: number;
  }>> {
    // Query database for user flows
    return [];
  }

  // ====================
  // UTILITY METHODS
  // ====================

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getEventPriority(eventType: string): 'low' | 'normal' | 'high' | 'critical' {
    const priorityMap: Record<string, 'low' | 'normal' | 'high' | 'critical'> = {
      'product_purchase': 'critical',
      'user_signup': 'critical',
      'subscription_upgrade': 'critical',
      'store_view': 'high',
      'product_view': 'high',
      'category_browse': 'high',
      'search': 'high',
      'storefront_view': 'normal',
      'directory_detail': 'normal',
      'product_page': 'normal',
      'page_scroll': 'low',
      'time_spent': 'low',
      'element_click': 'low'
    };

    return priorityMap[eventType] || 'normal';
  }

  // ====================
  // BEHAVIOR TRACKING SPECIFIC METRICS
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
  // CLEANUP
  // ====================

  /**
   * Cleanup behavior tracking resources
   */
  async cleanup(): Promise<void> {
    // Process remaining events
    await this.processBatch();
    
    // End all active sessions
    const sessionIds = Array.from(this.sessionData.keys());
    await Promise.all(sessionIds.map(sessionId => this.endSession(sessionId)));
    
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
export const behaviorTrackingService = BehaviorTrackingService.getInstance();

export default BehaviorTrackingService;
