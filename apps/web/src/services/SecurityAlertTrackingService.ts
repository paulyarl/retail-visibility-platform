/**
 * Security Alert Tracking Service - Public API Pattern
 * 
 * Handles security alert tracking and telemetry events
 * Extends PublicApiSingleton for consistent caching and metrics
 */

import { PublicApiSingleton } from '@/providers/base/UniversalSingleton';

// Security Alert Data Interfaces
export interface SecurityAlertEvent {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'normal' | 'high' | 'critical';
  timestamp: string;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface SecurityTelemetryData {
  type: string;
  data: Record<string, any>;
  timestamp: string;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
}

export interface SecurityAlertMetrics {
  totalEvents: number;
  successfulBatches: number;
  failedBatches: number;
  lastBatchSent?: string;
  averageBatchSize: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
}

class SecurityAlertTrackingService extends PublicApiSingleton {
  private static instance: SecurityAlertTrackingService;

  // TTL constants for different data types
  private readonly EVENTS_TTL = 2 * 60 * 1000; // 2 minutes for events (real-time)
  private readonly METRICS_TTL = 5 * 60 * 1000; // 5 minutes for metrics

  private constructor() {
    super('security-alert-tracking-service');
  }

  static getInstance(): SecurityAlertTrackingService {
    if (!SecurityAlertTrackingService.instance) {
      SecurityAlertTrackingService.instance = new SecurityAlertTrackingService();
    }
    return SecurityAlertTrackingService.instance;
  }

  /**
   * Send security alert events
   * Uses the /api/security/alerts endpoint
   */
  async sendAlertEvents(events: SecurityAlertEvent[]): Promise<void> {
    try {
      await this.makePublicRequest<void>(
        '/security/alerts',
        {
          method: 'POST',
          body: JSON.stringify({ events })
        },
        'send-alert-events',
        this.EVENTS_TTL
      );
    } catch (error) {
      console.error('[SecurityAlertTrackingService] Failed to send alert events:', error);
      throw error;
    }
  }

  /**
   * Send security telemetry data
   * Uses the /api/security/telemetry/:type endpoint
   */
  async sendTelemetry(type: string, data: SecurityTelemetryData): Promise<void> {
    try {
      await this.makePublicRequest<void>(
        `/security/telemetry/${type}`,
        {
          method: 'POST',
          body: JSON.stringify(data)
        },
        `send-telemetry-${type}`,
        this.EVENTS_TTL
      );
    } catch (error) {
      console.error('[SecurityAlertTrackingService] Failed to send telemetry:', error);
      throw error;
    }
  }

  /**
   * Send security telemetry using sendBeacon (for page unload)
   * Uses the /api/security/telemetry/:type endpoint
   */
  sendTelemetryBeacon(type: string, data: SecurityTelemetryData): boolean {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      
      return navigator.sendBeacon(`${apiUrl}/api/security/telemetry/${type}`, blob);
    } catch (error) {
      console.error('[SecurityAlertTrackingService] Failed to send telemetry beacon:', error);
      return false;
    }
  }

  /**
   * Get security alert metrics
   * Uses the /api/security/metrics endpoint
   */
  async getSecurityMetrics(hours: number = 24): Promise<SecurityAlertMetrics> {
    try {
      const response = await this.makePublicRequest<SecurityAlertMetrics>(
        `/security/metrics?hours=${hours}`,
        {},
        `security-metrics-${hours}`,
        this.METRICS_TTL
      );

      return response || {
        totalEvents: 0,
        successfulBatches: 0,
        failedBatches: 0,
        averageBatchSize: 0,
        eventsByType: {},
        eventsBySeverity: {}
      };
    } catch (error) {
      console.error('[SecurityAlertTrackingService] Failed to get security metrics:', error);
      return {
        totalEvents: 0,
        successfulBatches: 0,
        failedBatches: 0,
        averageBatchSize: 0,
        eventsByType: {},
        eventsBySeverity: {}
      };
    }
  }

  /**
   * Get security alerts by type
   * Uses the /api/security/alerts/:type endpoint
   */
  async getAlertsByType(type: string, hours: number = 24): Promise<SecurityAlertEvent[]> {
    try {
      const response = await this.makePublicRequest<SecurityAlertEvent[]>(
        `/security/alerts/${type}?hours=${hours}`,
        {},
        `alerts-by-type-${type}-${hours}`,
        this.METRICS_TTL
      );

      return response || [];
    } catch (error) {
      console.error('[SecurityAlertTrackingService] Failed to get alerts by type:', error);
      return [];
    }
  }

  /**
   * Get security alerts by severity
   * Uses the /api/security/alerts/severity/:severity endpoint
   */
  async getAlertsBySeverity(severity: string, hours: number = 24): Promise<SecurityAlertEvent[]> {
    try {
      const response = await this.makePublicRequest<SecurityAlertEvent[]>(
        `/security/alerts/severity/${severity}?hours=${hours}`,
        {},
        `alerts-by-severity-${severity}-${hours}`,
        this.METRICS_TTL
      );

      return response || [];
    } catch (error) {
      console.error('[SecurityAlertTrackingService] Failed to get alerts by severity:', error);
      return [];
    }
  }

  /**
   * Invalidate events cache
   */
  async invalidateEventsCache(): Promise<void> {
    await this.invalidateCache('send-alert-events');
  }

  /**
   * Invalidate telemetry cache
   */
  async invalidateTelemetryCache(type?: string): Promise<void> {
    if (type) {
      await this.invalidateCache(`send-telemetry-${type}`);
    } else {
      // Clear all telemetry caches
      await this.invalidateCache('send-telemetry-login');
      await this.invalidateCache('send-telemetry-logout');
      await this.invalidateCache('send-telemetry-auth');
    }
  }

  /**
   * Invalidate metrics cache
   */
  async invalidateMetricsCache(hours?: number): Promise<void> {
    if (hours) {
      await this.invalidateCache(`security-metrics-${hours}`);
    } else {
      await this.invalidateCache('security-metrics-24');
      await this.invalidateCache('security-metrics-48');
      await this.invalidateCache('security-metrics-168');
    }
  }

  /**
   * Invalidate alerts cache
   */
  async invalidateAlertsCache(type?: string, severity?: string): Promise<void> {
    if (type) {
      await this.invalidateCache(`alerts-by-type-${type}-24`);
      await this.invalidateCache(`alerts-by-type-${type}-48`);
      await this.invalidateCache(`alerts-by-type-${type}-168`);
    }
    if (severity) {
      await this.invalidateCache(`alerts-by-severity-${severity}-24`);
      await this.invalidateCache(`alerts-by-severity-${severity}-48`);
      await this.invalidateCache(`alerts-by-severity-${severity}-168`);
    }
  }
}

// Export singleton instance
export const securityAlertTrackingService = SecurityAlertTrackingService.getInstance();
