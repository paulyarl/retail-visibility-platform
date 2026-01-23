/**
 * Security Monitoring Singleton - Producer Pattern
 * 
 * Produces and manages security monitoring data
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';
import { SecurityThreat, SecurityAlert, BlockedIP, SecurityMetrics } from '@/types/security';

// Security Monitoring Data Interfaces
export interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'request' | 'threat' | 'alert' | 'block';
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: {
    ip: string;
    userAgent?: string;
    userId?: string;
    tenantId?: string;
  };
  details: Record<string, any>;
  resolved: boolean;
}

export interface SecurityMonitoringConfig {
  enableRealTimeMonitoring: boolean;
  threatDetectionThreshold: number;
  alertRetentionDays: number;
  blockDurationMinutes: number;
  enableAutoBlocking: boolean;
}

export interface SecurityMonitoringStats {
  totalEvents: number;
  activeThreats: number;
  blockedRequests: number;
  uniqueIPs: number;
  securityScore: number;
  lastEventTime: string;
}

/**
 * Security Monitoring Singleton - Producer Pattern
 * 
 * Produces security monitoring data and manages threat detection
 */
class SecurityMonitoringSingleton extends UniversalSingleton {
  private static instance: SecurityMonitoringSingleton;
  private monitoringConfig: SecurityMonitoringConfig;
  private eventBuffer: SecurityEvent[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
    this.monitoringConfig = {
      enableRealTimeMonitoring: true,
      threatDetectionThreshold: 10,
      alertRetentionDays: 30,
      blockDurationMinutes: 60,
      enableAutoBlocking: true
    };
    this.initializeMonitoring();
  }

  static getInstance(): SecurityMonitoringSingleton {
    if (!SecurityMonitoringSingleton.instance) {
      SecurityMonitoringSingleton.instance = new SecurityMonitoringSingleton('security-monitoring-singleton');
    }
    return SecurityMonitoringSingleton.instance;
  }

  // ====================
  // MONITORING INITIALIZATION
  // ====================

  private initializeMonitoring(): void {
    if (this.monitoringConfig.enableRealTimeMonitoring) {
      // Start real-time monitoring
      this.monitoringInterval = setInterval(() => {
        this.processSecurityEvents();
      }, 30000); // Process every 30 seconds
    }
  }

  // ====================
  // SECURITY EVENT PRODUCTION
  // ====================

