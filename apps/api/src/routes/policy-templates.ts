/**
 * Policy Template Routes
 *
 * Public:   GET /api/public/policy-templates — list active templates
 * Public:   GET /api/public/policy-templates/:id — single template
 * Tenant:   GET /api/tenants/:tenantId/storefront-policies/templates — tenant-filtered templates
 * Tenant:   GET /api/tenants/:tenantId/storefront-policies/templates?group_by=storefront_type — grouped response
 * Tenant:   GET /api/tenants/:tenantId/storefront-policies/templates/recommended — recommended templates
 * Tenant:   POST /api/tenants/:tenantId/storefront-policies/templates/apply — apply template
 * Admin:    GET /api/admin/policy-templates — all templates
 * Admin:    POST /api/admin/policy-templates — create
 * Admin:    PUT /api/admin/policy-templates/:id — update
 * Admin:    DELETE /api/admin/policy-templates/:id — deactivate
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requirePlatformAdmin } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import policyTemplateService from '../services/PolicyTemplateService';
import storefrontPolicyService from '../services/StorefrontPolicyService';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import BotKnowledgeEmbeddingService from '../services/BotKnowledgeEmbeddingService';
import type { PolicyType } from '../services/StorefrontPolicyService';
import { logger } from '../logger';

const router = Router();

const VALID_POLICY_TYPES: PolicyType[] = [
  'return_policy',
  'shipping_policy',
  'privacy_policy',
  'terms_of_service',
  'refund_policy',
];

// ====================
// ZOD SCHEMAS
// ====================

const placeholderEntrySchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'number', 'select', 'textarea', 'date']),
  required: z.boolean(),
  default: z.union([z.string(), z.number(), z.null()]).optional(),
  options: z.array(z.string()).optional(),
});

const templateCreateSchema = z.object({
  template_key: z.string().min(1).max(100),
  policy_type: z.enum(['return_policy', 'shipping_policy', 'privacy_policy', 'terms_of_service', 'refund_policy']),
  storefront_type: z.string().default('all'),
  product_type: z.string().default('all'),
  fulfillment_mode: z.string().default('all'),
  jurisdiction: z.string().default('GLOBAL'),
  platform: z.string().default('generic'),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  content_markdown: z.string().min(1),
  placeholder_schema: z.array(placeholderEntrySchema).default([]),
  compliance_tags: z.array(z.string()).default([]),
  version: z.string().default('1.0.0'),
  regulatory_effective_date: z.string().datetime().optional(),
  sort_order: z.number().default(0),
});

const templateUpdateSchema = templateCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

const applyTemplateSchema = z.object({
  template_id: z.string().min(1),
  placeholder_values: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).default({}),
});

// ====================
// PUBLIC ROUTES
// ====================

/**
 * GET /api/public/policy-templates
 * Returns all active templates. Optional query filters.
 */
router.get('/public/policy-templates', async (req, res) => {
  try {
    const { storefront_type, policy_type, jurisdiction, platform } = req.query;
    const templates = await policyTemplateService.getAllTemplates({
      storefrontType: storefront_type as string | undefined,
      policyType: policy_type as string | undefined,
      jurisdiction: jurisdiction as string | undefined,
      platform: platform as string | undefined,
    });
    res.json({ success: true, templates });
  } catch (error) {
    logger.error('Error fetching public policy templates:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch templates' });
  }
});

/**
 * GET /api/public/policy-templates/:id
 * Returns a single template by ID.
 */
router.get('/public/policy-templates/:id', async (req, res) => {
  try {
    const template = await policyTemplateService.getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Template not found' });
    }
    res.json({ success: true, template });
  } catch (error) {
    logger.error('Error fetching policy template:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch template' });
  }
});

// ====================
// TENANT ROUTES
// ====================

/**
 * GET /api/tenants/:tenantId/storefront-policies/templates
 * Returns templates filtered by tenant's effective capabilities.
 * Use ?group_by=storefront_type for grouped response.
 */
router.get('/tenants/:tenantId/storefront-policies/templates', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { group_by } = req.query;

    if (group_by === 'storefront_type') {
      const groups = await policyTemplateService.getTemplatesGroupedByStorefrontType(tenantId);
      return res.json({ success: true, groups });
    }

    const templates = await policyTemplateService.getTemplatesForTenant(tenantId);
    res.json({ success: true, templates });
  } catch (error) {
    logger.error('Error fetching tenant policy templates:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch templates' });
  }
});

