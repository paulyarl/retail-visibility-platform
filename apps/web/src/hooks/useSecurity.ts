/**
 * Security Hook
 * Phase 1: Basic Security Features
 */

import { useState, useEffect, useCallback } from 'react';
import { LoginSession, SecurityAlert } from '@/types/security';
import * as securityService from '@/services/security';
import { clientLogger } from '@/lib/client-logger';

export function useSecurity() {
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await securityService.getActiveSessions();
      // Extract the data array from the response
      const sessions = Array.isArray(response) ? response : (response as any)?.data || [];
      setSessions(sessions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await securityService.getSecurityAlerts(true); // Bypass cache for now
      // Extract the data array from the response
      const alerts = Array.isArray(response) ? response : (response as any)?.data || [];
      setAlerts(alerts);
    } catch (err) {
      clientLogger.error('Failed to fetch alerts:', { detail: err });
    }
  }, []);

  const revokeSession = useCallback(async (sessionId: string) => {
    try {
      await securityService.revokeSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to revoke session');
    }
  }, []);

  const revokeAllSessions = useCallback(async () => {
    try {
      await securityService.revokeAllSessions();
      await fetchSessions();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to revoke all sessions');
    }
  }, [fetchSessions]);

  const markAlertAsRead = useCallback(async (alertId: string) => {
    try {
      await securityService.markAlertAsRead(alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
    } catch (err) {
      clientLogger.error('Failed to mark alert as read:', { detail: err });
    }
  }, []);

  const dismissAlert = useCallback(async (alertId: string) => {
    try {
      await securityService.dismissAlert(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      clientLogger.error('Failed to dismiss alert:', { detail: err });
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchAlerts();
  }, [fetchSessions, fetchAlerts]);

  return {
    sessions,
    alerts,
    loading,
    error,
    revokeSession,
    revokeAllSessions,
    markAlertAsRead,
    dismissAlert,
    refreshSessions: fetchSessions,
    refreshAlerts: fetchAlerts,
  };
}
