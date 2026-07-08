/**
 * Policy Template Service
 *
 * Manages the policy template catalog — pre-defined, customizable policy content
 * grouped by storefront type. Provides filtered template lists, grouped responses,
 * template application with placeholder substitution, and usage logging.
 *
 * Pattern mirrors BadgeRegistryService: DB-driven + 60s cache + static fallback.
 */

import { BaseService } from './BaseService';
import { generatePolicyTemplateId, generatePolicyTemplateUsageId } from '../lib/id-generator';
import { resolveEffectiveCapabilities } from './EffectiveCapabilityResolver';
import type { EffectiveCapabilities } from './resolvers/types';
import type { PolicyType } from './StorefrontPolicyService';

// ====================
// TYPES
// ====================

export interface PlaceholderSchemaEntry {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'date';
  required: boolean;
  default?: string | number | null;
  options?: string[];
}

export interface PolicyTemplate {
  id: string;
  templateKey: string;
  policyType: PolicyType;
  storefrontType: string;
  productType: string;
  fulfillmentMode: string;
  jurisdiction: string;
  platform: string;
  title: string;
  description: string | null;
  contentMarkdown: string;
  placeholderSchema: PlaceholderSchemaEntry[];
  complianceTags: string[];
  version: string;
  regulatoryEffectiveDate: Date | null;
  isActive: boolean;
  sortOrder: number;
}

export interface PolicyTemplateGroup {
  storefrontType: string;
  label: string;
  recommended: boolean;
  count: number;
  templates: PolicyTemplate[];
}

export interface TemplateUsageRecord {
  id: string;
  tenantId: string;
  templateId: string;
  policyType: PolicyType;
  templateVersion: string;
  appliedAt: Date;
  customized: boolean;
  placeholderValues: Record<string, string | number | null>;
}

// ====================
// STATIC FALLBACK
// ====================

