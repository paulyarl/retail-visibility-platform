/**
 * Threat Detection Service - Phase 3 Advanced Security
 * Implements intrusion detection, anomaly monitoring, and security threat analysis
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { Request, Response } from 'express';

export interface ThreatEvent {
  id: string;
  type: 'failed_login' | 'suspicious_activity' | 'rate_limit_exceeded' | 'anomaly_detected' | 'brute_force_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ipAddress: string;
  userAgent: string;
  userId?: string;
  metadata: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
}

export interface SecurityMetrics {
  failedLogins: number;
  failedLoginAttempts: number;
  blockedRequests: number;
  suspiciousActivities: number;
  rateLimitHits: number;
  activeThreats: number;
  // Additional fields expected by frontend
  activeUsers?: number;
  mfaAdoptionRate?: number;
  averageResponseTime?: number;
  previousPeriod?: {
    failedLoginAttempts: number;
    blockedRequests: number;
    suspiciousActivities: number;
    activeUsers: number;
    rateLimitHits: number;
  };
}

export class ThreatDetectionService {
  private readonly MAX_FAILED_LOGINS = 5;
  private readonly BLOCK_DURATION_MINUTES = 30;
  private readonly SUSPICIOUS_ACTIVITY_THRESHOLD = 10;

  /**
   * Record a failed login attempt
   */
  async recordFailedLogin(ipAddress: string, userAgent: string, attemptedEmail?: string): Promise<void> {
    try {
      // Count recent failed attempts from this IP
      const recentFailures = await this.getRecentFailedLogins(ipAddress, 15); // Last 15 minutes

      const severity = recentFailures >= this.MAX_FAILED_LOGINS ? 'high' :
                      recentFailures >= 3 ? 'medium' : 'low';

      // Log the threat event
      await this.logThreatEvent({
        type: 'failed_login',
        severity,
        ipAddress,
        userAgent,
        metadata: {
          attemptedEmail: attemptedEmail || 'unknown',
          failureCount: recentFailures + 1,
          timeWindow: '15 minutes'
        }
      });

      // Check if IP should be blocked
      if (recentFailures + 1 >= this.MAX_FAILED_LOGINS) {
        await this.blockIP(ipAddress, `Excessive failed login attempts (${recentFailures + 1})`);
        logger.warn('IP blocked due to failed login attempts', undefined, { ipAddress, attempts: recentFailures + 1 });
      }

    } catch (error) {
      logger.error('Failed to record failed login', undefined, { ipAddress, error: error as any });
    }
  }

  /**
   * Record suspicious activity
   */
  async recordSuspiciousActivity(
    ipAddress: string,
    userAgent: string,
    activity: string,
    userId?: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      // Count recent suspicious activities from this IP
      const recentActivities = await this.getRecentSuspiciousActivities(ipAddress, 60); // Last hour

      const severity = recentActivities >= this.SUSPICIOUS_ACTIVITY_THRESHOLD ? 'critical' :
                      recentActivities >= 5 ? 'high' :
                      recentActivities >= 2 ? 'medium' : 'low';

      await this.logThreatEvent({
        type: 'suspicious_activity',
        severity,
        ipAddress,
        userAgent,
        userId,
        metadata: {
          activity,
          activityCount: recentActivities + 1,
          timeWindow: '60 minutes',
          ...metadata
        }
      });

      if (severity === 'critical') {
        await this.blockIP(ipAddress, `Critical suspicious activity detected: ${activity}`);
        logger.warn('IP blocked due to critical suspicious activity', undefined, { ipAddress, activity });
      }

    } catch (error) {
      logger.error('Failed to record suspicious activity', undefined, { ipAddress, activity, error: error as any });
    }
  }

  /**
   * Record rate limit exceeded
   */
  async recordRateLimitExceeded(ipAddress: string, userAgent: string, endpoint: string): Promise<void> {
    try {
      const recentRateLimits = await this.getRecentRateLimitHits(ipAddress, 5); // Last 5 minutes

      const severity = recentRateLimits >= 10 ? 'high' :
                      recentRateLimits >= 5 ? 'medium' : 'low';

      await this.logThreatEvent({
        type: 'rate_limit_exceeded',
        severity,
        ipAddress,
        userAgent,
        metadata: {
          endpoint,
          hitCount: recentRateLimits + 1,
          timeWindow: '5 minutes'
        }
      });

      if (severity === 'high') {
        await this.blockIP(ipAddress, `High frequency rate limit violations on ${endpoint}`);
      }

    } catch (error) {
      logger.error('Failed to record rate limit violation', undefined, { ipAddress, endpoint, error: error as any });
    }
  }

  /**
   * Check if an IP is currently blocked
   */
  async isIPBlocked(ipAddress: string): Promise<boolean> {
    try {
      // Check for active blocks (not expired and not resolved)
      const activeBlock = await prisma.security_threats.findFirst({
        where: {
          ip_address: ipAddress,
          type: 'ip_block',
          resolved: false,
          created_at: {
            gte: new Date(Date.now() - this.BLOCK_DURATION_MINUTES * 60 * 1000)
          }
        }
      });

      return !!activeBlock;

    } catch (error) {
      logger.error('Failed to check IP block status', undefined, { ipAddress, error: error as any });
      return false;
    }
  }

  /**
   * Block an IP address
   */
  private async blockIP(ipAddress: string, reason: string): Promise<void> {
    try {
      await this.logThreatEvent({
        type: 'brute_force_attempt',
        severity: 'critical',
        ipAddress,
        userAgent: 'system',
        metadata: {
          action: 'ip_block',
          reason,
          blockDuration: `${this.BLOCK_DURATION_MINUTES} minutes`,
          autoBlock: true
        }
      });

      logger.info('IP address blocked', undefined, { ipAddress, reason });

    } catch (error) {
      logger.error('Failed to block IP', undefined, { ipAddress, reason, error: error as any });
    }
  }

  /**
   * Log a threat event to the database
   */
  private async logThreatEvent(event: Omit<ThreatEvent, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    try {
      await prisma.security_threats.create({
        data: {
          type: event.type,
          severity: event.severity,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          user_id: event.userId,
          metadata: event.metadata,
          resolved: false
        }
      });

    } catch (error) {
      logger.error('Failed to log threat event', undefined, { event, error: error as any });
      // Don't throw - threat detection shouldn't break the application
    }
  }

  /**
   * Get security metrics for monitoring dashboard
   */
  async getSecurityMetrics(hours: number = 24): Promise<SecurityMetrics> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const previousPeriodStart = new Date(Date.now() - (hours * 2) * 60 * 60 * 1000);

      const [
        failedLoginAttempts,
        blockedRequests,
        suspiciousActivities,
        rateLimitHits,
        activeThreats,
        activeUsers,
        previousFailedLoginAttempts,
        previousBlockedRequests,
        previousSuspiciousActivities,
        previousRateLimitHits
      ] = await Promise.all([
        prisma.security_threats.count({
          where: { type: 'failed_login', created_at: { gte: since } }
        }),
        prisma.security_threats.count({
          where: {
            type: 'brute_force_attempt',
            resolved: false,
            created_at: { gte: since }
          }
        }),
        prisma.security_threats.count({
          where: { type: 'suspicious_activity', created_at: { gte: since } }
        }),
        prisma.security_alerts.count({
          where: {
            OR: [
              { type: 'rate_limit_exceeded' },
              { type: 'auth_rate_limit_exceeded' },
              { type: 'search_rate_limit_exceeded' },
              { type: 'upload_rate_limit_exceeded' },
              { type: 'costly_api_rate_limit_exceeded' },
              { type: 'admin_rate_limit_exceeded' },
              { type: 'store_status_rate_limit_exceeded' }
            ],
            created_at: { gte: since }
          }
        }),
        prisma.security_threats.count({
          where: { resolved: false, created_at: { gte: since } }
        }),
        // Get active users (users with recent activity)
        prisma.user_sessions_list.count({
          where: {
            expires_at: { gt: new Date() },
            created_at: { gte: since }
          }
        }),
        // Previous period data
        prisma.security_threats.count({
          where: { type: 'failed_login', created_at: { gte: previousPeriodStart, lt: since } }
        }),
        prisma.security_threats.count({
          where: {
            type: 'brute_force_attempt',
            resolved: false,
            created_at: { gte: previousPeriodStart, lt: since }
          }
        }),
        prisma.security_threats.count({
          where: { type: 'suspicious_activity', created_at: { gte: previousPeriodStart, lt: since } }
        }),
        prisma.security_alerts.count({
          where: {
            OR: [
              { type: 'rate_limit_exceeded' },
              { type: 'auth_rate_limit_exceeded' },
              { type: 'search_rate_limit_exceeded' },
              { type: 'upload_rate_limit_exceeded' },
              { type: 'costly_api_rate_limit_exceeded' },
              { type: 'admin_rate_limit_exceeded' },
              { type: 'store_status_rate_limit_exceeded' }
            ],
            created_at: { gte: previousPeriodStart, lt: since }
          }
        })
      ]);

      return {
        failedLogins: failedLoginAttempts,
        failedLoginAttempts,
        blockedRequests,
        suspiciousActivities,
        rateLimitHits,
        activeThreats,
        activeUsers,
        mfaAdoptionRate: 75, // Mock value - would need to calculate from user MFA settings
        averageResponseTime: 45, // Mock value - would need to track response times
        previousPeriod: {
          failedLoginAttempts: previousFailedLoginAttempts,
          blockedRequests: previousBlockedRequests,
          suspiciousActivities: previousSuspiciousActivities,
          activeUsers: Math.floor(activeUsers * 0.9), // Estimate previous period
          rateLimitHits: previousRateLimitHits
        }
      };

    } catch (error) {
      logger.error('Failed to get security metrics', undefined, { error: error as any });
      return {
        failedLogins: 0,
        failedLoginAttempts: 0,
        blockedRequests: 0,
        suspiciousActivities: 0,
        rateLimitHits: 0,
        activeThreats: 0,
        activeUsers: 0,
        mfaAdoptionRate: 0,
        averageResponseTime: 0,
        previousPeriod: {
          failedLoginAttempts: 0,
          blockedRequests: 0,
          suspiciousActivities: 0,
          activeUsers: 0,
          rateLimitHits: 0
        }
      };
    }
  }

  /**
   * Analyze request patterns for anomalies
   */
  async analyzeRequestPattern(req: Request): Promise<{
    isAnomalous: boolean;
    riskScore: number;
    reasons: string[];
  }> {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const reasons: string[] = [];
    let riskScore = 0;

    try {
      // Check for rapid requests from same IP
      const recentRequests = await this.getRecentRequestsFromIP(ipAddress, 1); // Last minute
      if (recentRequests > 100) {
        reasons.push('High request frequency');
        riskScore += 30;
      } else if (recentRequests > 50) {
        reasons.push('Elevated request frequency');
        riskScore += 15;
      }

      // Check for suspicious user agents
      if (this.isSuspiciousUserAgent(userAgent)) {
        reasons.push('Suspicious user agent');
        riskScore += 25;
      }

      // Check for known malicious patterns
      if (this.hasMaliciousPatterns(req)) {
        reasons.push('Malicious request patterns detected');
        riskScore += 40;
      }

      // Check geographic anomalies if available
      const geoRisk = await this.assessGeographicRisk(ipAddress);
      riskScore += geoRisk.score;
      if (geoRisk.reasons.length > 0) {
        reasons.push(...geoRisk.reasons);
      }

      const isAnomalous = riskScore >= 50;

      if (isAnomalous) {
        await this.recordSuspiciousActivity(
          ipAddress,
          userAgent,
          'Request pattern anomaly detected',
          undefined,
          { riskScore, reasons }
        );
      }

      return { isAnomalous, riskScore, reasons };

    } catch (error) {
      logger.error('Request pattern analysis failed', undefined, { ipAddress, error: error as any });
      return { isAnomalous: false, riskScore: 0, reasons: [] };
    }
  }

  // Helper methods for threat analysis
  private async getRecentFailedLogins(ipAddress: string, minutes: number): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return await prisma.security_threats.count({
      where: {
        ip_address: ipAddress,
        type: 'failed_login',
        created_at: { gte: since }
      }
    });
  }

  private async getRecentSuspiciousActivities(ipAddress: string, minutes: number): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return await prisma.security_threats.count({
      where: {
        ip_address: ipAddress,
        type: 'suspicious_activity',
        created_at: { gte: since }
      }
    });
  }

  private async getRecentRateLimitHits(ipAddress: string, minutes: number): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return await prisma.security_threats.count({
      where: {
        ip_address: ipAddress,
        type: 'rate_limit_exceeded',
        created_at: { gte: since }
      }
    });
  }

  private async getRecentRequestsFromIP(ipAddress: string, minutes: number): Promise<number> {
    // This would need to be implemented with a request log table
    // For now, return a mock value
    return 0;
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      'sqlmap',
      'nmap',
      'nikto',
      'dirbuster',
      'gobuster',
      'masscan',
      'zgrab',
      'nessus'
    ];

    return suspiciousPatterns.some(pattern =>
      userAgent.toLowerCase().includes(pattern)
    );
  }

  private hasMaliciousPatterns(req: Request): boolean {
    // Check for common attack patterns in URL and body
    const url = req.originalUrl;
    const maliciousPatterns = [
      /\.\.\//,  // Directory traversal
      /<script/i,  // XSS attempts
      /union.*select/i,  // SQL injection
      /eval\(/i,  // Code injection
      /base64_/i  // Base64 encoded attacks
    ];

    return maliciousPatterns.some(pattern => pattern.test(url));
  }

  private async assessGeographicRisk(ipAddress: string): Promise<{ score: number; reasons: string[] }> {
    // This would integrate with a GeoIP service
    // For now, return minimal risk
    return { score: 0, reasons: [] };
  }
}

// Create singleton instance
export const threatDetectionService = new ThreatDetectionService();
