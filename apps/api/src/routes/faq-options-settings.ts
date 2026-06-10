import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import FaqOptionsService from '../services/FaqOptionsService';

const router = Router();

// Validation schema
const faqOptionsSettingsSchema = z.object({
  faq_enabled: z.boolean().optional(),
  faq_storefront_enabled: z.boolean().optional(),
  faq_product_enabled: z.boolean().optional(),
  faq_templates_enabled: z.boolean().optional(),
  faq_chatbot_knowledge_base: z.boolean().optional(),
  faq_management_hub: z.boolean().optional(),
  faq_management_templates: z.boolean().optional(),
  faq_management_import: z.boolean().optional(),
  faq_management_bulk_actions: z.boolean().optional(),
  faq_management_reorder: z.boolean().optional(),
  faq_management_search: z.boolean().optional(),
  faq_preview_bot: z.boolean().optional(),
  faq_preview_gap_report: z.boolean().optional(),
  faq_display_storefront_accordion: z.boolean().optional(),
  faq_display_product_accordion: z.boolean().optional(),
  faq_display_feedback: z.boolean().optional(),
  faq_display_bot_handoff: z.boolean().optional(),
  faq_kb_coverage_metrics: z.boolean().optional(),
  faq_kb_auto_sync: z.boolean().optional(),
});

// Default settings — core features on, advanced/chatbot features off
const DEFAULT_SETTINGS = {
  faq_enabled: true,
  faq_storefront_enabled: true,
  faq_product_enabled: true,
  faq_templates_enabled: true,
  faq_chatbot_knowledge_base: false,
  faq_management_hub: true,
  faq_management_templates: true,
  faq_management_import: true,
  faq_management_bulk_actions: true,
  faq_management_reorder: true,
  faq_management_search: true,
  faq_preview_bot: false,
  faq_preview_gap_report: false,
  faq_display_storefront_accordion: true,
  faq_display_product_accordion: true,
  faq_display_feedback: true,
  faq_display_bot_handoff: false,
  faq_kb_coverage_metrics: false,
  faq_kb_auto_sync: false,
};

// All feature keys for iteration
const FAQ_FEATURE_KEYS = [
  'faq_enabled',
  'faq_storefront_enabled',
  'faq_product_enabled',
  'faq_templates_enabled',
  'faq_chatbot_knowledge_base',
  'faq_management_hub',
  'faq_management_templates',
  'faq_management_import',
  'faq_management_bulk_actions',
  'faq_management_reorder',
  'faq_management_search',
  'faq_preview_bot',
  'faq_preview_gap_report',
  'faq_display_storefront_accordion',
  'faq_display_product_accordion',
  'faq_display_feedback',
  'faq_display_bot_handoff',
  'faq_kb_coverage_metrics',
  'faq_kb_auto_sync',
] as const;

// Get FAQ options settings for a tenant
router.get('/:tenantId/faq-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Resolve tier capabilities for tier-gate-aware merchant gate
    const faqService = FaqOptionsService.getInstance();
    const tierState = await faqService.resolveFaqOptionsState(tenantId);

    // Hard gate: if FAQ is disabled at tier level, return all-false
    if (!tierState.enabled) {
      const allOff: Record<string, boolean> = {};
      for (const key of FAQ_FEATURE_KEYS) {
        allOff[key] = key === 'faq_enabled' ? false : false;
      }
      return res.json({
        success: true,
        settings: allOff,
        tierState,
      });
    }

    // Fetch merchant preferences from DB
    const merchantPrefs = await prisma.tenant_faq_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = merchantPrefs || DEFAULT_SETTINGS;

    // Enforce tier gates: force off any feature not in tier's allowedTypes
    const tierFilteredSettings: Record<string, boolean> = {
      faq_enabled: !!rawSettings.faq_enabled && tierState.enabled,
    };

    // Management features
    const mgmtKeys = ['faq_management_hub', 'faq_management_templates', 'faq_management_import', 'faq_management_bulk_actions', 'faq_management_reorder', 'faq_management_search'] as const;
    for (const key of mgmtKeys) {
      const isAllowed = tierState.managementEnabled || tierState.allowedManagementTypes.includes(key as any);
      tierFilteredSettings[key] = isAllowed ? !!(rawSettings as any)[key] : false;
    }

    // Preview features
    const previewKeys = ['faq_preview_bot', 'faq_preview_gap_report'] as const;
    for (const key of previewKeys) {
      const isAllowed = tierState.previewEnabled || tierState.allowedPreviewTypes.includes(key as any);
      tierFilteredSettings[key] = isAllowed ? !!(rawSettings as any)[key] : false;
    }

    // Display features — clamp to scope-specific tier gates
    const displayKeys = ['faq_display_storefront_accordion', 'faq_display_product_accordion', 'faq_display_feedback', 'faq_display_bot_handoff'] as const;
    for (const key of displayKeys) {
      let isAllowed = tierState.displayEnabled || tierState.allowedDisplayTypes.includes(key as any);
      if (key === 'faq_display_storefront_accordion') {
        isAllowed = isAllowed && tierState.storefrontEnabled;
      } else if (key === 'faq_display_product_accordion') {
        isAllowed = isAllowed && tierState.productEnabled;
      }
      tierFilteredSettings[key] = isAllowed ? !!(rawSettings as any)[key] : false;
    }

    // KB / advanced features
    tierFilteredSettings.faq_chatbot_knowledge_base = tierState.kbEnabled ? !!rawSettings.faq_chatbot_knowledge_base : false;
    tierFilteredSettings.faq_kb_coverage_metrics = tierState.kbEnabled ? !!rawSettings.faq_kb_coverage_metrics : false;
    tierFilteredSettings.faq_kb_auto_sync = (tierState.kbEnabled && tierState.allowedKbTypes?.includes('faq_kb_auto_sync')) ? !!rawSettings.faq_kb_auto_sync : false;
    tierFilteredSettings.faq_storefront_enabled = !!rawSettings.faq_storefront_enabled && tierState.storefrontEnabled;
    tierFilteredSettings.faq_product_enabled = !!rawSettings.faq_product_enabled && tierState.productEnabled;
    tierFilteredSettings.faq_templates_enabled = !!rawSettings.faq_templates_enabled && tierState.templatesEnabled;

    res.json({
      success: true,
      settings: tierFilteredSettings,
      tierState,
    });
  } catch (error) {
    console.error('Error fetching FAQ options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch FAQ options settings',
    });
  }
});

