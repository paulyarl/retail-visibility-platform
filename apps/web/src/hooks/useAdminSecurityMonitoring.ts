/**
 * Admin Security Monitoring Hook
 * Platform-wide security monitoring for administrators
 */

import { useState, useEffect, useCallback } from 'react';
import { adminSecurityMonitoringService } from '@/services/AdminSecurityMonitoringSingletonService';
import { securitySingletonService } from '@/services/SecuritySingletonService';


interface AdminSession {
  id: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  userLastName: string | null;
  userRole: string;
  deviceInfo: {
    type: string;
    browser: string;
    os: string;
    browserVersion?: string;
    osVersion?: string;
  };
  ipAddress: string;
  location: {
    city: string;
    region: string;
    country: string;
  };
  userAgent: string;
  isCurrent: boolean;
  lastActivity: string;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

interface AdminAlert {
  id: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  userLastName: string | null;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata: Record<string, any>;
  read: boolean;
  createdAt: string;
  readAt?: string;
}

interface SessionStats {
  activeSessions: number;
  activeUsers: number;
  sessionsLast24h: number;
  revokedSessions: number;
  deviceBreakdown: Array<{ type: string; count: number }>;
}

interface AlertStats {
  totalAlerts: number;
  unreadAlerts: number;
  alertsLast24h: number;
  criticalAlerts: number;
  warningAlerts: number;
  typeBreakdown: Array<{ type: string; count: number }>;
}

interface FailedLoginAttempt {
  id: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  reason: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export function useAdminSecurityMonitoring() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [failedLogins, setFailedLogins] = useState<FailedLoginAttempt[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state for sessions
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalSessions, setTotalSessions] = useState(0);

  const fetchSessions = useCallback(async () => {
    try {
      const offset = (currentPage - 1) * pageSize;
      
      const response = await adminSecurityMonitoringService.getAdminSecuritySessions(currentPage, pageSize, offset);
      
      if (!response) {
        // Handle service unavailable gracefully
        setSessions([]);
        setTotalSessions(0);
        return;
      }
      
      setSessions(response.sessions);
      setTotalSessions(response.total);
    } catch (err) {
      console.error('Failed to fetch admin sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    }
  }, [currentPage, pageSize]);

  const fetchSessionStats = useCallback(async () => {
    try {
      const stats = await adminSecurityMonitoringService.getSessionStats();
      
      if (!stats) {
        // Handle service unavailable gracefully
        setSessionStats(null);
        return;
      }
      
      setSessionStats(stats);
    } catch (err) {
      console.error('Failed to fetch session stats:', err);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const alerts = await adminSecurityMonitoringService.getSecurityAlerts();
      
      if (!alerts) {
        setAlerts([]);
        return;
      }
      
      setAlerts(alerts);
    } catch (err) {
      console.error('Failed to fetch admin alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    }
  }, []);

  const fetchAlertStats = useCallback(async () => {
    try {
      const stats = await adminSecurityMonitoringService.getAlertStats();
      
      if (!stats) {
        setAlertStats({
          totalAlerts: 0,
          unreadAlerts: 0,
          alertsLast24h: 0,
          criticalAlerts: 0,
          warningAlerts: 0,
          typeBreakdown: []
        });
        return;
      }
      
      setAlertStats(stats);
    } catch (err) {
      console.error('Failed to fetch alert stats:', err);
    }
  }, []);

  const fetchFailedLogins = useCallback(async () => {
    try {
      const failedLogins = await adminSecurityMonitoringService.getFailedLogins(20);
      
      if (!failedLogins) {
        // Handle service unavailable gracefully
        setFailedLogins([]);
        return;
      }
      
      setFailedLogins(failedLogins);
    } catch (err) {
      console.error('Failed to fetch failed logins:', err);
    }
  }, []);

  const revokeSession = useCallback(async (sessionId: string) => {
    try {
      await securitySingletonService.revokeSession(sessionId);
      
      // Refresh sessions
      await fetchSessions();
      await fetchSessionStats();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to revoke session');
    }
  }, [fetchSessions, fetchSessionStats]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load critical session data first
        await Promise.all([
          fetchSessions(),
          fetchSessionStats(),
        ]);
        
        // Then load alerts data
        await Promise.all([
          fetchAlerts(),
          fetchAlertStats(),
        ]);
        
        // Load failed logins last (least critical)
        await fetchFailedLogins();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchSessions, fetchSessionStats, fetchAlerts, fetchAlertStats, fetchFailedLogins]);

  return {
    sessions,
    alerts,
    failedLogins,
    sessionStats,
    alertStats,
    loading,
    error,
    revokeSession,
    // Pagination state and handlers
    currentPage,
    pageSize,
    totalSessions,
    handlePageChange,
    handlePageSizeChange,
  };
}
