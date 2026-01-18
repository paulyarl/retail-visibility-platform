/**
 * Security Alert Data Collection System
 * 
 * Inspired by behavior tracking system - batches security telemetry data
 * for minimal system resource impact while maintaining comprehensive monitoring.
 * 
 * Features:
 * - Priority-based batching (critical alerts send immediately)
 * - Local storage persistence for offline scenarios
 * - Exponential backoff retry logic
 * - Memory-efficient caching with size limits
 * - Online/offline detection
 * - Performance monitoring
 */

interface SecurityAlertEvent {
  type: 'rate_limit_exceeded' | 'auth_failure' | 'suspicious_activity' | 'security_incident';
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
  sessionId?: string;
  userId?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  metadata: {
    endpoint?: string;
    method?: string;
    ipAddress?: string;
    userAgent?: string;
    location?: {
      city?: string;
      country?: string;
      timezone?: string;
    };
    device?: {
      browser?: string;
      os?: string;
      isBot?: boolean;
      isMobile?: boolean;
    };
    network?: {
      ip?: string;
      proxyChain?: string[];
      isBehindProxy?: boolean;
    };
    rateAnalysis?: {
      currentRate?: number;
      ratePerMinute?: number;
      historicalAverage?: number;
      rateTrend?: 'increasing' | 'decreasing' | 'stable';
      limitInfo?: {
        limit?: number;
        current?: number;
        remaining?: number;
      };
      triggerReason?: string;
    };
    threatLevel?: 'low' | 'medium' | 'high' | 'critical';
    riskFactors?: string[];
    isSuspicious?: boolean;
  };
}

// Security event priority mapping
const SECURITY_PRIORITY_MAP: Record<string, SecurityAlertEvent['priority']> = {
  // Critical security events - send immediately
  'security_incident': 'critical',
  'suspicious_activity': 'critical',
  'auth_failure': 'critical',
  
  // High priority - send within current batch
  'rate_limit_exceeded': 'high',
  
  // Normal priority - standard batch timing
  'security_warning': 'normal',
  'security_info': 'normal',
  
  // Low priority - can be delayed
  'security_metric': 'low',
  'performance_metric': 'low'
};

class SecurityAlertTrackingCache {
  private events: SecurityAlertEvent[] = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_INTERVAL = 15000; // 15 seconds (faster than behavior tracking)
  private readonly MAX_CACHE_SIZE = 50; // Smaller cache for security events
  private readonly STORAGE_KEY = 'security_alert_tracking_cache';
  private readonly RETRY_KEY = 'security_alert_retry_state';
  private readonly METRICS_KEY = 'security_alert_metrics';
  private isSending = false;
  private isOnline = true;
  private retryState: {
    attempts: number;
    nextRetryAt: number;
    lastFailureReason?: string;
  } = { attempts: 0, nextRetryAt: 0 };
  private metrics: {
    totalEvents: number;
    successfulBatches: number;
    failedBatches: number;
    averageBatchSize: number;
    lastBatchSent: number;
  } = { totalEvents: 0, successfulBatches: 0, failedBatches: 0, averageBatchSize: 0, lastBatchSent: 0 };

  constructor() {
    this.loadFromStorage();
    this.loadRetryState();
    this.loadMetrics();
    this.setupOnlineDetection();
    this.startBatchTimer();
    this.setupUnloadHandler();
  }

  /**
   * Add security event to cache with priority assignment
   */
  addEvent(event: Omit<SecurityAlertEvent, 'timestamp' | 'priority'>): void {
    const priority = this.determineEventPriority(event);
    const cachedEvent: SecurityAlertEvent = {
      ...event,
      timestamp: Date.now(),
      priority
    };

    this.events.push(cachedEvent);
    this.metrics.totalEvents++;
    
    // Prevent excessive memory usage
    if (this.events.length > this.MAX_CACHE_SIZE) {
      // Remove lowest priority events first
      this.events.sort((a, b) => this.getPriorityWeight(a.priority) - this.getPriorityWeight(b.priority));
      this.events = this.events.slice(-this.MAX_CACHE_SIZE);
    }
    
    this.saveToStorage();
    this.saveMetrics();

    // Check if we should send critical events immediately
    if (priority === 'critical' && this.isOnline && !this.isSending) {
      console.log('[SecurityAlertTracking] Critical security event detected, sending immediately');
      setTimeout(() => this.sendBatch(), 100); // Small delay to allow batching
    }
  }

  /**
   * Determine event priority based on type and severity
   */
  private determineEventPriority(event: Omit<SecurityAlertEvent, 'timestamp' | 'priority'>): SecurityAlertEvent['priority'] {
    // Check type first
    const typePriority = SECURITY_PRIORITY_MAP[event.type];
    if (typePriority) return typePriority;

    // Check severity
    if (event.severity === 'critical') return 'critical';
    if (event.severity === 'warning') return 'high';
    if (event.severity === 'info') return 'normal';

    // Check threat level
    if (event.metadata.threatLevel === 'critical') return 'critical';
    if (event.metadata.threatLevel === 'high') return 'high';
    if (event.metadata.isSuspicious) return 'high';

    return 'normal'; // Default priority
  }