// Update FAQ options settings for a tenant
router.put('/:tenantId/faq-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = faqOptionsSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid FAQ options settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Resolve tier capabilities for tier-gate-aware validation
    const faqService = FaqOptionsService.getInstance();
    const tierState = await faqService.resolveFaqOptionsState(tenantId);

    // Hard gate: if FAQ is disabled at tier level, block all updates
    if (!tierState.enabled) {
      return res.status(403).json({
        success: false,
        error: 'capability_disabled',
        message: 'FAQ options capability is disabled for this tenant\'s tier',
      });
    }

    // Type gate: validate each feature toggle against tier allowed types
    const filteredData: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(data)) {
      // Always allow faq_enabled toggle if tier allows it
      if (key === 'faq_enabled') {
        filteredData[key] = value;
        continue;
      }
      // Storefront/product/templates scope gates — only allowed if tier enables that scope
      if (key === 'faq_storefront_enabled') {
        if (tierState.storefrontEnabled) { filteredData[key] = value; }
        else if (value === true) {
          return res.status(403).json({ success: false, error: 'tier_restricted', message: 'FAQ storefront scope is not available on your current plan', feature_key: key });
        }
        continue;
      }
      if (key === 'faq_product_enabled') {
        if (tierState.productEnabled) { filteredData[key] = value; }
        else if (value === true) {
          return res.status(403).json({ success: false, error: 'tier_restricted', message: 'FAQ product scope is not available on your current plan', feature_key: key });
        }
        continue;
      }
      if (key === 'faq_templates_enabled') {
        if (tierState.templatesEnabled) { filteredData[key] = value; }
        else if (value === true) {
          return res.status(403).json({ success: false, error: 'tier_restricted', message: 'FAQ templates scope is not available on your current plan', feature_key: key });
        }
        continue;
      }
      // Management features
      if (key.startsWith('faq_management_')) {
        const isAllowed = tierState.managementEnabled || tierState.allowedManagementTypes.includes(key as any);
        if (isAllowed) {
          filteredData[key] = value;
        } else if (value === true) {
          return res.status(403).json({
            success: false,
            error: 'tier_restricted',
            message: `FAQ management feature '${key}' is not available on your current plan`,
            feature_key: key,
          });
        }
        continue;
      }
      // Preview features
      if (key.startsWith('faq_preview_')) {
        const isAllowed = tierState.previewEnabled || tierState.allowedPreviewTypes.includes(key as any);
        if (isAllowed) {
          filteredData[key] = value;
        } else if (value === true) {
          return res.status(403).json({
            success: false,
            error: 'tier_restricted',
            message: `FAQ preview feature '${key}' is not available on your current plan`,
            feature_key: key,
          });
        }
        continue;
      }
      // Display features — clamp to scope-specific tier gates
      if (key.startsWith('faq_display_')) {
        let isAllowed = tierState.displayEnabled || tierState.allowedDisplayTypes.includes(key as any);
        if (key === 'faq_display_storefront_accordion') {
          isAllowed = isAllowed && tierState.storefrontEnabled;
        } else if (key === 'faq_display_product_accordion') {
          isAllowed = isAllowed && tierState.productEnabled;
        }
        if (isAllowed) {
          filteredData[key] = value;
        } else if (value === true) {
          return res.status(403).json({
            success: false,
            error: 'tier_restricted',
            message: `FAQ display feature '${key}' is not available on your current plan`,
            feature_key: key,
          });
        }
        continue;
      }
      // KB / chatbot features
      if (key === 'faq_chatbot_knowledge_base' || key === 'faq_kb_coverage_metrics') {
        if (tierState.kbEnabled) {
          filteredData[key] = value;
        } else if (value === true) {
          return res.status(403).json({
            success: false,
            error: 'tier_restricted',
            message: `FAQ knowledge base feature '${key}' is not available on your current plan`,
            feature_key: key,
          });
        }
        continue;
      }
      // Inquiry-to-FAQ curation (requires faq_kb_auto_sync in tier)
      if (key === 'faq_kb_auto_sync') {
        if (tierState.kbEnabled && tierState.allowedKbTypes?.includes('faq_kb_auto_sync')) {
          filteredData[key] = value;
        } else if (value === true) {
          return res.status(403).json({
            success: false,
            error: 'tier_restricted',
            message: 'Inquiry-to-FAQ curation requires a higher tier plan',
            feature_key: key,
          });
        }
        continue;
      }
      // Unknown key — skip
    }

    // Check if settings exist
    const existing = await prisma.tenant_faq_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      settings = await prisma.tenant_faq_options_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...filteredData,
          updated_at: new Date(),
        },
      });
    } else {
      settings = await prisma.tenant_faq_options_settings.create({
        data: {
          id: `fos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tenant_id: tenantId,
          ...filteredData,
        },
      });
    }

    res.json({
      success: true,
      settings: {
        faq_enabled: settings.faq_enabled,
        faq_storefront_enabled: settings.faq_storefront_enabled,
        faq_product_enabled: settings.faq_product_enabled,
        faq_templates_enabled: settings.faq_templates_enabled,
        faq_chatbot_knowledge_base: settings.faq_chatbot_knowledge_base,
        faq_management_hub: settings.faq_management_hub,
        faq_management_templates: settings.faq_management_templates,
        faq_management_import: settings.faq_management_import,
        faq_management_bulk_actions: settings.faq_management_bulk_actions,
        faq_management_reorder: settings.faq_management_reorder,
        faq_management_search: settings.faq_management_search,
        faq_preview_bot: settings.faq_preview_bot,
        faq_preview_gap_report: settings.faq_preview_gap_report,
        faq_display_storefront_accordion: settings.faq_display_storefront_accordion,
        faq_display_product_accordion: settings.faq_display_product_accordion,
        faq_display_feedback: settings.faq_display_feedback,
        faq_display_bot_handoff: settings.faq_display_bot_handoff,
        faq_kb_coverage_metrics: settings.faq_kb_coverage_metrics,
        faq_kb_auto_sync: settings.faq_kb_auto_sync,
      },
    });
  } catch (error) {
    console.error('Error updating FAQ options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update FAQ options settings',
    });
  }
});

// Public endpoint - Get FAQ options settings for storefront
router.get('/public/tenant/:tenantId/faq-options', async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Resolve tier capabilities for tier-gate-aware merchant gate
    const faqService = FaqOptionsService.getInstance();
    const tierState = await faqService.resolveFaqOptionsState(tenantId);

    // Hard gate: if FAQ is disabled at tier level, return all-false
    if (!tierState.enabled) {
      const allOff: Record<string, boolean> = {};
      for (const key of FAQ_FEATURE_KEYS) {
        allOff[key] = false;
      }
      return res.json({
        success: true,
        settings: allOff,
        tierState,
      });
    }

    // Fetch merchant preferences from DB
    const merchantPrefs = await prisma.tenant_faq_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = merchantPrefs || DEFAULT_SETTINGS;

    // Enforce tier gates on display features only (public only needs display info)
    const publicSettings: Record<string, boolean> = {
      faq_enabled: !!rawSettings.faq_enabled && tierState.enabled,
      faq_display_storefront_accordion: (tierState.displayEnabled && tierState.storefrontEnabled) ? !!rawSettings.faq_display_storefront_accordion : false,
      faq_display_product_accordion: (tierState.displayEnabled && tierState.productEnabled) ? !!rawSettings.faq_display_product_accordion : false,
      faq_display_feedback: tierState.displayEnabled ? !!rawSettings.faq_display_feedback : false,
      faq_display_bot_handoff: tierState.displayEnabled ? !!rawSettings.faq_display_bot_handoff : false,
    };

    res.json({
      success: true,
      settings: publicSettings,
      tierState,
    });
  } catch (error) {
    console.error('Error fetching public FAQ options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch FAQ options settings',
    });
  }
});

// Get FAQ options capability state for a tenant
router.get('/:tenantId/faq-options/capability', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const faqService = FaqOptionsService.getInstance();
    const state = await faqService.resolveFaqOptionsState(tenantId);

    res.json({
      success: true,
      capability: state,
    });
  } catch (error) {
    console.error('Error resolving FAQ options capability:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve FAQ options capability',
    });
  }
});

export default router;
