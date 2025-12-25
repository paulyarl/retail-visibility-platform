/**
 * Security API Service
 * Phase 1: Basic Security Features
 */

import { LoginSession, SecurityAlert, ApiResponse } from '@/types/security';
import { api } from '@/lib/api';

/**
 * Get active user sessions
 */
export async function getActiveSessions(): Promise<LoginSession[]> {
  const response = await api.get('/api/auth/sessions');

  if (!response.ok) {
    throw new Error('Failed to fetch active sessions');
  }

  const data: ApiResponse<LoginSession[]> = await response.json();
  return data.data || [];
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const response = await api.delete(`/api/auth/sessions/${sessionId}`);

  if (!response.ok) {
    throw new Error('Failed to revoke session');
  }
}

/**
 * Revoke all sessions except current
 */
export async function revokeAllSessions(): Promise<void> {
  const response = await api.post('/api/auth/sessions/revoke-all');

  if (!response.ok) {
    throw new Error('Failed to revoke all sessions');
  }
}

/**
 * Get security alerts for the current user
 */
export async function getSecurityAlerts(): Promise<SecurityAlert[]> {
  const response = await api.get('/api/user/security-alerts');

  if (!response.ok) {
    throw new Error('Failed to fetch security alerts');
  }

  const data: ApiResponse<SecurityAlert[]> = await response.json();
  return data.data || (data as any).alerts || [];
}

/**
 * Mark a security alert as read
 */
export async function markAlertAsRead(alertId: string): Promise<void> {
  const response = await api.put(`/api/user/security-alerts/${alertId}/read`);

  if (!response.ok) {
    throw new Error('Failed to mark alert as read');
  }
}

/**
 * Dismiss a security alert
 */
export async function dismissAlert(alertId: string): Promise<void> {
  const response = await api.delete(`/api/user/security-alerts/${alertId}`);

  if (!response.ok) {
    throw new Error('Failed to dismiss alert');
  }
}

/**
 * Get security alert preferences
 */
export async function getAlertPreferences(): Promise<Record<string, boolean>> {
  const response = await api.get('/api/user/security-alerts/preferences');

  if (!response.ok) {
    throw new Error('Failed to fetch alert preferences');
  }

  const data: ApiResponse<Record<string, boolean>> = await response.json();
  return data.data || {};
}

/**
 * Update security alert preferences
 */
export async function updateAlertPreferences(preferences: Record<string, boolean>): Promise<void> {
  const response = await api.put('/api/user/security-alerts/preferences', preferences);

  if (!response.ok) {
    throw new Error('Failed to update alert preferences');
  }
}
