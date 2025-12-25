/**
 * Admin Security Monitoring Hook
 * Platform-wide security monitoring for administrators
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

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

  const fetchSessions = useCallback(async () => {
    try {
      const response = await api.get('/api/admin/security/sessions');
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const data = await response.json();
      setSessions(data.data || []);
    } catch (err) {
      console.error('Failed to fetch admin sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    }
  }, []);

  const fetchSessionStats = useCallback(async () => {
    try {
      const response = await api.get('/api/admin/security/sessions/stats');
      if (!response.ok) throw new Error('Failed to fetch session stats');
      const data = await response.json();
      setSessionStats(data);
    } catch (err) {
      console.error('Failed to fetch session stats:', err);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await api.get('/api/admin/security/alerts');
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const data = await response.json();
      setAlerts(data.data || []);
    } catch (err) {
      console.error('Failed to fetch admin alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    }
  }, []);

  const fetchAlertStats = useCallback(async () => {
    try {
      const response = await api.get('/api/admin/security/alerts/stats');
      if (!response.ok) throw new Error('Failed to fetch alert stats');
      const data = await response.json();
      setAlertStats(data);
    } catch (err) {
      console.error('Failed to fetch alert stats:', err);
    }
  }, []);

  const fetchFailedLogins = useCallback(async () => {
    try {
      const response = await api.get('/api/admin/security/failed-logins?limit=20');
      if (!response.ok) throw new Error('Failed to fetch failed logins');
      const data = await response.json();
      setFailedLogins(data.data || []);
    } catch (err) {
      console.error('Failed to fetch failed logins:', err);
    }
  }, []);

  const revokeSession = useCallback(async (sessionId: string) => {
    try {
      const response = await api.delete(`/api/admin/security/sessions/${sessionId}`);
      if (!response.ok) throw new Error('Failed to revoke session');
      
      // Refresh sessions
      await fetchSessions();
      await fetchSessionStats();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to revoke session');
    }
  }, [fetchSessions, fetchSessionStats]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchSessions(),
        fetchSessionStats(),
        fetchAlerts(),
        fetchAlertStats(),
        fetchFailedLogins(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, [fetchSessions, fetchSessionStats, fetchAlerts, fetchAlertStats, fetchFailedLogins]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    sessions,
    alerts,
    failedLogins,
    sessionStats,
    alertStats,
    loading,
    error,
    revokeSession,
    refresh,
  };
}
