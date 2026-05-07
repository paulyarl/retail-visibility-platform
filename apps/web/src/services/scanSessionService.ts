import { inventoryScanService, type ScanSession } from '@/services/InventoryScanService';

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
      const sessions = await inventoryScanService.checkActiveSessions(tenantId);
      return sessions && sessions.length > 0 ? sessions[0] : null;
    } catch (error) {
      console.error('[ScanSessionService] Failed to check sessions:', error);
      return null;
    }
  }

  /**
   * Create a new scan session
   */
  async createSession(tenantId: string): Promise<ScanSession | null> {
    try {
      return await inventoryScanService.createScanSession(tenantId);
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
      await inventoryScanService.endScanSession(sessionId);
    } catch (error) {
      console.error('[ScanSessionService] Failed to end session:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const scanSessionService = new ScanSessionService();
