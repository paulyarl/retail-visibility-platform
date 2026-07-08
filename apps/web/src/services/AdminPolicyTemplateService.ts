/**
 * Admin Policy Template Service
 *
 * Extends AdminApiSingleton to provide admin CRUD operations
 * for the policy_templates table.
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface PolicyTemplateEntry {
  id: string;
  template_key: string;
  policy_type: string;
  storefront_type: string;
  product_type: string;
  fulfillment_mode: string;
  jurisdiction: string;
  platform: string;
  title: string;
  description: string | null;
  content_markdown: string;
  placeholder_schema: any[];
  compliance_tags: string[];
  version: string;
  regulatory_effective_date: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PolicyTemplateInput {
  template_key: string;
  policy_type: string;
  storefront_type?: string;
  product_type?: string;
  fulfillment_mode?: string;
  jurisdiction?: string;
  platform?: string;
  title: string;
  description?: string;
  content_markdown: string;
  placeholder_schema?: any[];
  compliance_tags?: string[];
  version?: string;
  regulatory_effective_date?: string;
  sort_order?: number;
}

class AdminPolicyTemplateService extends AdminApiSingleton {
  private static instance: AdminPolicyTemplateService;

  private constructor() {
    super('AdminPolicyTemplateService');
  }

  static getInstance(): AdminPolicyTemplateService {
    if (!AdminPolicyTemplateService.instance) {
      AdminPolicyTemplateService.instance = new AdminPolicyTemplateService();
    }
    return AdminPolicyTemplateService.instance;
  }

  async list(filters?: {
    storefront_type?: string;
    policy_type?: string;
    jurisdiction?: string;
    platform?: string;
    is_active?: string;
  }): Promise<PolicyTemplateEntry[]> {
    const params = new URLSearchParams();
    if (filters?.storefront_type) params.set('storefront_type', filters.storefront_type);
    if (filters?.policy_type) params.set('policy_type', filters.policy_type);
    if (filters?.jurisdiction) params.set('jurisdiction', filters.jurisdiction);
    if (filters?.platform) params.set('platform', filters.platform);
    if (filters?.is_active) params.set('is_active', filters.is_active);
    const query = params.toString();
    const url = `/api/admin/policy-templates${query ? `?${query}` : ''}`;

    const result = await this.makeDefaultRequest<any>(url, {}, 'admin-policy-templates-all', this.cacheTTL);
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch policy templates');
    }
    const data = result.data;
    const templates = data?.templates ?? data;
    return Array.isArray(templates) ? templates : [];
  }

  async create(input: PolicyTemplateInput): Promise<PolicyTemplateEntry> {
    const result = await this.makeDefaultRequest<any>(
      '/api/admin/policy-templates',
      { method: 'POST', body: JSON.stringify(input) },
      'admin-policy-templates-create',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create policy template');
    }
    await this.invalidateCachePattern('admin-policy-templates');
    return result.data?.template ?? result.data;
  }

  async update(id: string, input: Partial<PolicyTemplateInput>): Promise<PolicyTemplateEntry> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/policy-templates/${id}`,
      { method: 'PUT', body: JSON.stringify(input) },
      'admin-policy-templates-update',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update policy template');
    }
    await this.invalidateCachePattern('admin-policy-templates');
    return result.data?.template ?? result.data;
  }

  async deactivate(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/policy-templates/${id}`,
      { method: 'DELETE' },
      'admin-policy-templates-delete',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to deactivate policy template');
    }
    await this.invalidateCachePattern('admin-policy-templates');
  }
}

const adminPolicyTemplateService = AdminPolicyTemplateService.getInstance();
export { adminPolicyTemplateService, AdminPolicyTemplateService };
export default adminPolicyTemplateService;