const STATIC_TEMPLATES: PolicyTemplate[] = [
  {
    id: 'static-universal-privacy-minimal',
    templateKey: 'universal_privacy_minimal',
    policyType: 'privacy_policy',
    storefrontType: 'all',
    productType: 'all',
    fulfillmentMode: 'all',
    jurisdiction: 'GLOBAL',
    platform: 'generic',
    title: 'Minimal Privacy Policy',
    description: 'Bare-minimum privacy disclosure suitable for trial-tier or simple storefronts.',
    contentMarkdown: '## Privacy Policy\n\n[STORE_NAME] collects basic information (name, email, order details) to process your orders. We do not sell your personal information. Contact us at [CONTACT_EMAIL] with any privacy questions.',
    placeholderSchema: [
      { key: 'STORE_NAME', label: 'Store Name', type: 'text', required: true, default: null },
      { key: 'CONTACT_EMAIL', label: 'Contact Email', type: 'text', required: true, default: null },
    ],
    complianceTags: [],
    version: '1.0.0',
    regulatoryEffectiveDate: null,
    isActive: true,
    sortOrder: 100,
  },
  {
    id: 'static-universal-terms-minimal',
    templateKey: 'universal_terms_minimal',
    policyType: 'terms_of_service',
    storefrontType: 'all',
    productType: 'all',
    fulfillmentMode: 'all',
    jurisdiction: 'GLOBAL',
    platform: 'generic',
    title: 'Minimal Terms of Service',
    description: 'Bare-minimum terms of service for trial-tier or simple storefronts.',
    contentMarkdown: '## Terms of Service\n\nBy using this storefront, you agree to: (1) provide accurate information when placing orders, (2) pay for all items purchased, and (3) acknowledge that prices may change without notice. All sales are subject to applicable taxes.',
    placeholderSchema: [],
    complianceTags: [],
    version: '1.0.0',
    regulatoryEffectiveDate: null,
    isActive: true,
    sortOrder: 101,
  },
  {
    id: 'static-universal-return-minimal',
    templateKey: 'universal_return_minimal',
    policyType: 'return_policy',
    storefrontType: 'all',
    productType: 'physical',
    fulfillmentMode: 'all',
    jurisdiction: 'GLOBAL',
    platform: 'generic',
    title: 'Minimal Return Policy',
    description: 'Simple 7-day return policy for basic storefronts.',
    contentMarkdown: '## Return Policy\n\nItems can be returned within 7 days of purchase if in original condition. Contact us at [CONTACT_EMAIL] to arrange a return.',
    placeholderSchema: [
      { key: 'CONTACT_EMAIL', label: 'Contact Email', type: 'text', required: true, default: null },
    ],
    complianceTags: [],
    version: '1.0.0',
    regulatoryEffectiveDate: null,
    isActive: true,
    sortOrder: 102,
  },
  {
    id: 'static-universal-refund-minimal',
    templateKey: 'universal_refund_minimal',
    policyType: 'refund_policy',
    storefrontType: 'all',
    productType: 'all',
    fulfillmentMode: 'all',
    jurisdiction: 'GLOBAL',
    platform: 'generic',
    title: 'Minimal Refund Policy',
    description: 'Simple refund-to-original-payment policy for basic storefronts.',
    contentMarkdown: '## Refund Policy\n\nRefunds are issued to your original payment method within 5-7 business days. Contact us at [CONTACT_EMAIL] with any refund questions.',
    placeholderSchema: [
      { key: 'CONTACT_EMAIL', label: 'Contact Email', type: 'text', required: true, default: null },
    ],
    complianceTags: [],
    version: '1.0.0',
    regulatoryEffectiveDate: null,
    isActive: true,
    sortOrder: 103,
  },
  {
    id: 'static-online-privacy-ccpa',
    templateKey: 'online_privacy_ccpa',
    policyType: 'privacy_policy',
    storefrontType: 'online',
    productType: 'all',
    fulfillmentMode: 'all',
    jurisdiction: 'US',
    platform: 'generic',
    title: 'Privacy Policy (CCPA Compliant)',
    description: 'Privacy policy compliant with California Consumer Privacy Act (CCPA).',
    contentMarkdown: '## Privacy Policy\n\n[STORE_NAME] ("we", "us", "our") respects your privacy and is committed to protecting your personal data. This privacy policy explains how we collect, use, and disclose your information.\n\n### Information We Collect\n- **Contact Information**: Name, email address, phone number, shipping address\n- **Order Information**: Purchase history, payment method (we do not store full card numbers)\n- **Usage Data**: Browsing activity on our storefront, device information\n\n### How We Use Your Information\n- To process and fulfill your orders\n- To communicate with you about your orders\n- To improve our products and services\n- To send marketing emails (you may opt out at any time)\n\n### Your Rights (California Residents)\nUnder the California Consumer Privacy Act (CCPA), you have the right to:\n- Know what personal data we collect about you\n- Request deletion of your personal data\n- Opt out of the sale of your personal data (we do not sell your data)\n- Non-discrimination for exercising your rights\n\n### Contact Us\nFor privacy questions or requests, email us at [PRIVACY_CONTACT_EMAIL].',
    placeholderSchema: [
      { key: 'STORE_NAME', label: 'Store Name', type: 'text', required: true, default: null },
      { key: 'PRIVACY_CONTACT_EMAIL', label: 'Privacy Contact Email', type: 'text', required: true, default: null },
    ],
    complianceTags: ['CCPA'],
    version: '1.0.0',
    regulatoryEffectiveDate: null,
    isActive: true,
    sortOrder: 3,
  },
];

// ====================
// CACHE
// ====================

const CACHE_TTL_MS = 60_000; // 60 seconds

let cachedTemplates: PolicyTemplate[] | null = null;
let cacheExpiry = 0;

// ====================
// DB ROW → PolicyTemplate
// ====================

