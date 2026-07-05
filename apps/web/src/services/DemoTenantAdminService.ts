/**
 * Demo Tenant Admin Service
 *
 * Frontend service for managing demo tenants via admin API.
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface DemoTenant {
  id: string;
  name: string;
  demo_template: string | null;
  demo_expires_at: string | null;
  is_demo: boolean;
  subdomain: string | null;
  slug: string | null;
  subscription_status: string | null;
  location_status: string;
  created_at: string;
}

export interface DemoTenantDetail extends DemoTenant {
  demo_source_tenant_id: string | null;
  subscription_tier: string | null;
  gbp_primary_category_id: string | null;
  gbp_primary_category_name: string | null;
  productCount: number;
}

export interface DemoTemplate {
  key: string;
  name: string;
  productCount: number;
}

export interface CreateDemoTenantResult {
  tenantId: string;
  name: string;
  slug: string;
  subdomain: string | null;
  template: string;
  productsCreated: number;
  categoriesCreated: number;
  expiresAt: string;
}

class DemoTenantAdminService extends AdminApiSingleton {
  private static instance: DemoTenantAdminService;

  private constructor() {
    super('DemoTenantAdminService');
  }

  static getInstance(): DemoTenantAdminService {
    if (!DemoTenantAdminService.instance) {
      DemoTenantAdminService.instance = new DemoTenantAdminService();
    }
    return DemoTenantAdminService.instance;
  }

  async listDemoTenants(includeExpired = false): Promise<DemoTenant[] | null> {
    const params = new URLSearchParams();
    if (includeExpired) params.set('includeExpired', 'true');
    const qs = params.toString();
    const result = await this.makeDefaultRequest<{ data: DemoTenant[]; total: number }>(
      `/api/admin/demo-tenants${qs ? `?${qs}` : ''}`,
      {},
      `admin-demo-tenants:${includeExpired}`
    );
    return (result as any)?.data ?? null;
  }

  async getTemplates(): Promise<DemoTemplate[] | null> {
    const result = await this.makeDefaultRequest<{ data: DemoTemplate[] }>(
      '/api/admin/demo-tenants/templates',
      {},
      'admin-demo-tenants-templates'
    );
    return (result as any)?.data ?? null;
  }

  async getDemoTenant(id: string): Promise<DemoTenantDetail | null> {
    const result = await this.makeDefaultRequest<{ data: DemoTenantDetail }>(
      `/api/admin/demo-tenants/${encodeURIComponent(id)}`,
      {},
      `admin-demo-tenant:${id}`
    );
    return (result as any)?.data ?? null;
  }

  async createDemoTenant(options: {
    template: string;
    businessName?: string;
    subdomain?: string;
    expiresAt?: string;
  }): Promise<CreateDemoTenantResult | null> {
    const result = await this.makeDefaultRequest<{ data: CreateDemoTenantResult }>(
      '/api/admin/demo-tenants',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      }
    );
    return (result as any)?.data ?? null;
  }

  async expireDemoTenant(id: string): Promise<{ expired: boolean; reason: string } | null> {
    const result = await this.makeDefaultRequest<{ data: { expired: boolean; reason: string } }>(
      `/api/admin/demo-tenants/${encodeURIComponent(id)}/expire`,
      { method: 'POST' }
    );
    return (result as any)?.data ?? null;
  }

  async deleteDemoTenant(id: string): Promise<{ deleted: boolean; productsDeleted: number } | null> {
    const result = await this.makeDefaultRequest<{ data: { deleted: boolean; productsDeleted: number } }>(
      `/api/admin/demo-tenants/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    return (result as any)?.data ?? null;
  }

  async convertToDemoTenant(options: {
    tenantId: string;
    template?: string;
    expiresAt?: string;
    sourceTenantId?: string;
  }): Promise<{ converted: boolean; tenantId: string; reason: string } | null> {
    const result = await this.makeDefaultRequest<{ data: { converted: boolean; tenantId: string; reason: string } }>(
      '/api/admin/demo-tenants/convert',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      }
    );
    return (result as any)?.data ?? null;
  }

  async revokeDemoStatus(tenantId: string): Promise<{ revoked: boolean; tenantId: string; reason: string } | null> {
    const result = await this.makeDefaultRequest<{ data: { revoked: boolean; tenantId: string; reason: string } }>(
      `/api/admin/demo-tenants/${encodeURIComponent(tenantId)}/revoke-demo`,
      { method: 'POST' }
    );
    return (result as any)?.data ?? null;
  }

  async getQRAnalytics(tenantId: string): Promise<any | null> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/demo-tenants/${encodeURIComponent(tenantId)}/qr-analytics`,
      {},
      `admin-demo-tenant-qr-analytics:${tenantId}`
    );
    return (result as any)?.data ?? null;
  }
}

export const demoTenantAdminService = DemoTenantAdminService.getInstance();
export default demoTenantAdminService;
