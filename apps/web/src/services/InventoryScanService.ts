import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';

export interface ScanSession {
  id: string;
  tenantId: string;
  locationId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  totalItems?: number;
  scannedItems?: number;
  errors?: string[];
  metadata?: Record<string, any>;
}

export interface ScanResult {
  id: string;
  sessionId: string;
  productId: string;
  sku?: string;
  quantity: number;
  location?: string;
  scannedAt: string;
  status: 'found' | 'missing' | 'error';
  metadata?: Record<string, any>;
}

/**
 * Service for managing inventory scan sessions and results
 * Handles inventory scanning operations and data analysis
 */
export class InventoryScanService extends TenantApiSingleton {
  private static instance: InventoryScanService;

  private constructor() {
    super('InventoryScanService');
  }

  static getInstance(): InventoryScanService {
    if (!InventoryScanService.instance) {
      InventoryScanService.instance = new InventoryScanService();
    }
    return InventoryScanService.instance;
  }

  /**
   * Get scan session by ID
   */
  async getScanSession(sessionId: string): Promise<ScanSession | null> {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const result = await this.makeDefaultRequest<ScanSession>(
      `/api/scan/sessions/${sessionId}`,
      {},
      `platform-scan-session-${sessionId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[InventoryScanService] Failed to get scan session:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Create a new scan session
   */
  async createScanSession(tenantId: string): Promise<ScanSession | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<ScanSession>(
      '/api/scan/sessions',
      { 
        method: 'POST',
        body: JSON.stringify({ tenantId })
      },
      `platform-scan-create-session-${tenantId}`
    );

    if (!result.success) {
      console.error('[InventoryScanService] Failed to create scan session:', result.error);
      throw result.error;
    }

    return result.data || null;
  }

  /**
   * Lookup barcode information
   */
  async lookupBarcode(tenantId: string, barcode: string): Promise<any> {
    if (!tenantId || !barcode) {
      throw new Error('Tenant ID and barcode are required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/scan/lookup?tenantId=${tenantId}&barcode=${encodeURIComponent(barcode)}`,
      {},
      `platform-barcode-lookup-${barcode}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[InventoryScanService] Failed to lookup barcode:', result.error);
      return null;
    }

    return result.data;
  }

  /**
   * Delete a scan result
   */
  async deleteScanResult(sessionId: string, resultId: string): Promise<void> {
    if (!sessionId || !resultId) {
      throw new Error('Session ID and Result ID are required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/scan/sessions/${sessionId}/results/${resultId}`,
      { method: 'DELETE' },
      `platform-delete-scan-result-${resultId}`
    );

    if (!result.success) {
      console.error('[InventoryScanService] Failed to delete scan result:', result.error);
      throw result.error;
    }

    // Invalidate scan session cache
    await this.invalidateCache(`platform-scan-session-${sessionId}*`);
  }

  /**
   * Commit a scan session
   */
  async commitScanSession(sessionId: string): Promise<void> {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/scan/sessions/${sessionId}/commit`,
      { method: 'POST' },
      `platform-commit-scan-session-${sessionId}`
    );

    if (!result.success) {
      console.error('[InventoryScanService] Failed to commit scan session:', result.error);
      throw result.error;
    }

    // Invalidate scan session cache
    await this.invalidateCache(`platform-scan-session-${sessionId}*`);
  }

  /**
   * Delete a scan session
   */
  async deleteScanSession(sessionId: string): Promise<void> {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/scan/sessions/${sessionId}`,
      { method: 'DELETE' },
      `platform-delete-scan-session-${sessionId}`
    );

    if (!result.success) {
      console.error('[InventoryScanService] Failed to delete scan session:', result.error);
      throw result.error;
    }

    // Invalidate scan session cache
    await this.invalidateCache(`platform-scan-session-${sessionId}*`);
  }

  /**
   * End a scan session
   */
  async endScanSession(sessionId: string): Promise<void> {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/scan/sessions/${sessionId}/end`,
      { method: 'POST' },
      `platform-end-scan-session-${sessionId}`
    );

    if (!result.success) {
      console.error('[InventoryScanService] Failed to end scan session:', result.error);
      throw result.error;
    }

    // Invalidate scan session cache
    await this.invalidateCache(`platform-scan-session-${sessionId}*`);
  }

  /**
   * Add scan result to session
   */
  async addScanResult(sessionId: string, scanData: {
    barcode: string;
    quantity?: number;
    location?: string;
    notes?: string;
  }): Promise<ScanResult | null> {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const result = await this.makeDefaultRequest<ScanResult>(
      `/api/scan/sessions/${sessionId}/results`,
      { 
        method: 'POST',
        body: JSON.stringify(scanData)
      },
      `platform-add-scan-result-${sessionId}`
    );

    if (!result.success) {
      console.error('[InventoryScanService] Failed to add scan result:', result.error);
      throw result.error;
    }

    // Invalidate scan session cache
    await this.invalidateCache(`platform-scan-session-${sessionId}*`);

    return result.data || null;
  }

  /**
   * Get scan results for a session
   */
  async getScanResults(sessionId: string): Promise<ScanResult[] | null> {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const result = await this.makeDefaultRequest<ScanResult[]>(
      `/api/scan/sessions/${sessionId}/results`,
      {},
      `platform-scan-results-${sessionId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[InventoryScanService] Failed to get scan results:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Check for active scan sessions
   */
  async checkActiveSessions(tenantId: string): Promise<ScanSession[] | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<ScanSession[]>(
      `/api/scan/sessions/active?tenantId=${tenantId}`,
      {},
      `platform-active-scan-sessions-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[InventoryScanService] Failed to check active sessions:', result.error);
      return null;
    }

    return result.data || null;
  }
}

// Export singleton instance
export const inventoryScanService = InventoryScanService.getInstance();