function dbRowToTemplate(row: any): PolicyTemplate {
  return {
    id: row.id,
    templateKey: row.template_key,
    policyType: row.policy_type as PolicyType,
    storefrontType: row.storefront_type,
    productType: row.product_type,
    fulfillmentMode: row.fulfillment_mode,
    jurisdiction: row.jurisdiction,
    platform: row.platform,
    title: row.title,
    description: row.description,
    contentMarkdown: row.content_markdown,
    placeholderSchema: Array.isArray(row.placeholder_schema) ? row.placeholder_schema : [],
    complianceTags: Array.isArray(row.compliance_tags) ? row.compliance_tags : [],
    version: row.version,
    regulatoryEffectiveDate: row.regulatory_effective_date ?? null,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

// ====================
// SERVICE
// ====================

class PolicyTemplateService extends BaseService {
  private static instance: PolicyTemplateService;

  private constructor() {
    super();
  }

  static getInstance(): PolicyTemplateService {
    if (!PolicyTemplateService.instance) {
      PolicyTemplateService.instance = new PolicyTemplateService();
    }
    return PolicyTemplateService.instance;
  }

  /**
   * Get all active templates from DB with 60s cache.
   * Falls back to static templates if DB is unavailable.
   */
  async getAllTemplates(filters?: {
    storefrontType?: string;
    policyType?: string;
    jurisdiction?: string;
    platform?: string;
    isActive?: boolean;
  }): Promise<PolicyTemplate[]> {
    try {
      const now = Date.now();
      if (cachedTemplates && now < cacheExpiry) {
        return this.applyFilters(cachedTemplates, filters);
      }

      const rows = await this.prisma.policy_templates.findMany({
        where: {
          is_active: filters?.isActive ?? true,
          ...(filters?.storefrontType && filters.storefrontType !== 'all' ? { storefront_type: filters.storefrontType } : {}),
          ...(filters?.policyType ? { policy_type: filters.policyType } : {}),
          ...(filters?.jurisdiction ? { jurisdiction: filters.jurisdiction } : {}),
          ...(filters?.platform && filters.platform !== 'generic' ? { platform: filters.platform } : {}),
        },
        orderBy: [{ sort_order: 'asc' }, { title: 'asc' }],
      });

      if (rows.length === 0) {
        this.logger.info('PolicyTemplateService: DB returned no templates, using static fallback', undefined, { count: STATIC_TEMPLATES.length });
        cachedTemplates = STATIC_TEMPLATES;
      } else {
        cachedTemplates = rows.map(dbRowToTemplate);
      }
      cacheExpiry = now + CACHE_TTL_MS;

      return this.applyFilters(cachedTemplates, filters);
    } catch (error) {
      this.logger.error('PolicyTemplateService: Failed to fetch templates, using static fallback', undefined, { error });
      return this.applyFilters(STATIC_TEMPLATES, filters);
    }
  }

  private applyFilters(templates: PolicyTemplate[], filters?: {
    storefrontType?: string;
    policyType?: string;
    jurisdiction?: string;
    platform?: string;
  }): PolicyTemplate[] {
    if (!filters) return templates;
    return templates.filter(t => {
      if (filters.storefrontType && t.storefrontType !== 'all' && t.storefrontType !== filters.storefrontType) return false;
      if (filters.policyType && t.policyType !== filters.policyType) return false;
      if (filters.jurisdiction && t.jurisdiction !== 'GLOBAL' && t.jurisdiction !== filters.jurisdiction) return false;
      if (filters.platform && t.platform !== 'generic' && t.platform !== filters.platform) return false;
      return true;
    });
  }

  /**
   * Get a single template by ID.
   */
  async getTemplate(id: string): Promise<PolicyTemplate | null> {
    try {
      const row = await this.prisma.policy_templates.findUnique({ where: { id } });
      return row ? dbRowToTemplate(row) : null;
    } catch (error) {
      this.logger.error('PolicyTemplateService: Failed to fetch template by id', undefined, { error, id });
      const staticTemplate = STATIC_TEMPLATES.find(t => t.id === id);
      return staticTemplate ?? null;
    }
  }

  /**
   * Get a single template by template_key.
   */
  async getTemplateByKey(key: string): Promise<PolicyTemplate | null> {
    try {
      const row = await this.prisma.policy_templates.findUnique({ where: { template_key: key } });
      return row ? dbRowToTemplate(row) : null;
    } catch (error) {
      this.logger.error('PolicyTemplateService: Failed to fetch template by key', undefined, { error, key });
      const staticTemplate = STATIC_TEMPLATES.find(t => t.templateKey === key);
      return staticTemplate ?? null;
    }
  }

  /**
   * Get templates filtered by tenant's effective capabilities.
   * Resolves storefront type, fulfillment, product types, and jurisdiction.
   */
  async getTemplatesForTenant(tenantId: string): Promise<PolicyTemplate[]> {
    try {
      const caps = await resolveEffectiveCapabilities(tenantId);
      if (!caps) {
        return this.getAllTemplates();
      }

      const storefrontType = caps.effective.storefront?.effective_type ?? 'online';
      const fulfillment = caps.effective.fulfillment;
      const productTypes = caps.effective.product_types;
      const jurisdiction = await this.detectJurisdiction(tenantId);

      const fulfillmentModes: string[] = ['all'];
      if (fulfillment?.effective_shows_pickup) fulfillmentModes.push('pickup');
      if (fulfillment?.effective_shows_delivery) fulfillmentModes.push('delivery');
      if (fulfillment?.effective_shows_shipping) fulfillmentModes.push('shipping');
      if (fulfillment?.shows_service) fulfillmentModes.push('service');

      const effectiveProductTypes: string[] = ['all'];
      if (productTypes?.effective_types) {
        effectiveProductTypes.push(...productTypes.effective_types);
      }

      const allTemplates = await this.getAllTemplates();
      return allTemplates.filter(t => {
        if (t.storefrontType !== 'all' && t.storefrontType !== storefrontType) return false;
        if (t.fulfillmentMode !== 'all' && !fulfillmentModes.includes(t.fulfillmentMode)) return false;
        if (t.productType !== 'all' && !effectiveProductTypes.includes(t.productType)) return false;
        if (t.jurisdiction !== 'GLOBAL' && t.jurisdiction !== jurisdiction) return false;
        return true;
      });
    } catch (error) {
      this.logger.error('PolicyTemplateService: Failed to get templates for tenant', undefined, { error, tenantId });
      return this.getAllTemplates();
    }
  }

  /**
   * Get templates grouped by storefront type with recommended flag.
   */
  async getTemplatesGroupedByStorefrontType(tenantId: string): Promise<PolicyTemplateGroup[]> {
    try {
      const caps = await resolveEffectiveCapabilities(tenantId);
      const effectiveType = caps?.effective.storefront?.effective_type ?? 'online';
      const tenantTemplates = await this.getTemplatesForTenant(tenantId);

      const groupOrder = ['online', 'retail', 'service', 'social', 'all'];
      const groupLabels: Record<string, string> = {
        online: 'Online Storefront',
        retail: 'Retail Storefront',
        service: 'Service Storefront',
        social: 'Social Storefront',
        all: 'Universal',
      };

      const groups: PolicyTemplateGroup[] = groupOrder
        .map(type => {
          const templates = tenantTemplates.filter(t => t.storefrontType === type);
          return {
            storefrontType: type,
            label: groupLabels[type] ?? type,
            recommended: type === effectiveType,
            count: templates.length,
            templates,
          };
        })
        .filter(g => g.count > 0);

      return groups;
    } catch (error) {
      this.logger.error('PolicyTemplateService: Failed to get grouped templates', undefined, { error, tenantId });
      return [];
    }
  }

  /**
   * Get recommended templates using rule-based scoring.
   * Returns top template per policy type.
   */
  async getRecommendedTemplates(tenantId: string): Promise<PolicyTemplate[]> {
    try {
      const caps = await resolveEffectiveCapabilities(tenantId);
      const effectiveType = caps?.effective.storefront?.effective_type ?? 'online';
      const fulfillment = caps?.effective.fulfillment;
      const productTypes = caps?.effective.product_types;
      const jurisdiction = await this.detectJurisdiction(tenantId);

      const allTemplates = await this.getTemplatesForTenant(tenantId);
      const policyTypes: PolicyType[] = ['return_policy', 'shipping_policy', 'privacy_policy', 'terms_of_service', 'refund_policy'];

      const recommendations: PolicyTemplate[] = [];
      for (const policyType of policyTypes) {
        const candidates = allTemplates.filter(t => t.policyType === policyType);
        if (candidates.length === 0) continue;

        const scored = candidates.map(t => {
          let score = 0;
          if (t.storefrontType === effectiveType) score += 3;
          if (t.storefrontType === 'all') score += 1;
          if (t.jurisdiction === jurisdiction) score += 2;
          if (t.jurisdiction === 'GLOBAL') score += 1;
          if (t.fulfillmentMode !== 'all') {
            if (t.fulfillmentMode === 'shipping' && fulfillment?.effective_shows_shipping) score += 2;
            if (t.fulfillmentMode === 'pickup' && fulfillment?.effective_shows_pickup) score += 2;
            if (t.fulfillmentMode === 'delivery' && fulfillment?.effective_shows_delivery) score += 2;
            if (t.fulfillmentMode === 'service' && fulfillment?.shows_service) score += 2;
          }
          if (t.productType !== 'all' && productTypes?.effective_types?.includes(t.productType as any)) score += 2;
          return { template: t, score };
        });

        scored.sort((a, b) => b.score - a.score);
        if (scored[0]) {
          recommendations.push(scored[0].template);
        }
      }

      return recommendations;
    } catch (error) {
      this.logger.error('PolicyTemplateService: Failed to get recommended templates', undefined, { error, tenantId });
      return [];
    }
  }

  /**
   * Auto-fill placeholder defaults from tenant fulfillment settings and business profile.
   * Returns a map of placeholder key -> default value.
   */
  async autoFillPlaceholderDefaults(tenantId: string, template: PolicyTemplate): Promise<Record<string, string>> {
    const defaults: Record<string, string> = {};

    try {
      const [fulfillment, profile, tenant] = await Promise.all([
        this.prisma.tenant_fulfillment_settings.findUnique({ where: { tenant_id: tenantId } }),
        this.prisma.tenant_business_profiles_list.findFirst({ where: { tenant_id: tenantId } }),
        this.prisma.tenants.findUnique({ where: { id: tenantId }, select: { name: true } }),
      ]);

      const schema = template.placeholderSchema || [];
      for (const entry of schema) {
        const key = entry.key.toUpperCase();

        if (key === 'STORE_NAME' && tenant?.name) {
          defaults[entry.key] = tenant.name;
        } else if (key === 'SHIPPING_HANDLING_DAYS' && fulfillment?.shipping_handling_days != null) {
          defaults[entry.key] = String(fulfillment.shipping_handling_days);
        } else if (key === 'PICKUP_READY_TIME_MINUTES' && fulfillment?.pickup_ready_time_minutes != null) {
          defaults[entry.key] = String(fulfillment.pickup_ready_time_minutes);
        } else if (key === 'PICKUP_INSTRUCTIONS' && fulfillment?.pickup_instructions) {
          defaults[entry.key] = fulfillment.pickup_instructions;
        } else if (key === 'DELIVERY_TIME_HOURS' && fulfillment?.delivery_time_hours != null) {
          defaults[entry.key] = String(fulfillment.delivery_time_hours);
        } else if (key === 'DELIVERY_RADIUS_MILES' && fulfillment?.delivery_radius_miles != null) {
          defaults[entry.key] = String(fulfillment.delivery_radius_miles);
        } else if (key === 'CONTACT_EMAIL' || key === 'PRIVACY_CONTACT_EMAIL' || key === 'DPO_EMAIL' || key === 'PRIVACY_OFFICER_EMAIL') {
          if (profile?.email) defaults[entry.key] = profile.email;
        } else if (key === 'LAST_UPDATED_DATE') {
          defaults[entry.key] = new Date().toISOString().split('T')[0];
        } else if (key === 'GOVERNING_COUNTRY' || key === 'GOVERNING_JURISDICTION') {
          if (profile?.country_code) defaults[entry.key] = profile.country_code;
        } else if (entry.default != null && entry.default !== '') {
          defaults[entry.key] = String(entry.default);
        }
      }
    } catch (error) {
      this.logger.error('PolicyTemplateService: Failed to auto-fill placeholders', undefined, { error, tenantId });
    }

    return defaults;
  }

  /**
   * Detect jurisdiction from tenant's business profile country code.
   */
  async detectJurisdiction(tenantId: string): Promise<string> {
    try {
      const profile = await this.prisma.tenant_business_profiles_list.findFirst({
        where: { tenant_id: tenantId },
        select: { country_code: true },
      });

      const countryCode = profile?.country_code?.toUpperCase() ?? 'US';
      return this.mapCountryToJurisdiction(countryCode);
    } catch (error) {
      this.logger.error('PolicyTemplateService: Failed to detect jurisdiction', undefined, { error, tenantId });
      return 'GLOBAL';
    }
  }

  private mapCountryToJurisdiction(countryCode: string): string {
    const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
    if (countryCode === 'US') return 'US';
    if (countryCode === 'GB') return 'UK';
    if (countryCode === 'CA') return 'CA';
    if (countryCode === 'AU') return 'AU';
    if (euCountries.includes(countryCode)) return 'EU';
    return 'GLOBAL';
  }

  /**
   * Substitute placeholders in template content with provided values.
   * Throws if required placeholders are missing.
   */
  substitutePlaceholders(content: string, schema: PlaceholderSchemaEntry[], values: Record<string, string | number | null>): string {
    let result = content;

    for (const entry of schema) {
      const value = values[entry.key];
      if (entry.required && (value === undefined || value === null || value === '')) {
        throw new Error(`Missing required placeholder: ${entry.key} (${entry.label})`);
      }
      const replacement = value !== undefined && value !== null ? String(value) : '';
      result = result.replace(new RegExp(`\\[${entry.key}\\]`, 'g'), replacement);
    }

    // Clean up any remaining unfilled placeholders
    result = result.replace(/\[[A-Z_]+\]/g, '');

    return result;
  }

  /**
   * Log template usage in tenant_policy_template_usage table.
   */
  async logTemplateUsage(
    tenantId: string,
    templateId: string,
    policyType: PolicyType,
    templateVersion: string,
    customized: boolean,
    placeholderValues: Record<string, string | number | null>
  ): Promise<void> {
    try {
      await this.prisma.tenant_policy_template_usage.create({
        data: {
          id: generatePolicyTemplateUsageId(tenantId),
          tenant_id: tenantId,
          template_id: templateId,
          policy_type: policyType,
          template_version: templateVersion,
          applied_at: new Date(),
          customized,
          placeholder_values: placeholderValues as any,
        },
      });
    } catch (error) {
      this.logger.error('PolicyTemplateService: Failed to log template usage', undefined, { error, tenantId, templateId });
    }
  }

  /**
   * Get template usage records for a tenant.
   */
  async getTemplateUsage(tenantId: string): Promise<TemplateUsageRecord[]> {
    try {
      const rows = await this.prisma.tenant_policy_template_usage.findMany({
        where: { tenant_id: tenantId },
        orderBy: { applied_at: 'desc' },
      });
      return rows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        templateId: row.template_id,
        policyType: row.policy_type as PolicyType,
        templateVersion: row.template_version,
        appliedAt: row.applied_at,
        customized: row.customized,
        placeholderValues: row.placeholder_values ?? {},
      }));
    } catch (error) {
      this.logger.error('PolicyTemplateService: Failed to get template usage', undefined, { error, tenantId });
      return [];
    }
  }

  /**
   * Get outdated template usage records (where template version has changed).
   */
  async getOutdatedTemplateUsage(tenantId: string): Promise<TemplateUsageRecord[]> {
    try {
      const usageRecords = await this.getTemplateUsage(tenantId);
      if (usageRecords.length === 0) return [];

      const outdated: TemplateUsageRecord[] = [];
      for (const record of usageRecords) {
        const template = await this.getTemplate(record.templateId);
        if (template && template.version !== record.templateVersion) {
          outdated.push(record);
        }
      }
      return outdated;
    } catch (error) {
      this.logger.error('PolicyTemplateService: Failed to get outdated template usage', undefined, { error, tenantId });
      return [];
    }
  }

  /**
   * Invalidate the in-memory cache.
   */
  invalidateCache(): void {
    cachedTemplates = null;
    cacheExpiry = 0;
    this.logger.info('PolicyTemplateService: Cache invalidated', undefined, {});
  }

  /**
   * Get all tenants with outdated template usage (admin view).
   * Returns a flat list of usage records where the applied version differs from current.
   */
  async getTemplatesNeedingReview(): Promise<Array<{
    tenantId: string;
    templateId: string;
    templateKey: string;
    templateTitle: string;
    policyType: string;
    appliedVersion: string;
    currentVersion: string;
    appliedAt: Date;
  }>> {
    try {
      const usageRows = await this.prisma.tenant_policy_template_usage.findMany({
        orderBy: { applied_at: 'desc' },
        take: 500,
      });

      const results: Array<{
        tenantId: string;
        templateId: string;
        templateKey: string;
        templateTitle: string;
        policyType: string;
        appliedVersion: string;
        currentVersion: string;
        appliedAt: Date;
      }> = [];

      const templateCache = new Map<string, PolicyTemplate | null>();

      for (const row of usageRows) {
        let template = templateCache.get(row.template_id);
        if (template === undefined) {
          template = await this.getTemplate(row.template_id);
          templateCache.set(row.template_id, template);
        }
        if (template && template.version !== row.template_version) {
          results.push({
            tenantId: row.tenant_id,
            templateId: row.template_id,
            templateKey: template.templateKey,
            templateTitle: template.title,
            policyType: row.policy_type,
            appliedVersion: row.template_version,
            currentVersion: template.version,
            appliedAt: row.applied_at,
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error('PolicyTemplateService: Failed to get templates needing review', undefined, { error });
      return [];
    }
  }

  // ====================
  // ADMIN CRUD
  // ====================

  async createTemplate(data: {
    templateKey: string;
    policyType: PolicyType;
    storefrontType?: string;
    productType?: string;
    fulfillmentMode?: string;
    jurisdiction?: string;
    platform?: string;
    title: string;
    description?: string;
    contentMarkdown: string;
    placeholderSchema?: PlaceholderSchemaEntry[];
    complianceTags?: string[];
    version?: string;
    regulatoryEffectiveDate?: Date;
    sortOrder?: number;
  }): Promise<PolicyTemplate> {
    const row = await this.prisma.policy_templates.create({
      data: {
        id: generatePolicyTemplateId(),
        template_key: data.templateKey,
        policy_type: data.policyType,
        storefront_type: data.storefrontType ?? 'all',
        product_type: data.productType ?? 'all',
        fulfillment_mode: data.fulfillmentMode ?? 'all',
        jurisdiction: data.jurisdiction ?? 'GLOBAL',
        platform: data.platform ?? 'generic',
        title: data.title,
        description: data.description ?? null,
        content_markdown: data.contentMarkdown,
        placeholder_schema: (data.placeholderSchema ?? []) as any,
        compliance_tags: data.complianceTags ?? [],
        version: data.version ?? '1.0.0',
        regulatory_effective_date: data.regulatoryEffectiveDate ?? null,
        is_active: true,
        sort_order: data.sortOrder ?? 0,
      },
    });
    this.invalidateCache();
    return dbRowToTemplate(row);
  }

  async updateTemplate(id: string, data: Partial<{
    templateKey: string;
    policyType: PolicyType;
    storefrontType: string;
    productType: string;
    fulfillmentMode: string;
    jurisdiction: string;
    platform: string;
    title: string;
    description: string;
    contentMarkdown: string;
    placeholderSchema: PlaceholderSchemaEntry[];
    complianceTags: string[];
    version: string;
    regulatoryEffectiveDate: Date;
    isActive: boolean;
    sortOrder: number;
  }>): Promise<PolicyTemplate> {
    const updateData: any = { updated_at: new Date() };
    if (data.templateKey !== undefined) updateData.template_key = data.templateKey;
    if (data.policyType !== undefined) updateData.policy_type = data.policyType;
    if (data.storefrontType !== undefined) updateData.storefront_type = data.storefrontType;
    if (data.productType !== undefined) updateData.product_type = data.productType;
    if (data.fulfillmentMode !== undefined) updateData.fulfillment_mode = data.fulfillmentMode;
    if (data.jurisdiction !== undefined) updateData.jurisdiction = data.jurisdiction;
    if (data.platform !== undefined) updateData.platform = data.platform;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.contentMarkdown !== undefined) updateData.content_markdown = data.contentMarkdown;
    if (data.placeholderSchema !== undefined) updateData.placeholder_schema = data.placeholderSchema as any;
    if (data.complianceTags !== undefined) updateData.compliance_tags = data.complianceTags;
    if (data.version !== undefined) updateData.version = data.version;
    if (data.regulatoryEffectiveDate !== undefined) updateData.regulatory_effective_date = data.regulatoryEffectiveDate;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;

    const row = await this.prisma.policy_templates.update({
      where: { id },
      data: updateData,
    });
    this.invalidateCache();
    return dbRowToTemplate(row);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.prisma.policy_templates.update({
      where: { id },
      data: { is_active: false, updated_at: new Date() },
    });
    this.invalidateCache();
  }

  // ====================
  // COMPLETENESS SCORING
  // ====================

  private readonly REQUIRED_POLICIES_BY_STOREFRONT: Record<string, PolicyType[]> = {
    online: ['return_policy', 'shipping_policy', 'privacy_policy', 'terms_of_service', 'refund_policy'],
    retail: ['return_policy', 'privacy_policy', 'terms_of_service', 'refund_policy'],
    service: ['privacy_policy', 'terms_of_service', 'refund_policy'],
    social: ['return_policy', 'privacy_policy', 'terms_of_service', 'refund_policy'],
    all: ['privacy_policy', 'terms_of_service'],
  };

  private readonly MIN_POLICY_LENGTH = 200;

  async getPolicyCompleteness(tenantId: string): Promise<{
    jurisdiction: string;
    policies: Array<{
      policyType: PolicyType;
      status: 'complete' | 'partial' | 'missing';
      required: boolean;
      recommendations: string[];
    }>;
    overallScore: number;
  }> {
    try {
      const [caps, jurisdiction, policiesRow] = await Promise.all([
        resolveEffectiveCapabilities(tenantId),
        this.detectJurisdiction(tenantId),
        this.prisma.tenant_storefront_policies.findUnique({
          where: { tenant_id: tenantId },
        }),
      ]);

      const storefrontType = caps?.effective.storefront?.effective_type ?? 'online';
      const requiredPolicies = this.REQUIRED_POLICIES_BY_STOREFRONT[storefrontType]
        ?? this.REQUIRED_POLICIES_BY_STOREFRONT['all'];

      const policyTypes: PolicyType[] = ['return_policy', 'shipping_policy', 'privacy_policy', 'terms_of_service', 'refund_policy'];
      const policyLabels: Record<string, string> = {
        return_policy: 'Return Policy',
        shipping_policy: 'Shipping Policy',
        privacy_policy: 'Privacy Policy',
        terms_of_service: 'Terms of Service',
        refund_policy: 'Refund Policy',
      };

      const results = policyTypes.map(pt => {
        const content = policiesRow?.[pt] as string | null;
        const required = requiredPolicies.includes(pt);
        const recommendations: string[] = [];

        let status: 'complete' | 'partial' | 'missing';
        if (!content || content.trim().length === 0) {
          status = 'missing';
          if (required) recommendations.push(`${policyLabels[pt]} is required for your storefront type`);
          recommendations.push('Browse templates to get started quickly');
        } else if (content.trim().length < this.MIN_POLICY_LENGTH) {
          status = 'partial';
          recommendations.push('Policy content is short — consider adding more detail');
        } else {
          status = 'complete';
        }

        return { policyType: pt, status, required, recommendations };
      });

      const completed = results.filter(r => r.status === 'complete').length;
      const overallScore = Math.round((completed / results.length) * 100);

      return { jurisdiction, policies: results, overallScore };
    } catch (error) {
      this.logger.error('PolicyTemplateService: Failed to get policy completeness', undefined, { error, tenantId });
      return {
        jurisdiction: 'GLOBAL',
        policies: [],
        overallScore: 0,
      };
    }
  }
}

const policyTemplateService = PolicyTemplateService.getInstance();
export { policyTemplateService, PolicyTemplateService };
export default policyTemplateService;