  /**
   * Record a security event
   */
  async recordSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): Promise<SecurityEvent> {
    const securityEvent: SecurityEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      resolved: false
    };

    // Add to event buffer
    this.eventBuffer.push(securityEvent);

    // Cache the event
    const cacheKey = `security-event-${securityEvent.id}`;
    await this.setCache(cacheKey, securityEvent);

    // Process immediately for high severity events
    if (event.severity === 'critical' || event.severity === 'high') {
      await this.processSecurityEvent(securityEvent);
    }

    return securityEvent;
  }

  /**
   * Process a single security event
   */
  private async processSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Check if this is a threat
      if (this.isThreatEvent(event)) {
        await this.handleThreatEvent(event);
      }

      // Check if alert should be generated
      if (this.shouldGenerateAlert(event)) {
        await this.generateSecurityAlert(event);
      }

      // Check if IP should be blocked
      if (this.shouldBlockIP(event)) {
        await this.blockIPAddress(event.source.ip, event);
      }

      // Mark as processed
      event.resolved = true;
    } catch (error) {
      console.error('Error processing security event:', error);
    }
  }

  /**
   * Process buffered security events
   */
  private async processSecurityEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    // Process events in parallel
    await Promise.all(events.map(event => this.processSecurityEvent(event)));
  }

  // ====================
  // THREAT DETECTION & HANDLING
  // ====================

  /**
   * Check if event is a threat
   */
  private isThreatEvent(event: SecurityEvent): boolean {
    const threatIndicators = [
      'multiple_failed_logins',
      'suspicious_request_pattern',
      'sql_injection_attempt',
      'xss_attempt',
      'rate_limit_exceeded',
      'blocked_country'
    ];

    return threatIndicators.some(indicator => 
      event.details[indicator] || event.details.type === indicator
    );
  }

  /**
   * Handle threat event
   */
  private async handleThreatEvent(event: SecurityEvent): Promise<void> {
    try {
      const threat: SecurityThreat = {
        id: this.generateThreatId(),
        type: 'suspicious_activity' as any, // Cast to any to handle type mismatch
        severity: event.severity as any, // Cast to any to handle type mismatch
        status: 'active',
        description: this.generateThreatDescription(event),
        source: event.source.ip,
        detectedAt: event.timestamp,
        affectedResources: [],
        ipAddress: event.source.ip,
        userAgent: '',
        metadata: event.details,
        timestamp: new Date(event.timestamp),
        resolved: false
      };

      // Send threat to API for storage
      await this.sendThreatToAPI(threat);

      // Cache threat
      const cacheKey = `security-threat-${threat.id}`;
      await this.setCache(cacheKey, threat);
    } catch (error) {
      console.error('Error handling threat event:', error);
    }
  }

  /**
   * Generate security alert
   */
  private async generateSecurityAlert(event: SecurityEvent): Promise<void> {
    try {
      const alert: SecurityAlert = {
        id: this.generateAlertId(),
        type: 'suspicious_activity', // Use a valid type from the interface
        title: 'Security Alert',
        severity: event.severity === 'critical' ? 'critical' : event.severity === 'high' ? 'error' : 'warning',
        message: this.generateAlertMessage(event),
        createdAt: new Date(event.timestamp),
        read: false,
        metadata: event.details
      };

      // Send alert to API
      await this.sendAlertToAPI(alert);

      // Cache alert
      const cacheKey = `security-alert-${alert.id}`;
      await this.setCache(cacheKey, alert);
    } catch (error) {
      console.error('Error generating security alert:', error);
    }
  }

  /**
   * Block IP address
   */
  private async blockIPAddress(ip: string, event: SecurityEvent): Promise<void> {
    try {
      const blockedIP: BlockedIP = {
        id: this.generateBlockId(),
        ipAddress: ip,
        reason: this.generateBlockReason(event),
        blockedAt: new Date(event.timestamp),
        expiresAt: new Date(Date.now() + this.monitoringConfig.blockDurationMinutes * 60 * 1000),
        permanent: false,
        attempts: 1,
        metadata: event.details
      };

      // Send block to API
      await this.sendIPBlockToAPI(blockedIP);

      // Cache block
      const cacheKey = `blocked-ip-${blockedIP.id}`;
      await this.setCache(cacheKey, blockedIP);
    } catch (error) {
      console.error('Error blocking IP address:', error);
    }
  }

  // ====================
  // MONITORING CONFIGURATION
  // ====================

  /**
   * Update monitoring configuration
   */
  async updateMonitoringConfig(config: Partial<SecurityMonitoringConfig>): Promise<void> {
    this.monitoringConfig = { ...this.monitoringConfig, ...config };
    
    // Cache configuration
    await this.setCache('monitoring-config', this.monitoringConfig);

    // Restart monitoring if needed
    if (config.enableRealTimeMonitoring !== undefined) {
      if (config.enableRealTimeMonitoring && !this.monitoringInterval) {
        this.initializeMonitoring();
      } else if (!config.enableRealTimeMonitoring && this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
    }
  }

  /**
   * Get monitoring configuration
   */
  async getMonitoringConfig(): Promise<SecurityMonitoringConfig> {
    const cached = await this.getFromCache<SecurityMonitoringConfig>('monitoring-config');
    if (cached) {
      return cached;
    }

    await this.setCache('monitoring-config', this.monitoringConfig);
    return this.monitoringConfig;
  }

  // ====================
  // MONITORING STATISTICS
  // ====================

  /**
   * Get monitoring statistics
   */
  async getMonitoringStats(): Promise<SecurityMonitoringStats> {
    const cacheKey = 'monitoring-stats';
    
    const cached = await this.getFromCache<SecurityMonitoringStats>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch('/api/security/monitoring/stats');
      
      if (!response.ok) {
        throw new Error('Failed to fetch monitoring stats');
      }

      const stats = await response.json();
      
      await this.setCache(cacheKey, stats);
      return stats;
    } catch (error) {
      console.error('Error fetching monitoring stats:', error);
      return {
        totalEvents: 0,
        activeThreats: 0,
        blockedRequests: 0,
        uniqueIPs: 0,
        securityScore: 100,
        lastEventTime: new Date().toISOString()
      };
    }
  }

  // ====================
  // MONITORING SPECIFIC METRICS
  // ====================

  protected getCustomMetrics(): Record<string, any> {
    return {
      eventsProcessed: this.eventBuffer.length,
      monitoringActive: !!this.monitoringInterval,
      threatsDetected: 0,
      alertsGenerated: 0,
      ipsBlocked: 0,
      lastProcessTime: new Date().toISOString()
    };
  }

  // ====================
  // UTILITY METHODS
  // ====================

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateThreatId(): string {
    return `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBlockId(): string {
    return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldGenerateAlert(event: SecurityEvent): boolean {
    return event.severity === 'high' || event.severity === 'critical';
  }

  private shouldBlockIP(event: SecurityEvent): boolean {
    if (!this.monitoringConfig.enableAutoBlocking) return false;
    
    return event.severity === 'critical' || 
           event.details.type === 'multiple_failed_logins' ||
           event.details.type === 'rate_limit_exceeded';
  }

  private generateThreatDescription(event: SecurityEvent): string {
    const type = event.details.type || 'suspicious_activity';
    const ip = event.source.ip;
    return `${type} detected from IP ${ip}`;
  }

  private generateAlertMessage(event: SecurityEvent): string {
    const type = event.details.type || 'security_event';
    const severity = event.severity.toUpperCase();
    return `${severity}: ${type} detected from ${event.source.ip}`;
  }

  private getAlertType(event: SecurityEvent): string {
    return event.details.type || 'security_alert';
  }

  private generateBlockReason(event: SecurityEvent): string {
    return `Auto-blocked due to: ${event.details.type || 'suspicious_activity'}`;
  }

  // ====================
  // API COMMUNICATION
  // ====================

  private async sendThreatToAPI(threat: SecurityThreat): Promise<void> {
    try {
      const response = await fetch('/api/security/threats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(threat)
      });

      if (!response.ok) {
        throw new Error('Failed to send threat to API');
      }
    } catch (error) {
      console.error('Error sending threat to API:', error);
    }
  }

  private async sendAlertToAPI(alert: SecurityAlert): Promise<void> {
    try {
      const response = await fetch('/api/security/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
      });

      if (!response.ok) {
        throw new Error('Failed to send alert to API');
      }
    } catch (error) {
      console.error('Error sending alert to API:', error);
    }
  }

  private async sendIPBlockToAPI(blockedIP: BlockedIP): Promise<void> {
    try {
      const response = await fetch('/api/security/blocked-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blockedIP)
      });

      if (!response.ok) {
        throw new Error('Failed to send IP block to API');
      }
    } catch (error) {
      console.error('Error sending IP block to API:', error);
    }
  }

  // ====================
  // CLEANUP
  // ====================

  /**
   * Cleanup monitoring resources
   */
  async cleanup(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    // Process remaining events
    await this.processSecurityEvents();
    
    // Clear cache
    await this.clearCache();
  }
}

// Export singleton instance
export const securityMonitoringSingleton = SecurityMonitoringSingleton.getInstance();

export default SecurityMonitoringSingleton;
