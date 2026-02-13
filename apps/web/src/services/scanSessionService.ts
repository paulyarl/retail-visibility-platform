import { platformHomeService, ScanSession } from '@/services/PlatformHomeSingletonService';

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
      return await platformHomeService.checkActiveScanSessions(tenantId);
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
      return await platformHomeService.createScanSession(tenantId);
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
      await platformHomeService.endScanSession(sessionId);
    } catch (error) {
      console.error('[ScanSessionService] Failed to end session:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const scanSessionService = new ScanSessionService();
