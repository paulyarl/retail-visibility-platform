/**
 * Admin BSaaS Bundles Service
 *
 * Extends AdminApiSingleton to provide admin CRUD operations
 * for the bsaas_bundles + bsaas_bundle_items tables via the Next.js proxy route.
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface BsaasBundleItem {
  id: string;
  feature_key: string;
  sort_order: number;
}

export interface BsaasBundleEntry {
  id: string;
  bundle_key: string;
  marketing_name: string;
  description: string | null;
  price_cents: number;
  billing_cycle: string;
  trial_days: number;
  is_active: boolean;
  sort_order: number;
  bsaas_bundle_items: BsaasBundleItem[];
  created_at: string;
  updated_at: string;
}

export interface BsaasBundleInput {
  bundle_key: string;
  marketing_name: string;
  description?: string;
  price_cents: number;
  billing_cycle?: string;
  trial_days?: number;
  is_active?: boolean;
  sort_order?: number;
  items: Array<{ feature_key: string; sort_order?: number }>;
}

class AdminBsaasBundleService extends AdminApiSingleton {
  private static instance: AdminBsaasBundleService;

  private constructor() {
    super('AdminBsaasBundleService');
  }

  static getInstance(): AdminBsaasBundleService {
    if (!AdminBsaasBundleService.instance) {
      AdminBsaasBundleService.instance = new AdminBsaasBundleService();
    }
    return AdminBsaasBundleService.instance;
  }

  async list(): Promise<BsaasBundleEntry[]> {
    const result = await this.makeDefaultRequest<BsaasBundleEntry[]>(
      '/api/admin/bsaas-bundles',
      {},
      'admin-bsaas-bundles-all',
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch bundles');
    }
    const data = result.data;
    const actualData = Array.isArray(data) ? data : (data as any)?.data;
    return Array.isArray(actualData) ? actualData : [];
  }

  async create(input: BsaasBundleInput): Promise<BsaasBundleEntry> {
    const result = await this.makeDefaultRequest<BsaasBundleEntry>(
      '/api/admin/bsaas-bundles',
      { method: 'POST', body: JSON.stringify(input) },
      'admin-bsaas-bundles-create',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create bundle');
    }
    await this.invalidateCachePattern('admin-bsaas-bundles');
    const data = (result.data as any)?.data || result.data;
    return data;
  }

  async update(id: string, input: Partial<BsaasBundleInput>): Promise<BsaasBundleEntry> {
    const result = await this.makeDefaultRequest<BsaasBundleEntry>(
      `/api/admin/bsaas-bundles?id=${id}`,
      { method: 'PUT', body: JSON.stringify(input) },
      'admin-bsaas-bundles-update',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update bundle');
    }
    await this.invalidateCachePattern('admin-bsaas-bundles');
    const data = (result.data as any)?.data || result.data;
    return data;
  }

  async remove(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/bsaas-bundles?id=${id}`,
      { method: 'DELETE' },
      'admin-bsaas-bundles-delete',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete bundle');
    }
    await this.invalidateCachePattern('admin-bsaas-bundles');
  }
}

export const adminBsaasBundleService = AdminBsaasBundleService.getInstance();
