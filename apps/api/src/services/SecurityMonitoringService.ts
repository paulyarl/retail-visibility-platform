/**
 * Security Monitoring Service - API Server Singleton
 * Simple working implementation
 */

import { UniversalSingleton, SingletonCacheOptions, AuthContext } from '../lib/UniversalSingleton';

export interface SecurityEvent {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: {
    ip: string;
    userAgent?: string;
    userId?: string;
    tenantId?: string;
  };
  details: Record<string, any>;
  timestamp: string;
  resolved: boolean;
}

export interface SecurityMetrics {
  totalEvents: number;
  threatsDetected: number;
  blockedIPs: number;
  alertsGenerated: number;
  failedLoginAttempts: number;
  suspiciousActivities: number;
  averageResponseTime: number;
  lastUpdated: string;
}

export interface BlockedIP {
  id: string;
  ipAddress: string;
  reason: string;
  blockedAt: Date;
  expiresAt: Date;
  permanent: boolean;
  metadata?: Record<string, any>;
}

class SecurityMonitoringService extends UniversalSingleton {
  private static instance: SecurityMonitoringService;
  private eventQueue: SecurityEvent[] = [];
  private processingInterval: NodeJS.Timeout | null = null;
  private blockedIPs: Map<string, BlockedIP> = new Map();
  protected currentAuthContext: AuthContext | null = null;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      enableCache: true,
      enableEncryption: true,
      enablePrivateCache: true,
      authenticationLevel: 'admin',
      defaultTTL: 300,
      maxCacheSize: 1000,
      enableMetrics: true,
      enableLogging: true,
      ...cacheOptions
    });
    this.startEventProcessing();
  }

  static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService('security-monitoring-service');
    }
    return SecurityMonitoringService.instance;
  }

  private startEventProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processEventQueue();
    }, 5000);
  }

  // ====================
  // REQUIRED METHODS
  // ====================

  setAuthContext(authContext: AuthContext): void {
    this.currentAuthContext = authContext;
    console.log(`[SECURITY-MONITORING] Authentication context set for user: ${authContext.userId}`);
  }

  public hasRole(role: string): boolean {
    return this.currentAuthContext?.roles?.includes(role) || false;
  }

  public hasPermission(permission: string): boolean {
    return this.currentAuthContext?.permissions?.includes(permission) || false;
  }

  protected logInfo(message: string, metadata?: any): void {
    console.log(`[SECURITY-MONITORING] INFO: ${message}`, metadata || '');
  }

  async storeSensitiveSecurityData<T>(
    key: string, 
    data: T, 
    options?: { ttl?: number; encrypt?: boolean }
  ): Promise<void> {
    if (!this.hasRole('admin')) {
      throw new Error('Insufficient permissions to store sensitive security data');
    }

    await this.setPrivateCache(`security-sensitive-${key}`, data, {
      ttl: options?.ttl || 3600,
      encrypt: options?.encrypt ?? true
    });

    this.logInfo('Sensitive security data stored', { key, encrypted: true });
  }

  async getSensitiveSecurityData<T>(key: string): Promise<T | null> {
    if (!this.hasRole('admin')) {
      throw new Error('Insufficient permissions to access sensitive security data');
    }

    const data = await this.getFromPrivateCache<T>(`security-sensitive-${key}`);
    
    if (data) {
      this.logInfo('Sensitive security data retrieved', { key });
    }

    return data;
  }

  async processSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): Promise<SecurityEvent> {
    return this.recordEvent(event);
  }

  async recordEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): Promise<SecurityEvent> {
    const securityEvent: SecurityEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      resolved: false
    };

    this.eventQueue.push(securityEvent);

    return securityEvent;
  }

  async getSecurityMetrics(hours: number = 24): Promise<SecurityMetrics> {
    const cacheKey = `security-metrics-${hours}`;
    
    const cached = await this.getFromCache<SecurityMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    const metrics: SecurityMetrics = {
      totalEvents: 0,
      threatsDetected: 0,
      blockedIPs: this.blockedIPs.size,
      alertsGenerated: 0,
      failedLoginAttempts: 0,
      suspiciousActivities: 0,
      averageResponseTime: 0,
      lastUpdated: new Date().toISOString()
    };
    
    await this.setCache(cacheKey, metrics);
    return metrics;
  }

  async getBlockedIPs(): Promise<BlockedIP[]> {
    return Array.from(this.blockedIPs.values());
  }

  async blockIP(ip: string, durationMinutes: number = 60, reason: string = 'Security violation'): Promise<BlockedIP> {
    const blockedIP: BlockedIP = {
      id: this.generateId(),
      ipAddress: ip,
      reason,
      blockedAt: new Date(),
      expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000),
      permanent: durationMinutes === 0,
      metadata: { blockedBy: this.currentAuthContext?.userId }
    };

    this.blockedIPs.set(ip, blockedIP);
    
    const cacheKey = `blocked-ip-${blockedIP.id}`;
    await this.setCache(cacheKey, blockedIP);

    this.logInfo('IP blocked', { ip, reason, durationMinutes });
    return blockedIP;
  }

  async unblockIP(ip: string): Promise<void> {
    this.blockedIPs.delete(ip);
    this.logInfo('IP unblocked', { ip });
  }

  async cleanup(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    await this.processEventQueue();
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private async processEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    await Promise.all(events.map(event => this.processEvent(event)));
  }

  private async processEvent(event: SecurityEvent): Promise<void> {
    try {
      event.resolved = true;
      this.logInfo('Security event processed', { eventId: event.id, type: event.type });
    } catch (error) {
      console.error(`[SECURITY-MONITORING] ERROR: Failed to process security event`, error);
    }
  }
}

// Export singleton instance
export const securityMonitoringService = SecurityMonitoringService.getInstance();
export default SecurityMonitoringService;