  /**
   * Get numeric weight for priority sorting (higher = more important)
   */
  private getPriorityWeight(priority?: SecurityAlertEvent['priority']): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  /**
   * Send cached security events in batches with retry logic
   */
  private async sendBatch(): Promise<void> {
    // Don't send if offline
    if (!this.isOnline) {
      console.log('[SecurityAlertTracking] Skipping batch send - offline');
      return;
    }

    // Check if we're in retry cooldown
    const now = Date.now();
    if (this.retryState.nextRetryAt > now) {
      console.log(`[SecurityAlertTracking] Skipping batch send - retry cooldown until ${new Date(this.retryState.nextRetryAt).toISOString()}`);
      return;
    }

    if (this.events.length === 0 || this.isSending) return;

    this.isSending = true;
    const eventsToSend = [...this.events];
    
    // Sort events by priority (critical first) for optimized sending
    eventsToSend.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
    
    this.events = []; // Clear cache immediately
    this.saveToStorage();

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      // Group events by type for optimized API calls
      const eventsByType = this.groupEventsByType(eventsToSend);
      
      // Send each type group separately
      const sendPromises = Object.entries(eventsByType).map(([type, events]) => 
        this.sendEventsByType(type, events, apiUrl)
      );

      await Promise.allSettled(sendPromises);

      // Update metrics
      this.metrics.successfulBatches++;
      this.metrics.lastBatchSent = Date.now();
      this.metrics.averageBatchSize = (this.metrics.averageBatchSize * (this.metrics.successfulBatches - 1) + eventsToSend.length) / this.metrics.successfulBatches;
      this.saveMetrics();

      // Success - reset retry state
      this.retryState.attempts = 0;
      this.retryState.nextRetryAt = 0;
      this.saveRetryState();

      console.log(`[SecurityAlertTracking] Sent ${eventsToSend.length} security events in ${Object.keys(eventsByType).length} type groups (priorities: ${Object.entries(this.getPriorityBreakdown(eventsToSend)).map(([p, c]) => `${p}:${c}`).join(', ')})`);
    } catch (error) {
      // Security tracking failures should not break the application
      console.warn('[SecurityAlertTracking] Security alert batch failed, will retry:', error instanceof Error ? error.message : 'Unknown error');
      
      // Increment retry attempts
      this.retryState.attempts++;
      this.retryState.lastFailureReason = error instanceof Error ? error.message : 'Unknown error';
      this.metrics.failedBatches++;
      this.saveMetrics();
      
      // Calculate exponential backoff delay (30s, 1min, 2min, 4min, max 10min)
      const baseDelay = 30000; // 30 seconds
      const maxDelay = 10 * 60000; // 10 minutes
      const exponentialDelay = Math.min(baseDelay * Math.pow(2, this.retryState.attempts - 1), maxDelay);
      
      this.retryState.nextRetryAt = Date.now() + exponentialDelay;
      this.saveRetryState();
      
      // Re-queue failed events
      this.events.unshift(...eventsToSend);
      this.saveToStorage();
      
      console.log(`[SecurityAlertTracking] Re-queued ${eventsToSend.length} security events, retry attempt ${this.retryState.attempts} in ${Math.round(exponentialDelay / 1000)}s`);
    } finally {
      this.isSending = false;
    }
  }

  /**
   * Group events by type for optimized API calls
   */
  private groupEventsByType(events: SecurityAlertEvent[]): Record<string, SecurityAlertEvent[]> {
    const grouped: Record<string, SecurityAlertEvent[]> = {};
    
    events.forEach(event => {
      if (!grouped[event.type]) {
        grouped[event.type] = [];
      }
      grouped[event.type].push(event);
    });
    
    return grouped;
  }

  /**
   * Send events of a specific type
   */
  private async sendEventsByType(type: string, events: SecurityAlertEvent[], apiUrl: string): Promise<void> {
    try {
      const response = await fetch(`${apiUrl}/api/security/telemetry/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Security-Telemetry': 'true'
        },
        body: JSON.stringify({
          events,
          batchMetadata: {
            batchSize: events.length,
            priorityBreakdown: this.getPriorityBreakdown(events),
            clientTimestamp: Date.now(),
            clientVersion: '1.0.0',
            eventType: type
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`[SecurityAlertTracking] Successfully sent ${events.length} ${type} events`);
    } catch (error) {
      console.error(`[SecurityAlertTracking] Failed to send ${type} events:`, error);
      throw error;
    }
  }

  /**
   * Get priority breakdown for analytics metadata
   */
  private getPriorityBreakdown(events: SecurityAlertEvent[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    events.forEach(event => {
      const priority = event.priority || 'normal';
      breakdown[priority] = (breakdown[priority] || 0) + 1;
    });
    return breakdown;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Start periodic batch timer
   */
  private startBatchTimer(): void {
    if (typeof window === 'undefined') return;
    
    this.batchInterval = setInterval(() => {
      this.sendBatch();
    }, this.BATCH_INTERVAL);
  }

  /**
   * Setup page unload handler to send remaining events
   */
  private setupUnloadHandler(): void {
    if (typeof window === 'undefined') return;

    const handleUnload = () => {
      // Send synchronously on unload (best effort)
      if (this.events.length > 0 && !this.isSending) {
        const eventsToSend = [...this.events];
        
        // Use sendBeacon for reliable delivery on page unload
        if (navigator.sendBeacon) {
          const eventsByType = this.groupEventsByType(eventsToSend);
          
          Object.entries(eventsByType).forEach(([type, events]) => {
            const blob = new Blob([JSON.stringify({
              events,
              batchMetadata: {
                batchSize: events.length,
                priorityBreakdown: this.getPriorityBreakdown(events),
                clientTimestamp: Date.now(),
                eventType: type,
                unload: true
              }
            })], { type: 'application/json' });
            
            navigator.sendBeacon(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'}/api/security/telemetry/${type}`, blob);
          });
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('unload', handleUnload);
  }

  /**
   * Setup online/offline detection
   */
  private setupOnlineDetection(): void {
    if (typeof window === 'undefined') return;

    // Set initial online state
    this.isOnline = navigator.onLine;

    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('[SecurityAlertTracking] Back online, resuming batch sending');
      this.isOnline = true;
      this.retryState.attempts = 0; // Reset retry attempts on reconnection
      this.sendBatch(); // Immediately try to send pending events
    });

    window.addEventListener('offline', () => {
      console.log('[SecurityAlertTracking] Gone offline, queuing security events');
      this.isOnline = false;
    });
  }

  /**
   * Load cached events from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.events = Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.warn('[SecurityAlertTracking] Failed to load from storage:', error);
      this.events = [];
    }
  }

  /**
   * Save cached events to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events));
    } catch (error) {
      console.warn('[SecurityAlertTracking] Failed to save to storage:', error);
    }
  }

  /**
   * Load retry state from localStorage
   */
  private loadRetryState(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.RETRY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.retryState = { ...this.retryState, ...parsed };
      }
    } catch (error) {
      console.warn('[SecurityAlertTracking] Failed to load retry state:', error);
    }
  }

  /**
   * Save retry state to localStorage
   */
  private saveRetryState(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.RETRY_KEY, JSON.stringify(this.retryState));
    } catch (error) {
      console.warn('[SecurityAlertTracking] Failed to save retry state:', error);
    }
  }

  /**
   * Load metrics from localStorage
   */
  private loadMetrics(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.METRICS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.metrics = { ...this.metrics, ...parsed };
      }
    } catch (error) {
      console.warn('[SecurityAlertTracking] Failed to load metrics:', error);
    }
  }

  /**
   * Save metrics to localStorage
   */
  private saveMetrics(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.METRICS_KEY, JSON.stringify(this.metrics));
    } catch (error) {
      console.warn('[SecurityAlertTracking] Failed to save metrics:', error);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }
}