/**
 * GET /api/tenants/:tenantId/storefront-policies/templates/recommended
 * Returns top recommended template per policy type.
 */
router.get('/tenants/:tenantId/storefront-policies/templates/recommended', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const recommended = await policyTemplateService.getRecommendedTemplates(tenantId);
    res.json({ success: true, recommended });
  } catch (error) {
    logger.error('Error fetching recommended templates:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch recommendations' });
  }
});

/**
 * GET /api/tenants/:tenantId/storefront-policies/templates/usage
 * Returns template usage records for the tenant.
 */
router.get('/tenants/:tenantId/storefront-policies/templates/usage', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const usage = await policyTemplateService.getTemplateUsage(tenantId);
    res.json({ success: true, usage });
  } catch (error) {
    logger.error('Error fetching template usage:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch usage' });
  }
});

/**
 * GET /api/tenants/:tenantId/storefront-policies/completeness
 * Returns policy completeness scoring for the tenant.
 */
router.get('/tenants/:tenantId/storefront-policies/completeness', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const completeness = await policyTemplateService.getPolicyCompleteness(tenantId);
    res.json({ success: true, completeness });
  } catch (error) {
    logger.error('Error fetching policy completeness:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch completeness' });
  }
});

/**
 * GET /api/tenants/:tenantId/storefront-policies/templates/outdated
 * Returns template usage records where the applied version is outdated.
 */
router.get('/tenants/:tenantId/storefront-policies/templates/outdated', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const outdated = await policyTemplateService.getOutdatedTemplateUsage(tenantId);
    const result = await Promise.all(outdated.map(async r => {
      const tmpl = await policyTemplateService.getTemplate(r.templateId);
      return {
        id: r.id,
        templateKey: tmpl?.templateKey ?? '',
        templateTitle: tmpl?.title ?? '',
        policyType: r.policyType,
        appliedVersion: r.templateVersion,
        currentVersion: tmpl?.version ?? '',
        appliedAt: r.appliedAt,
      };
    }));
    res.json({ success: true, outdated: result });
  } catch (error) {
    logger.error('Error fetching outdated templates:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch outdated templates' });
  }
});

/**
 * GET /api/tenants/:tenantId/storefront-policies/templates/:templateId/auto-fill
 * Returns auto-filled placeholder defaults from tenant settings.
 */
router.get('/tenants/:tenantId/storefront-policies/templates/:templateId/auto-fill', authenticateToken, async (req, res) => {
  try {
    const { tenantId, templateId } = req.params;
    const template = await policyTemplateService.getTemplate(templateId);
    if (!template) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Template not found' });
    }
    const defaults = await policyTemplateService.autoFillPlaceholderDefaults(tenantId, template);
    res.json({ success: true, defaults });
  } catch (error) {
    logger.error('Error fetching auto-fill defaults:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch defaults' });
  }
});

/**
 * POST /api/tenants/:tenantId/storefront-policies/templates/apply
 * Apply a template — substitute placeholders and update policies.
 */
router.post('/tenants/:tenantId/storefront-policies/templates/apply', authenticateToken, requireTenantAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const validation = applyTemplateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid request', details: validation.error.issues });
    }

    const { template_id, placeholder_values } = validation.data;

    const template = await policyTemplateService.getTemplate(template_id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Template not found' });
    }
    if (!template.isActive) {
      return res.status(400).json({ success: false, error: 'template_inactive', message: 'This template is no longer active' });
    }

    // Substitute placeholders
    let generatedContent: string;
    try {
      generatedContent = policyTemplateService.substitutePlaceholders(
        template.contentMarkdown,
        template.placeholderSchema,
        placeholder_values as Record<string, string | number | null>
      );
    } catch (subError) {
      return res.status(400).json({
        success: false,
        error: 'missing_placeholder',
        message: subError instanceof Error ? subError.message : 'Missing required placeholders',
      });
    }

    // Upsert the policy
    const updated = await storefrontPolicyService.upsertPolicies(tenantId, {
      [template.policyType]: generatedContent,
    } as any);

    // Log usage
    await policyTemplateService.logTemplateUsage(
      tenantId,
      template.id,
      template.policyType,
      template.version,
      false,
      placeholder_values as Record<string, string | number | null>
    );

    // Invalidate capabilities
    invalidateEffectiveCapabilities(tenantId);

    // Refresh bot embeddings (fire-and-forget)
    BotKnowledgeEmbeddingService.getInstance().refreshPolicyEmbeddings(tenantId).catch(() => {});

    res.json({ success: true, policy_type: template.policyType, policies: updated });
  } catch (error) {
    logger.error('Error applying policy template:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to apply template' });
  }
});

