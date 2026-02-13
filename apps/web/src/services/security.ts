/**
 * Security API Service
 * Phase 1: Basic Security Features
 * 
 * Legacy service - use SecuritySingletonService instead
 * This file is kept for backward compatibility
 */

import { LoginSession, SecurityAlert } from '@/types/security';
import { securityService } from './SecuritySingletonService';

/**
 * Get active user sessions
 * @deprecated Use securityService.getActiveSessions() instead
 */
export async function getActiveSessions(): Promise<LoginSession[]> {
  return await securityService.getActiveSessions();
}

/**
 * Revoke a specific session
 * @deprecated Use securityService.revokeSession() instead
 */
export async function revokeSession(sessionId: string): Promise<void> {
  return await securityService.revokeSession(sessionId);
}

/**
 * Revoke all sessions except current
 * @deprecated Use securityService.revokeAllSessions() instead
 */
export async function revokeAllSessions(): Promise<void> {
  return await securityService.revokeAllSessions();
}

/**
 * Get security alerts for the current user
 * @deprecated Use securityService.getSecurityAlerts() instead
 */
export async function getSecurityAlerts(): Promise<SecurityAlert[]> {
  return await securityService.getSecurityAlerts();
}

/**
 * Mark a security alert as read
 * @deprecated Use securityService.markAlertAsRead() instead
 */
export async function markAlertAsRead(alertId: string): Promise<void> {
  return await securityService.markAlertAsRead(alertId);
}

/**
 * Dismiss a security alert
 * @deprecated Use securityService.dismissAlert() instead
 */
export async function dismissAlert(alertId: string): Promise<void> {
  return await securityService.dismissAlert(alertId);
}

/**
 * Get security alert preferences
 * @deprecated Use securityService.getAlertPreferences() instead
 */
export async function getAlertPreferences(): Promise<Record<string, boolean>> {
  return await securityService.getAlertPreferences();
}

/**
 * Update security alert preferences
 * @deprecated Use securityService.updateAlertPreferences() instead
 */
export async function updateAlertPreferences(preferences: Record<string, boolean>): Promise<void> {
  return await securityService.updateAlertPreferences(preferences);
}