// Global cache instance
let securityTrackingCache: SecurityAlertTrackingCache | null = null;

function getSecurityTrackingCache(): SecurityAlertTrackingCache {
  if (!securityTrackingCache && typeof window !== 'undefined') {
    securityTrackingCache = new SecurityAlertTrackingCache();
  }
  return securityTrackingCache!;
}

/**
 * Track security event with enhanced metadata collection
 */
export function trackSecurityEvent(event: Omit<SecurityAlertEvent, 'timestamp' | 'priority'>): void {
  if (typeof window === 'undefined') return;

  const cache = getSecurityTrackingCache();
  
  // Add session and user context
  const eventWithSession = {
    ...event,
    // Session info will be added by the cache
  };
  
  console.log('[Security Tracking Debug] Adding security event:', eventWithSession);
  cache.addEvent(eventWithSession);
}

/**
 * Track rate limit exceeded event
 */
export function trackRateLimitExceeded(metadata: SecurityAlertEvent['metadata']): void {
  trackSecurityEvent({
    type: 'rate_limit_exceeded',
    severity: metadata.rateAnalysis?.triggerReason === 'limit_exceeded' ? 'warning' : 'info',
    metadata
  });
}

/**
 * Track authentication failure
 */
export function trackAuthFailure(metadata: SecurityAlertEvent['metadata']): void {
  trackSecurityEvent({
    type: 'auth_failure',
    severity: 'critical',
    metadata
  });
}

/**
 * Track suspicious activity
 */
export function trackSuspiciousActivity(metadata: SecurityAlertEvent['metadata']): void {
  trackSecurityEvent({
    type: 'suspicious_activity',
    severity: metadata.threatLevel === 'critical' ? 'critical' : 'warning',
    metadata
  });
}

/**
 * Track security incident
 */
export function trackSecurityIncident(metadata: SecurityAlertEvent['metadata']): void {
  trackSecurityEvent({
    type: 'security_incident',
    severity: 'critical',
    metadata
  });
}

/**
 * Get security tracking metrics
 */
export function getSecurityTrackingMetrics() {
  const cache = getSecurityTrackingCache();
  return cache.getMetrics();
}

export type { SecurityAlertEvent, SecurityAlertTrackingCache };
