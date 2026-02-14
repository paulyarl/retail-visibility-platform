/**
 * Behavior Tracking Service - Public API Pattern
 * 
 * Handles behavior tracking and analytics events
 * Extends PublicApiSingleton for consistent caching and metrics
 */

import { PublicApiSingleton } from '@/providers/base/UniversalSingleton';

// Behavior Tracking Data Interfaces
export interface TrackingEvent {
  type: string;
  action: string;
  data?: Record<string, any>;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
}

export interface TrackingSession {
  id: string;
  userId?: string;
  tenantId?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  events: TrackingEvent[];
  metadata?: Record<string, any>;
}

export interface BehaviorAnalytics {
  totalEvents: number;
  uniqueUsers: number;
  topActions: Array<{ action: string; count: number }>;
  hourlyBreakdown: Array<{ hour: string; count: number }>;
  userBehaviorPatterns: Array<{
    userId: string;
    actionCount: number;
    avgSessionDuration: number;
    topActions: string[];
  }>;
}

class BehaviorTrackingService extends PublicApiSingleton {
  private static instance: BehaviorTrackingService;

  // TTL constants for different data types
  private readonly EVENTS_TTL = 2 * 60 * 1000; // 2 minutes for events (real-time)
  private readonly SESSIONS_TTL = 5 * 60 * 1000; // 5 minutes for sessions
  private readonly ANALYTICS_TTL = 10 * 60 * 1000; // 10 minutes for analytics

  private constructor() {
    super('behavior-tracking-service');
  }

  static getInstance(): BehaviorTrackingService {
    if (!BehaviorTrackingService.instance) {
      BehaviorTrackingService.instance = new BehaviorTrackingService();
    }
    return BehaviorTrackingService.instance;
  }

  /**
   * Send single tracking event
   * Uses the /api/analytics/events endpoint
   */
  async sendEvent(event: TrackingEvent): Promise<void> {
    try {
      await this.makePublicRequest<void>(
        '/analytics/events',
        {
          method: 'POST',
          body: JSON.stringify(event)
        },
        'send-event',
        this.EVENTS_TTL
      );
    } catch (error) {
      console.error('[BehaviorTrackingService] Failed to send tracking event:', error);
      throw error;
    }
  }

  /**
   * Send batch of tracking events
   * Uses the /api/analytics/events/batch endpoint
   */
  async sendBatch(events: TrackingEvent[]): Promise<void> {
    try {
      await this.makePublicRequest<void>(
        '/analytics/events/batch',
        {
          method: 'POST',
          body: JSON.stringify({ events })
        },
        'send-batch-events',
        this.EVENTS_TTL
      );
    } catch (error) {
      console.error('[BehaviorTrackingService] Failed to send batch events:', error);
      throw error;
    }
  }

  /**
   * Send tracking session data
   * Uses the /api/analytics/sessions endpoint
   */
  async sendSession(session: TrackingSession): Promise<void> {
    try {
      await this.makePublicRequest<void>(
        '/analytics/sessions',
        {
          method: 'POST',
          body: JSON.stringify(session)
        },
        'send-session',
        this.SESSIONS_TTL
      );
    } catch (error) {
      console.error('[BehaviorTrackingService] Failed to send tracking session:', error);
      throw error;
    }
  }

  /**
   * Get behavior analytics data
   * Uses the /api/analytics/behavior endpoint
   */
  async getBehaviorAnalytics(hours: number = 24): Promise<BehaviorAnalytics> {
    try {
      const response = await this.makePublicRequest<BehaviorAnalytics>(
        `/analytics/behavior?hours=${hours}`,
        {},
        `behavior-analytics-${hours}`,
        this.ANALYTICS_TTL
      );

      return response || {
        totalEvents: 0,
        uniqueUsers: 0,
        topActions: [],
        hourlyBreakdown: [],
        userBehaviorPatterns: []
      };
    } catch (error) {
      console.error('[BehaviorTrackingService] Failed to get behavior analytics:', error);
      return {
        totalEvents: 0,
        uniqueUsers: 0,
        topActions: [],
        hourlyBreakdown: [],
        userBehaviorPatterns: []
      };
    }
  }

  /**
   * Get user behavior patterns
   * Uses the /api/analytics/users/:userId/behavior endpoint
   */
  async getUserBehaviorPatterns(userId: string, days: number = 30): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        `/analytics/users/${userId}/behavior?days=${days}`,
        {},
        `user-behavior-${userId}-${days}`,
        this.ANALYTICS_TTL
      );

      return response;
    } catch (error) {
      console.error('[BehaviorTrackingService] Failed to get user behavior patterns:', error);
      return null;
    }
  }

  /**
   * Invalidate event cache
   */
  async invalidateEventCache(): Promise<void> {
    await this.invalidateCache('send-event');
    await this.invalidateCache('send-batch-events');
  }

  /**
   * Invalidate session cache
   */
  async invalidateSessionCache(): Promise<void> {
    await this.invalidateCache('send-session');
  }

  /**
   * Invalidate analytics cache
   */
  async invalidateAnalyticsCache(hours?: number): Promise<void> {
    if (hours) {
      await this.invalidateCache(`behavior-analytics-${hours}`);
    } else {
      await this.invalidateCache('behavior-analytics-24');
      await this.invalidateCache('behavior-analytics-48');
      await this.invalidateCache('behavior-analytics-168');
    }
  }

  /**
   * Invalidate user behavior cache
   */
  async invalidateUserBehaviorCache(userId: string, days?: number): Promise<void> {
    if (days) {
      await this.invalidateCache(`user-behavior-${userId}-${days}`);
    } else {
      await this.invalidateCache(`user-behavior-${userId}-30`);
      await this.invalidateCache(`user-behavior-${userId}-90`);
    }
  }
}

// Export singleton instance
export const behaviorTrackingService = BehaviorTrackingService.getInstance();
