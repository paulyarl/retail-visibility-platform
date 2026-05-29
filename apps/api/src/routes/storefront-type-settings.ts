import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import StorefrontTypeService, { StorefrontType } from '../services/StorefrontTypeService';

const router = Router();

// Validation schema
const storefrontTypeSettingsSchema = z.object({
  storefront_type_enabled: z.boolean().optional(),
  selected_storefront_type: z.enum(['online', 'retail', 'service', 'both']).nullable().optional(),
});

// Default settings (selected_storefront_type is null so frontend derives from tier type)
const DEFAULT_SETTINGS = {
  storefront_type_enabled: true,
  selected_storefront_type: null as string | null,
};


// Get storefront type settings for a tenant
router.get('/:tenantId/storefront-type', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Resolve tier capabilities for tier-gate-aware merchant gate
    const storefrontService = StorefrontTypeService.getInstance();
    const tierState = await storefrontService.resolveStorefrontTypeState(tenantId);

    // Hard gate: if storefront is disabled at tier level, return disabled settings
    if (!tierState.enabled) {
      return res.json({
        success: true,
        settings: {
          storefront_type_enabled: false,
          selected_storefront_type: null,
        },
        tierState,
      });
    }

    // Fetch merchant preferences from DB
    const merchantPrefs = await prisma.tenant_storefront_type_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = merchantPrefs || DEFAULT_SETTINGS;

    // Enforce tier gates on merchant preferences:
    // - storefront_type_enabled: if tier hard-gate says enabled, merchant can toggle; if not, force false
    // - selected_storefront_type: must be in tier's allowedTypes (or null)
    const storefrontTypeEnabled = tierState.enabled && rawSettings.storefront_type_enabled;
    let selectedStorefrontType = rawSettings.selected_storefront_type;

    // Validate selected_storefront_type against tier allowed types
    if (selectedStorefrontType && !tierState.allowedTypes.includes(selectedStorefrontType as StorefrontType)) {
      // Merchant selected a type not allowed by tier — fall back to tier type
      selectedStorefrontType = tierState.type === 'both' ? null : (tierState.type !== 'none' ? tierState.type : null);
    }

    res.json({
      success: true,
      settings: {
        storefront_type_enabled: storefrontTypeEnabled,
        selected_storefront_type: selectedStorefrontType,
      },
      tierState,
    });
  } catch (error) {
    console.error('Error fetching storefront type settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch storefront type settings',
    });
  }
});

// Update storefront type settings for a tenant
router.put('/:tenantId/storefront-type', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = storefrontTypeSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid storefront type settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Resolve tier capabilities for tier-gate-aware validation
    const storefrontService = StorefrontTypeService.getInstance();
    const tierState = await storefrontService.resolveStorefrontTypeState(tenantId);

    // Hard gate: if storefront is disabled at tier level, block all updates
    if (!tierState.enabled) {
      return res.status(403).json({
        success: false,
        error: 'capability_disabled',
        message: 'Storefront capability is disabled for this tenant\'s tier',
      });
    }

    // Type gate: validate selected_storefront_type against tier allowed types
    if (data.selected_storefront_type && !tierState.allowedTypes.includes(data.selected_storefront_type)) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        message: `Storefront type '${data.selected_storefront_type}' is not available on your current plan`,
        allowed_types: tierState.allowedTypes,
      });
    }

    // Force storefront_type_enabled to false if tier doesn't allow it
    const effectiveData = {
      ...data,
      storefront_type_enabled: data.storefront_type_enabled !== undefined
        ? data.storefront_type_enabled && tierState.enabled
        : undefined,
    };

    // Check if settings exist
    const existing = await prisma.tenant_storefront_type_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      // Update existing settings
      settings = await prisma.tenant_storefront_type_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...effectiveData,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new settings
      settings = await prisma.tenant_storefront_type_settings.create({
        data: {
          tenant_id: tenantId,
          ...effectiveData,
        },
      });
    }

    res.json({
      success: true,
      settings: {
        storefront_type_enabled: settings.storefront_type_enabled,
        selected_storefront_type: settings.selected_storefront_type,
      },
    });
  } catch (error) {
    console.error('Error updating storefront type settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update storefront type settings',
    });
  }
});

// Get storefront type capability state for a tenant
router.get('/:tenantId/storefront-type/capability', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const storefrontService = StorefrontTypeService.getInstance();
    const state = await storefrontService.resolveStorefrontTypeState(tenantId);

    res.json({
      success: true,
      capability: state,
    });
  } catch (error) {
    console.error('Error resolving storefront type capability:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve storefront type capability',
    });
  }
});

export default router;