// ====================
// ADMIN ROUTES
// ====================

/**
 * GET /api/admin/policy-templates/needing-review
 * Returns all tenants with outdated template usage (admin view).
 */
router.get('/admin/policy-templates/needing-review', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const needingReview = await policyTemplateService.getTemplatesNeedingReview();
    res.json({ success: true, needingReview });
  } catch (error) {
    logger.error('Error fetching templates needing review:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch needing review' });
  }
});

/**
 * GET /api/admin/policy-templates
 * Returns all templates (active and inactive) for admin management.
 */
router.get('/admin/policy-templates', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const { storefront_type, policy_type, jurisdiction, platform, is_active } = req.query;
    const templates = await policyTemplateService.getAllTemplates({
      storefrontType: storefront_type as string | undefined,
      policyType: policy_type as string | undefined,
      jurisdiction: jurisdiction as string | undefined,
      platform: platform as string | undefined,
      isActive: is_active === undefined ? undefined : is_active === 'true',
    });
    res.json({ success: true, templates });
  } catch (error) {
    logger.error('Error fetching admin policy templates:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch templates' });
  }
});

/**
 * POST /api/admin/policy-templates
 * Create a new template.
 */
router.post('/admin/policy-templates', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const validation = templateCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid template data', details: validation.error.issues });
    }

    const data = validation.data;
    const template = await policyTemplateService.createTemplate({
      templateKey: data.template_key,
      policyType: data.policy_type as PolicyType,
      storefrontType: data.storefront_type,
      productType: data.product_type,
      fulfillmentMode: data.fulfillment_mode,
      jurisdiction: data.jurisdiction,
      platform: data.platform,
      title: data.title,
      description: data.description,
      contentMarkdown: data.content_markdown,
      placeholderSchema: data.placeholder_schema,
      complianceTags: data.compliance_tags,
      version: data.version,
      regulatoryEffectiveDate: data.regulatory_effective_date ? new Date(data.regulatory_effective_date) : undefined,
      sortOrder: data.sort_order,
    });

    res.json({ success: true, template });
  } catch (error) {
    logger.error('Error creating policy template:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to create template' });
  }
});

/**
 * PUT /api/admin/policy-templates/:id
 * Update an existing template.
 */
router.put('/admin/policy-templates/:id', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const validation = templateUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid template data', details: validation.error.issues });
    }

    const data = validation.data;
    const template = await policyTemplateService.updateTemplate(req.params.id, {
      templateKey: data.template_key,
      policyType: data.policy_type as PolicyType,
      storefrontType: data.storefront_type,
      productType: data.product_type,
      fulfillmentMode: data.fulfillment_mode,
      jurisdiction: data.jurisdiction,
      platform: data.platform,
      title: data.title,
      description: data.description,
      contentMarkdown: data.content_markdown,
      placeholderSchema: data.placeholder_schema,
      complianceTags: data.compliance_tags,
      version: data.version,
      regulatoryEffectiveDate: data.regulatory_effective_date ? new Date(data.regulatory_effective_date) : undefined,
      isActive: data.is_active,
      sortOrder: data.sort_order,
    });

    res.json({ success: true, template });
  } catch (error) {
    logger.error('Error updating policy template:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to update template' });
  }
});

/**
 * DELETE /api/admin/policy-templates/:id
 * Deactivate a template (soft delete).
 */
router.delete('/admin/policy-templates/:id', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    await policyTemplateService.deleteTemplate(req.params.id);
    res.json({ success: true, message: 'Template deactivated' });
  } catch (error) {
    logger.error('Error deactivating policy template:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to deactivate template' });
  }
});

export default router;
