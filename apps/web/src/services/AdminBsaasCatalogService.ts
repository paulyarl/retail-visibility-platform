/**
 * Admin BSaaS Catalog Service
 *
 * Extends AdminApiSingleton to provide admin CRUD operations
 * for the bsaas_catalog table via the Next.js proxy route.
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface BsaasCatalogEntry {
  id: string;
  feature_key: string;
  marketing_name: string | null;
  description: string | null;
  price_cents: number;
  billing_cycle: string;
  trial_days: number;
  is_active: boolean;
  sort_order: number;
  capability_types?: string[];
  created_at: string;
  updated_at: string;
}

export interface BsaasCatalogInput {
  feature_key: string;
  marketing_name?: string;
  description?: string;
  price_cents: number;
  billing_cycle?: string;
  trial_days?: number;
  is_active?: boolean;
  sort_order?: number;
}

class AdminBsaasCatalogService extends AdminApiSingleton {
  private static instance: AdminBsaasCatalogService;

  private constructor() {
    super('AdminBsaasCatalogService');
  }

  static getInstance(): AdminBsaasCatalogService {
    if (!AdminBsaasCatalogService.instance) {
      AdminBsaasCatalogService.instance = new AdminBsaasCatalogService();
    }
    return AdminBsaasCatalogService.instance;
  }

  async list(): Promise<BsaasCatalogEntry[]> {
    const result = await this.makeDefaultRequest<BsaasCatalogEntry[]>(
      '/api/admin/bsaas-catalog',
      {},
      'admin-bsaas-catalog-all',
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch BSaaS catalog');
    }
    const data = result.data;
    const actualData = Array.isArray(data) ? data : (data as any)?.data;
    return Array.isArray(actualData) ? actualData : [];
  }

  async create(input: BsaasCatalogInput): Promise<BsaasCatalogEntry> {
    const result = await this.makeDefaultRequest<BsaasCatalogEntry>(
      '/api/admin/bsaas-catalog',
      { method: 'POST', body: JSON.stringify(input) },
      'admin-bsaas-catalog-create',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create catalog entry');
    }
    await this.invalidateCachePattern('admin-bsaas-catalog');
    const data = (result.data as any)?.data || result.data;
    return data;
  }

  async update(id: string, input: Partial<BsaasCatalogInput>): Promise<BsaasCatalogEntry> {
    const result = await this.makeDefaultRequest<BsaasCatalogEntry>(
      `/api/admin/bsaas-catalog?id=${id}`,
      { method: 'PUT', body: JSON.stringify(input) },
      'admin-bsaas-catalog-update',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update catalog entry');
    }
    await this.invalidateCachePattern('admin-bsaas-catalog');
    const data = (result.data as any)?.data || result.data;
    return data;
  }

  async remove(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/bsaas-catalog?id=${id}`,
      { method: 'DELETE' },
      'admin-bsaas-catalog-delete',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete catalog entry');
    }
    await this.invalidateCachePattern('admin-bsaas-catalog');
  }
}

export const adminBsaasCatalogService = AdminBsaasCatalogService.getInstance();
