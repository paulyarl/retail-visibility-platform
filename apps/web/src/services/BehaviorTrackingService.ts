/**
 * Behavior Tracking Service - Public API Pattern
 * 
 * Handles behavior tracking and analytics events
 * Extends PublicApiSingleton for consistent caching and metrics
 */

import { ApiSystemSingleton } from '@/providers/base/ApiSystemSingleton';
import { AppContext, CacheIsolation } from '../utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

// Behavior Tracking Data Interfaces
// Auth0: userId determined server-side from session
export interface TrackingEvent {
  type: string;
  action: string;
  data?: Record<string, any>;
  timestamp: string;
  // userId removed - server determines from Auth0 session
  sessionId?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
}

export interface TrackingSession {
  id: string;
  // userId removed - server determines from Auth0 session
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

class BehaviorTrackingService extends ApiSystemSingleton {
  private static instance: BehaviorTrackingService;

  // Override base class defaults for behavior tracking
  protected defaultContext: AppContext = AppContext.USER;
  protected defaultIsolation: CacheIsolation = CacheIsolation.USER;

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
   * Uses the /api/behavior/events endpoint
   */
  async sendEvent(event: TrackingEvent): Promise<void> {
    try {
      await super.makeEnhancedDefaultRequest<void>(
        '/api/behavior/events',
        {
          method: 'POST',
          body: JSON.stringify(event)
        },
        'send-event',
        this.EVENTS_TTL
      );
    } catch (error) {
      clientLogger.error('[BehaviorTrackingService] Failed to send tracking event:', { detail: error });
      throw error;
    }
  }

  /**
   * Send batch of tracking events
   * Uses the /api/behavior/events/batch endpoint
   */
  async sendBatch(events: TrackingEvent[]): Promise<void> {
    try {
      await super.makeEnhancedDefaultRequest<void>(
        '/api/behavior/events/batch',
        {
          method: 'POST',
          body: JSON.stringify({ events })
        },
        'send-batch-events',
        this.EVENTS_TTL
      );
    } catch (error) {
      clientLogger.error('[BehaviorTrackingService] Failed to send batch events:', { detail: error });
      throw error;
    }
  }

  /**
   * Send tracking session data
   * Uses the /api/behavior/sessions endpoint
   */
  async sendSession(session: TrackingSession): Promise<void> {
    try {
      await super.makeEnhancedDefaultRequest<void>(
        '/api/behavior/sessions',
        {
          method: 'POST',
          body: JSON.stringify(session)
        },
        'send-session',
        this.SESSIONS_TTL
      );
    } catch (error) {
      clientLogger.error('[BehaviorTrackingService] Failed to send tracking session:', { detail: error });
      throw error;
    }
  }

  /**
   * Get behavior analytics
   * Uses the /api/behavior/analytics endpoint
   */
  async getBehaviorAnalytics(hours: number = 24): Promise<BehaviorAnalytics> {
    const response = await super.makeEnhancedDefaultRequest<BehaviorAnalytics>(
      `/api/behavior/analytics?hours=${hours}`,
      {},
      `behavior-analytics-${hours}`,
      this.ANALYTICS_TTL
    );

    if (!response.success) {
      clientLogger.error('[BehaviorTrackingService] Failed to get behavior analytics:', { detail: response.error });
      return {
        totalEvents: 0,
        uniqueUsers: 0,
        topActions: [],
        hourlyBreakdown: [],
        userBehaviorPatterns: []
      };
    }

    return response.data || {
      totalEvents: 0,
      uniqueUsers: 0,
      topActions: [],
      hourlyBreakdown: [],
      userBehaviorPatterns: []
    };
  }

  /**
   * Get user behavior patterns
   * Uses the /api/behavior/patterns/:userId endpoint
   */
  async getUserBehaviorPatterns(userId: string, days: number = 30): Promise<any> {
    const response = await super.makeEnhancedDefaultRequest<any>(
      `/api/behavior/patterns/${userId}?days=${days}`,
      {},
      `user-behavior-${userId}-${days}`,
      this.ANALYTICS_TTL
    );

    if (!response.success) {
      clientLogger.error('[BehaviorTrackingService] Failed to get user behavior patterns:', { detail: response.error });
      return null;
    }

    return response.data || null;
  }

  /**
   * Invalidate event cache
   */
  async invalidateEventCache(): Promise<void> {
    await super.invalidateCache('send-event');
    await super.invalidateCache('send-batch-events');
  }

  /**
   * Invalidate session cache
   */
  async invalidateSessionCache(): Promise<void> {
    await super.invalidateCache('send-session');
  }

  /**
   * Invalidate analytics cache
   */
  async invalidateAnalyticsCache(hours?: number): Promise<void> {
    if (hours) {
      await super.invalidateCache(`behavior-analytics-${hours}`);
    } else {
      await super.invalidateCache('behavior-analytics-24');
      await super.invalidateCache('behavior-analytics-48');
      await super.invalidateCache('behavior-analytics-168');
    }
  }

  /**
   * Invalidate user behavior cache
   */
  async invalidateUserBehaviorCache(userId: string, days?: number): Promise<void> {
    if (days) {
      await super.invalidateCache(`user-behavior-${userId}-${days}`);
    } else {
      await super.invalidateCache(`user-behavior-${userId}-30`);
      await super.invalidateCache(`user-behavior-${userId}-90`);
    }
  }
}

// Export singleton instance
export const behaviorTrackingService = BehaviorTrackingService.getInstance();
