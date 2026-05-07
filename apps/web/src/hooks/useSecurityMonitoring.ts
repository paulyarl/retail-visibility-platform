/**
 * Security Monitoring Hook
 * Phase 3: Security Dashboard & Threat Intelligence
 */

import { useState, useEffect, useCallback } from 'react';
import {
  SecurityMetrics,
  SecurityThreat,
  BlockedIP,
  SecurityHealthStatus,
  PaginationInfo,
} from '@/types/security';
import * as monitoringService from '@/services/securityMonitoring';

export function useSecurityMonitoring(hours: number = 24) {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [threats, setThreats] = useState<SecurityThreat[]>([]);
  const [threatsPagination, setThreatsPagination] = useState<PaginationInfo | null>(null);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [blockedIPsPagination, setBlockedIPsPagination] = useState<PaginationInfo | null>(null);
  const [health, setHealth] = useState<SecurityHealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await monitoringService.getSecurityMetrics(hours);
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
  }, [hours]);

  const fetchThreats = useCallback(async (resolved: boolean = false, page: number = 1, limit: number = 50) => {
    try {
      const data = await monitoringService.getSecurityThreats(limit, resolved, hours, page);
      setThreats(data.threats);
      setThreatsPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch threats:', err);
    }
  }, [hours]);

  const fetchBlockedIPs = useCallback(async (page: number = 1, limit: number = 50) => {
    try {
      const data = await monitoringService.getBlockedIPs(hours, page, limit);
      setBlockedIPs(data.blockedIPs);
      setBlockedIPsPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch blocked IPs:', err);
    }
  }, [hours]);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await monitoringService.getSecurityHealth();
      setHealth(data);
    } catch (err) {
      console.error('Failed to fetch health:', err);
    }
  }, []);

  const resolveThreat = useCallback(async (threatId: string, notes: string) => {
    try {
      await monitoringService.resolveThreat(threatId, notes);
      setThreats(prev => prev.map(t => 
        t.id === threatId 
          ? { ...t, resolved: true, resolvedAt: new Date(), resolutionNotes: notes }
          : t
      ));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to resolve threat');
    }
  }, []);

  const unblockIP = useCallback(async (ipAddress: string, notes: string) => {
    try {
      await monitoringService.unblockIP(ipAddress, notes);
      setBlockedIPs(prev => prev.filter(ip => ip.ipAddress !== ipAddress));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to unblock IP');
    }
  }, []);

  const exportReport = useCallback(async (startDate: Date, endDate: Date, format: 'csv' | 'json' = 'csv') => {
    try {
      const blob = await monitoringService.exportSecurityReport(startDate, endDate, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security-report-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to export report');
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load critical data first (health status)
        await fetchHealth();
        
        // Then load metrics and threats in parallel (but not with blocked IPs)
        await Promise.all([
          fetchMetrics(),
          fetchThreats(),
        ]);
        
        // Load blocked IPs last (least critical)
        await fetchBlockedIPs();
        
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load security data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchMetrics, fetchThreats, fetchBlockedIPs, fetchHealth]);

  return {
    metrics,
    threats,
    threatsPagination,
    blockedIPs,
    blockedIPsPagination,
    health,
    healthStatus: health, // Alias for component compatibility
    loading,
    error,
    resolveThreat,
    unblockIP,
    exportReport,
    refresh: () => {
      fetchMetrics();
      fetchThreats();
      fetchBlockedIPs();
      fetchHealth();
    },
    refreshThreats: fetchThreats,
    refreshBlockedIPs: fetchBlockedIPs,
  };
}
