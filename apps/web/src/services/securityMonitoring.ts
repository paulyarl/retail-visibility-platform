/**
 * Security Monitoring API Service
 * Phase 3: Security Dashboard & Threat Intelligence
 * 
 * Legacy service - use SecurityMonitoringSingletonService instead
 * This file is kept for backward compatibility
 */

import {
  SecurityMetrics,
  SecurityThreat,
  BlockedIP,
  SecurityHealthStatus,
  PaginatedResponse,
  PaginationInfo,
} from '@/types/security';
import { securityMonitoringService } from './SecurityMonitoringSingletonService';

/**
 * Get security metrics for the specified time range
 * @deprecated Use securityMonitoringService.getSecurityMetrics() instead
 */
export async function getSecurityMetrics(hours: number = 24): Promise<SecurityMetrics> {
  return await securityMonitoringService.getSecurityMetrics(hours);
}

/**
 * Get security threats with optional filters and pagination
 * @deprecated Use securityMonitoringService.getSecurityThreats() instead
 */
export async function getSecurityThreats(
  limit: number = 50,
  resolved: boolean = false,
  hours: number = 24,
  page: number = 1
): Promise<{ threats: SecurityThreat[]; pagination: PaginationInfo }> {
  return await securityMonitoringService.getSecurityThreats(limit, resolved, hours, page);
}

/**
 * Resolve a security threat
 * @deprecated Use securityMonitoringService.resolveThreat() instead
 */
export async function resolveThreat(threatId: string, notes: string): Promise<SecurityThreat> {
  return await securityMonitoringService.resolveThreat(threatId, notes);
}

/**
 * Get blocked IP addresses with pagination
 * @deprecated Use securityMonitoringService.getBlockedIPs() instead
 */
export async function getBlockedIPs(
  hours: number = 24,
  page: number = 1,
  limit: number = 50
): Promise<{ blockedIPs: BlockedIP[]; pagination: PaginationInfo }> {
  return await securityMonitoringService.getBlockedIPs(hours, page, limit);
}

/**
 * Unblock an IP address
 * @deprecated Use securityMonitoringService.unblockIP() instead
 */
export async function unblockIP(ipAddress: string, notes: string): Promise<void> {
  return await securityMonitoringService.unblockIP(ipAddress, notes);
}

/**
 * Get security health status
 * @deprecated Use securityMonitoringService.getSecurityHealth() instead
 */
export async function getSecurityHealth(): Promise<SecurityHealthStatus> {
  return await securityMonitoringService.getSecurityHealth();
}

/**
 * Get alerts grouped by type with counts and recent examples
 * @deprecated Use securityMonitoringService.getAlertsByType() instead
 */
export async function getAlertsByType(limit: number = 5, hours: number = 168): Promise<any[]> {
  return await securityMonitoringService.getAlertsByType(limit, hours);
}

/**
 * Export security report
 * @deprecated Use securityMonitoringService.exportSecurityReport() instead
 */
export async function exportSecurityReport(
  startDate: Date,
  endDate: Date,
  format: 'csv' | 'json' = 'csv'
): Promise<Blob> {
  return await securityMonitoringService.exportSecurityReport(startDate, endDate, format);
}
