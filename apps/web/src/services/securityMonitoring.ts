/**
 * Security Monitoring API Service
 * Phase 3: Security Dashboard & Threat Intelligence
 */

import {
  SecurityMetrics,
  SecurityThreat,
  BlockedIP,
  SecurityHealthStatus,
  ApiResponse,
  PaginatedResponse,
} from '@/types/security';
import { api } from '@/lib/api';

/**
 * Get security metrics for the specified time range
 */
export async function getSecurityMetrics(hours: number = 24): Promise<SecurityMetrics> {
  const response = await api.get(`/api/security/metrics?hours=${hours}`);

  if (!response.ok) {
    throw new Error('Failed to get security metrics');
  }

  const result: any = await response.json();
  // API returns { success: true, data: { metrics: {...}, timeRange: "24 hours" } }
  return result.data?.metrics || result.data || {};
}

/**
 * Get security threats with optional filters
 */
export async function getSecurityThreats(
  limit: number = 50,
  resolved: boolean = false,
  hours: number = 24
): Promise<SecurityThreat[]> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    resolved: resolved.toString(),
    hours: hours.toString(),
  });

  const response = await api.get(`/api/security/threats?${params}`);

  if (!response.ok) {
    throw new Error('Failed to get security threats');
  }

  const result: any = await response.json();
  // API returns { success: true, data: { threats: [], count: 0, ... } }
  return result.data?.threats || result.data || [];
}

/**
 * Resolve a security threat
 */
export async function resolveThreat(threatId: string, notes: string): Promise<SecurityThreat> {
  const response = await api.post(`/api/security/threats/${threatId}/resolve`, { notes });

  if (!response.ok) {
    throw new Error('Failed to resolve threat');
  }

  const result: ApiResponse<SecurityThreat> = await response.json();
  if (!result.data) {
    throw new Error('No data returned from threat resolution');
  }
  return result.data;
}

/**
 * Get blocked IP addresses
 */
export async function getBlockedIPs(hours: number = 24): Promise<BlockedIP[]> {
  const response = await api.get(`/api/security/blocked-ips?hours=${hours}`);

  if (!response.ok) {
    throw new Error('Failed to get blocked IPs');
  }

  const result: any = await response.json();
  // API returns { success: true, data: { blockedIPs: [], count: 0, ... } }
  return result.data?.blockedIPs || result.data || [];
}

/**
 * Unblock an IP address
 */
export async function unblockIP(ipAddress: string, notes: string): Promise<void> {
  const response = await api.post(`/api/security/blocked-ips/${ipAddress}/unblock`, { notes });

  if (!response.ok) {
    throw new Error('Failed to unblock IP address');
  }
}

/**
 * Get security health status
 */
export async function getSecurityHealth(): Promise<SecurityHealthStatus> {
  const response = await api.get(`/api/security/health`);

  if (!response.ok) {
    throw new Error('Failed to get security health');
  }

  const result: ApiResponse<SecurityHealthStatus> = await response.json();
  if (!result.data) {
    throw new Error('No data returned from security health');
  }
  return result.data;
}

/**
 * Export security report
 */
export async function exportSecurityReport(
  startDate: Date,
  endDate: Date,
  format: 'csv' | 'json' = 'csv'
): Promise<Blob> {
  const params = new URLSearchParams({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    format,
  });

  const response = await api.get(`/api/security/export?${params}`);

  if (!response.ok) {
    throw new Error('Failed to export security report');
  }

  return await response.blob();
}
