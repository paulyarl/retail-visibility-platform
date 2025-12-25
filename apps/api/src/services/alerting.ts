/**
 * Alerting System for Critical Issues and Performance Monitoring
 * Phase 1: Basic alerting with logging and future extensibility for email/Slack
 */
import { logger, LogLevel } from '../logger';
import type { RequestCtx } from '../context';

// Alert severity levels
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Alert types
export enum AlertType {
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  ERROR = 'error',
  SYSTEM = 'system',
  BUSINESS = 'business',
}

// Alert interface
export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  context?: RequestCtx;
  metadata?: Record<string, any>;
  timestamp: string;
  resolved?: boolean;
  resolvedAt?: string;
}

// Alert manager class
class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private alertCooldowns: Map<string, number> = new Map();

  // Cooldown periods for different alert types (in milliseconds)
  private readonly COOLDOWN_PERIODS = {
    [AlertType.SECURITY]: 5 * 60 * 1000,    // 5 minutes
    [AlertType.PERFORMANCE]: 10 * 60 * 1000, // 10 minutes
    [AlertType.ERROR]: 2 * 60 * 1000,       // 2 minutes
    [AlertType.SYSTEM]: 15 * 60 * 1000,     // 15 minutes
    [AlertType.BUSINESS]: 30 * 60 * 1000,   // 30 minutes
  };

  // Thresholds for automatic alerts
  private readonly THRESHOLDS = {
    responseTime: 5000,        // 5 seconds
    errorRate: 0.05,          // 5% error rate
    memoryUsage: 0.9,         // 90% memory usage
    cpuUsage: 0.95,           // 95% CPU usage
    diskUsage: 0.95,          // 95% disk usage
  };

  /**
   * Create and send an alert
   */
  alert(
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    context?: RequestCtx,
    metadata?: Record<string, any>
  ): void {
    // Check cooldown to prevent alert spam
    const cooldownKey = `${type}:${title}`;
    const lastAlertTime = this.alertCooldowns.get(cooldownKey);
    const cooldownPeriod = this.COOLDOWN_PERIODS[type];

    if (lastAlertTime && Date.now() - lastAlertTime < cooldownPeriod) {
      logger.debug(`Alert suppressed due to cooldown: ${title}`, context);
      return;
    }

    const alert: Alert = {
      id: this.generateAlertId(),
      type,
      severity,
      title,
      message,
      context,
      metadata,
      timestamp: new Date().toISOString(),
    };

    // Store alert
    this.alerts.set(alert.id, alert);
    this.alertCooldowns.set(cooldownKey, Date.now());

    // Log alert
    const logLevel = severity === AlertSeverity.CRITICAL ? LogLevel.ERROR :
                    severity === AlertSeverity.HIGH ? LogLevel.WARN :
                    LogLevel.INFO;

    logger.log(logLevel, `🚨 ALERT [${severity.toUpperCase()}] ${title}: ${message}`, context, {
      alertId: alert.id,
      alertType: type,
      ...metadata,
    });

    // Send external notifications (Phase 2 - email, Slack, etc.)
    this.sendExternalNotification(alert);

    // Auto-resolve non-critical alerts after some time
    if (severity !== AlertSeverity.CRITICAL) {
      setTimeout(() => {
        this.resolveAlert(alert.id, 'Auto-resolved');
      }, 30 * 60 * 1000); // 30 minutes
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, reason?: string): void {
    const alert = this.alerts.get(alertId);
    if (!alert) return;

    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();

    logger.info(`✅ Alert resolved: ${alert.title}`, alert.context, {
      alertId,
      resolutionReason: reason,
      alertDuration: Date.now() - new Date(alert.timestamp).getTime(),
    });

    // Keep resolved alerts for 24 hours then clean up
    setTimeout(() => {
      this.alerts.delete(alertId);
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Performance monitoring alerts
   */
  checkPerformanceMetrics(responseTime: number, errorCount: number, totalRequests: number): void {
    // Response time alert
    if (responseTime > this.THRESHOLDS.responseTime) {
      this.alert(
        AlertType.PERFORMANCE,
        AlertSeverity.HIGH,
        'High Response Time',
        `Response time exceeded threshold: ${responseTime}ms`,
        undefined,
        { responseTime, threshold: this.THRESHOLDS.responseTime }
      );
    }

    // Error rate alert
    if (totalRequests > 100) { // Only check after sufficient sample size
      const errorRate = errorCount / totalRequests;
      if (errorRate > this.THRESHOLDS.errorRate) {
        this.alert(
          AlertType.ERROR,
          AlertSeverity.HIGH,
          'High Error Rate',
          `Error rate exceeded threshold: ${(errorRate * 100).toFixed(1)}%`,
          undefined,
          { errorRate, errorCount, totalRequests, threshold: this.THRESHOLDS.errorRate }
        );
      }
    }
  }

  /**
   * Security alerts
   */
  securityAlert(title: string, message: string, context?: RequestCtx, metadata?: Record<string, any>): void {
    this.alert(AlertType.SECURITY, AlertSeverity.HIGH, title, message, context, metadata);
  }

  /**
   * System health alerts
   */
  systemAlert(title: string, message: string, severity: AlertSeverity = AlertSeverity.MEDIUM, metadata?: Record<string, any>): void {
    this.alert(AlertType.SYSTEM, severity, title, message, undefined, metadata);
  }

  /**
   * Business logic alerts
   */
  businessAlert(title: string, message: string, context?: RequestCtx, metadata?: Record<string, any>): void {
    this.alert(AlertType.BUSINESS, AlertSeverity.MEDIUM, title, message, context, metadata);
  }

  /**
   * Send external notifications (to be implemented in Phase 2)
   */
  private sendExternalNotification(alert: Alert): void {
    // Phase 1: Just log - Phase 2 will add email, Slack, etc.
    logger.info(`External notification would be sent for alert: ${alert.title}`, alert.context, {
      alertId: alert.id,
      notificationType: 'pending_implementation',
    });

    // Future implementations:
    // - Email alerts for critical issues
    // - Slack notifications for team
    // - SMS for on-call engineers
    // - Integration with incident management systems
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create singleton alert manager
const alertManager = new AlertManager();

// Export singleton
export { alertManager };

// Convenience functions for common alerts
export function alertSecurityIssue(title: string, message: string, context?: RequestCtx, metadata?: Record<string, any>): void {
  alertManager.securityAlert(title, message, context, metadata);
}

export function alertPerformanceIssue(title: string, message: string, metadata?: Record<string, any>): void {
  alertManager.alert(AlertType.PERFORMANCE, AlertSeverity.MEDIUM, title, message, undefined, metadata);
}

export function alertSystemIssue(title: string, message: string, severity: AlertSeverity = AlertSeverity.MEDIUM, metadata?: Record<string, any>): void {
  alertManager.systemAlert(title, message, severity, metadata);
}

export function alertBusinessIssue(title: string, message: string, context?: RequestCtx, metadata?: Record<string, any>): void {
  alertManager.businessAlert(title, message, context, metadata);
}

// Middleware for automatic performance monitoring
export function performanceMonitoring(req: any, res: any, next: any): void {
  const startTime = Date.now();
  const ctx = req.ctx;

  // Monitor response time
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    alertManager.checkPerformanceMetrics(responseTime, res.statusCode >= 400 ? 1 : 0, 1);
  });

  next();
}

// Health check endpoint that includes alert status
export function getAlertStatus(): { activeAlerts: number; alerts: Alert[] } {
  const alerts = alertManager.getActiveAlerts();
  return {
    activeAlerts: alerts.length,
    alerts: alerts.slice(-10), // Last 10 alerts
  };
}
