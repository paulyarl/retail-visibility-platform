/**
 * GMC Validation Service (Frontend)
 *
 * Provides pre-sync validation reports for Google Shopping compliance.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface ValidationIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
  value?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: number;
  warnings: number;
  issues: ValidationIssue[];
}

export interface BulkValidationReport {
  tenantId: string;
  totalItems: number;
  validItems: number;
  itemsWithErrors: number;
  itemsWithWarnings: number;
  results: Array<{
    itemId: string;
    itemName: string;
    sku: string;
    validation: ValidationResult;
  }>;
}

export class GMCValidationService extends TenantApiSingleton {
  private static instance: GMCValidationService;

  private constructor() {
    super('gmc-validation-service', {
      ttl: 5 * 60 * 1000, // 5 min cache
    });
  }

  static getInstance(): GMCValidationService {
    if (!GMCValidationService.instance) {
      GMCValidationService.instance = new GMCValidationService();
    }
    return GMCValidationService.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['gmc-validation-report*'];
  }

  public async invalidateServiceCaches(): Promise<void> {
    await this.invalidateCachePattern('gmc-validation-report*');
  }

  /**
   * Get validation report for all syncable products
   */
  async getValidationReport(tenantId: string): Promise<BulkValidationReport | null> {
    const response = await this.makeDefaultRequest<any>(
      `/api/google/merchant/validation-report?tenantId=${tenantId}`,
      {},
      `gmc-validation-report-${tenantId}`,
      5 * 60 * 1000
    );
    return response?.data?.data || null;
  }
}

export const gmcValidationService = GMCValidationService.getInstance();
