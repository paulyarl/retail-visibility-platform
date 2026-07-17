/**
 * Policy Template Service (Frontend)
 *
 * Extends TenantApiSingleton to provide tenant-scoped policy template operations.
 * Uses /api/tenants/:tenantId/storefront-policies/templates and /api/public/policy-templates endpoints.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface PlaceholderEntry {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  required?: boolean;
  default?: string;
  options?: string[];
  helpText?: string;
}

export interface PolicyTemplate {
  id: string;
  templateKey: string;
  policyType: string;
  storefrontType: string;
  productType: string;
  fulfillmentMode: string;
  jurisdiction: string;
  platform: string;
  title: string;
  description: string | null;
  contentMarkdown: string;
  placeholderSchema: PlaceholderEntry[];
  complianceTags: string[];
  version: string;
  regulatoryEffectiveDate: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface TemplateGroup {
  storefrontType: string;
  templates: PolicyTemplate[];
  recommended: boolean;
}

export interface RecommendedTemplate {
  policyType: string;
  template: PolicyTemplate | null;
  score: number;
  reasons: string[];
}

export interface CompletenessResult {
  jurisdiction: string;
  policies: Array<{
    policyType: string;
    status: 'complete' | 'partial' | 'missing';
    required: boolean;
    recommendations: string[];
  }>;
  overallScore: number;
}

export interface OutdatedUsageRecord {
  id: string;
  templateKey: string;
  templateTitle: string;
  policyType: string;
  appliedVersion: string;
  currentVersion: string;
  appliedAt: string;
}

class PolicyTemplateService extends TenantApiSingleton {
  private static instance: PolicyTemplateService;

  public getServiceCachePatterns(): string[] {
    return ['policy-templates*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('policy-templates*');
  }

  private constructor() {
    super('policy-templates', {
      ttl: 60 * 1000,
    });
  }

  public static getInstance(): PolicyTemplateService {
    if (!PolicyTemplateService.instance) {
      PolicyTemplateService.instance = new PolicyTemplateService();
    }
    return PolicyTemplateService.instance;
  }

  /**
   * Get templates filtered by tenant's effective capabilities.
   */
  async getTemplates(tenantId: string): Promise<PolicyTemplate[]> {
    if (!tenantId) return [];

    try {
      const result = await this.makeDefaultRequest<{ success: boolean; templates: PolicyTemplate[] }>(
        `/api/tenants/${tenantId}/storefront-policies/templates`,
        {},
        `policy-templates-${tenantId}`,
        this.cacheTTL,
      );

      if (!result.success || !result.data) return [];
      return result.data.templates ?? [];
    } catch (error) {
      clientLogger.error('[PolicyTemplate] Failed to get templates:', { detail: error });
      return [];
    }
  }

  /**
   * Get templates grouped by storefront type.
   */
  async getTemplatesGrouped(tenantId: string): Promise<TemplateGroup[]> {
    if (!tenantId) return [];

    try {
      const result = await this.makeDefaultRequest<{ success: boolean; groups: TemplateGroup[] }>(
        `/api/tenants/${tenantId}/storefront-policies/templates?group_by=storefront_type`,
        {},
        `policy-templates-grouped-${tenantId}`,
        this.cacheTTL,
      );

      if (!result.success || !result.data) return [];
      return result.data.groups ?? [];
    } catch (error) {
      clientLogger.error('[PolicyTemplate] Failed to get grouped templates:', { detail: error });
      return [];
    }
  }

  /**
   * Get recommended templates for a tenant.
   */
  async getRecommendedTemplates(tenantId: string): Promise<RecommendedTemplate[]> {
    if (!tenantId) return [];

    try {
      const result = await this.makeDefaultRequest<{ success: boolean; recommendations: RecommendedTemplate[] }>(
        `/api/tenants/${tenantId}/storefront-policies/templates/recommended`,
        {},
        `policy-templates-recommended-${tenantId}`,
        this.cacheTTL,
      );

      if (!result.success || !result.data) return [];
      return result.data.recommendations ?? [];
    } catch (error) {
      clientLogger.error('[PolicyTemplate] Failed to get recommended templates:', { detail: error });
      return [];
    }
  }

  /**
   * Apply a template with placeholder values.
   */
  async applyTemplate(
    tenantId: string,
    templateId: string,
    placeholderValues: Record<string, string | number | null>,
  ): Promise<{ success: boolean; policyType?: string; policies?: any; error?: string }> {
    if (!tenantId || !templateId) {
      return { success: false, error: 'tenantId and templateId are required' };
    }

    try {
      const result = await this.makeDefaultRequest<{ success: boolean; policy_type?: string; policies?: any; error?: string }>(
        `/api/tenants/${tenantId}/storefront-policies/templates/apply`,
        {
          method: 'POST',
          body: JSON.stringify({
            template_id: templateId,
            placeholder_values: placeholderValues,
          }),
        },
        `policy-templates-apply-${tenantId}`,
        0,
      );

      if (!result.success || !result.data) {
        const errMsg = typeof result.error === 'string' ? result.error : (result.error as any)?.message || 'Failed to apply template';
        return { success: false, error: errMsg };
      }

      // Invalidate caches after successful apply
      await this.invalidateServiceCaches(tenantId);
      await this.invalidateCachePattern('tenant-storefront-policies*');

      return {
        success: true,
        policyType: result.data.policy_type,
        policies: result.data.policies,
      };
    } catch (error) {
      clientLogger.error('[PolicyTemplate] Failed to apply template:', { detail: error });
      return { success: false, error: error instanceof Error ? error.message : 'Failed to apply template' };
    }
  }

  /**
   * Get policy completeness scoring for a tenant.
   */
  async getCompleteness(tenantId: string): Promise<CompletenessResult | null> {
    if (!tenantId) return null;

    try {
      const result = await this.makeDefaultRequest<{ success: boolean; completeness: CompletenessResult }>(
        `/api/tenants/${tenantId}/storefront-policies/completeness`,
        {},
        `policy-templates-completeness-${tenantId}`,
        this.cacheTTL,
      );

      if (!result.success || !result.data) return null;
      return result.data.completeness ?? null;
    } catch (error) {
      clientLogger.error('[PolicyTemplate] Failed to get completeness:', { detail: error });
      return null;
    }
  }

  /**
   * Get auto-filled placeholder defaults for a template.
   */
  async getAutoFillDefaults(tenantId: string, templateId: string): Promise<Record<string, string>> {
    if (!tenantId || !templateId) return {};

    try {
      const result = await this.makeDefaultRequest<{ success: boolean; defaults: Record<string, string> }>(
        `/api/tenants/${tenantId}/storefront-policies/templates/${templateId}/auto-fill`,
        {},
      );

      if (!result.success || !result.data) return {};
      return result.data.defaults ?? {};
    } catch (error) {
      clientLogger.error('[PolicyTemplate] Failed to get auto-fill defaults:', { detail: error });
      return {};
    }
  }

  /**
   * Get outdated template usage records for a tenant.
   */
  async getOutdatedUsage(tenantId: string): Promise<OutdatedUsageRecord[]> {
    if (!tenantId) return [];

    try {
      const result = await this.makeDefaultRequest<{ success: boolean; outdated: OutdatedUsageRecord[] }>(
        `/api/tenants/${tenantId}/storefront-policies/templates/outdated`,
        {},
      );

      if (!result.success || !result.data) return [];
      return result.data.outdated ?? [];
    } catch (error) {
      clientLogger.error('[PolicyTemplate] Failed to get outdated usage:', { detail: error });
      return [];
    }
  }
}

export const policyTemplateService = PolicyTemplateService.getInstance();
export default policyTemplateService;
