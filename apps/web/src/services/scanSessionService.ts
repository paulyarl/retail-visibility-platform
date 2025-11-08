import { api } from '@/lib/api';

export interface ScanSession {
  id: string;
  tenantId: string;
  status: 'active' | 'completed' | 'cancelled';
  itemsScanned: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Service for handling scan session operations
 * Manages barcode scanning sessions for inventory
 */
export class ScanSessionService {
  /**
   * Check for active scan sessions
   */
  async checkActiveSessions(tenantId: string): Promise<ScanSession | null> {
    try {
      const response = await api.get(
        `/api/scan/sessions?tenantId=${tenantId}&status=active`
      );

      if (!response.ok) {
        // 404 is expected when no active sessions
        if (response.status === 404) return null;
        throw new Error('Failed to check scan sessions');
      }

      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('[ScanSessionService] Failed to check sessions:', error);
      return null;
    }
  }

  /**
   * Create a new scan session
   */
  async createSession(tenantId: string): Promise<ScanSession> {
    try {
      const response = await api.post('/api/scan/sessions', {
        tenantId,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to create scan session');
      }

      return await response.json();
    } catch (error) {
      console.error('[ScanSessionService] Failed to create session:', error);
      throw error;
    }
  }

  /**
   * End a scan session
   */
  async endSession(sessionId: string): Promise<void> {
    try {
      const response = await api.put(`/api/scan/sessions/${sessionId}`, {
        status: 'completed',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to end scan session');
      }
    } catch (error) {
      console.error('[ScanSessionService] Failed to end session:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const scanSessionService = new ScanSessionService();
