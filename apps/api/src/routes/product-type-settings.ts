import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { requireWritableSubscription } from '../middleware/subscription';
import { z } from 'zod';
import ProductTypeService, { ProductType } from '../services/ProductTypeService';
import { invalidateEffectiveCapabilities, resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { validateProposedChange } from '../services/resolvers';
import { generateProductTypeSettingsId } from '../lib/id-generator';

const router = Router();

// Validation schema
const productTypeSettingsSchema = z.object({
  product_types_enabled: z.boolean().optional(),
  selected_product_type: z.enum(['physical', 'digital', 'hybrid', 'service']).nullable().optional(),
  selected_product_types: z.array(z.enum(['physical', 'digital', 'hybrid', 'service'])).optional(),
});

// Default settings
const DEFAULT_SETTINGS = {
  product_types_enabled: true,
  selected_product_type: 'physical' as string | null,
  selected_product_types: ['physical'] as string[],
};

// Get product type settings for a tenant
router.get('/:tenantId/product-type', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Resolve tier capabilities for tier-gate-aware merchant gate
    const productTypeService = ProductTypeService.getInstance();
    const tierState = await productTypeService.resolveProductTypeState(tenantId);

    // Hard gate: if product types is disabled at tier level, return disabled settings
    if (!tierState.enabled) {
      return res.json({
        success: true,
        settings: {
          product_types_enabled: false,
          selected_product_type: null,
          selected_product_types: [],
        },
        tierState,
      });
    }

    // Fetch merchant preferences from DB
    const merchantPrefs = await prisma.tenant_product_types_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = merchantPrefs || DEFAULT_SETTINGS;

    // Enforce tier gates on merchant preferences:
    // - product_types_enabled: if tier hard-gate says enabled, merchant can toggle; if not, force false
    // - selected_product_type: must be in tier's allowedTypes (or null)
    // - selected_product_types: each must be in tier's allowedTypes
    const productTypesEnabled = tierState.enabled && (rawSettings.product_types_enabled !== false);
    let selectedProductType = rawSettings.selected_product_type;
    let selectedProductTypes = rawSettings.selected_product_types || [];

    // Validate selected_product_type against tier allowed types
    const allowedTypes = tierState.allowedTypes.filter((t): t is 'physical' | 'digital' | 'hybrid' | 'service' =>
      t === 'physical' || t === 'digital' || t === 'hybrid' || t === 'service'
    );
    if (selectedProductType && !allowedTypes.includes(selectedProductType as 'physical' | 'digital' | 'hybrid' | 'service')) {
      // Merchant selected a type not allowed by tier — fall back to tier type
      selectedProductType = tierState.type === 'flexible' ? null : (tierState.type !== 'none' ? tierState.type : null);
    }

    // Validate selected_product_types against tier allowed types
    selectedProductTypes = selectedProductTypes.filter(t =>
      allowedTypes.includes(t as 'physical' | 'digital' | 'hybrid' | 'service')
    );

    res.json({
      success: true,
      settings: {
        product_types_enabled: productTypesEnabled,
        selected_product_type: selectedProductType,
        selected_product_types: selectedProductTypes,
      },
      tierState,
    });
  } catch (error) {
    console.error('Error fetching product type settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch product type settings',
    });
  }
});

// Update product type settings for a tenant
router.put('/:tenantId/product-type', authenticateToken, requireTenantAdmin, requireWritableSubscription, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = productTypeSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid product type settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Resolve tier capabilities for tier-gate-aware validation
    const productTypeService = ProductTypeService.getInstance();
    const tierState = await productTypeService.resolveProductTypeState(tenantId);

    // Hard gate: if product types is disabled at tier level, block all updates
    if (!tierState.enabled) {
      return res.status(403).json({
        success: false,
        error: 'capability_disabled',
        message: 'Product types capability is disabled for this tenant\'s tier',
      });
    }

    // Type gate: validate selected_product_type against tier allowed types
    const allowedTypes = tierState.allowedTypes.filter((t): t is 'physical' | 'digital' | 'hybrid' | 'service' =>
      t === 'physical' || t === 'digital' || t === 'hybrid' || t === 'service'
    );
    if (data.selected_product_type && !allowedTypes.includes(data.selected_product_type)) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        message: `Product type '${data.selected_product_type}' is not available on your current plan`,
        allowed_types: allowedTypes,
      });
    }

    // Type gate: validate each selected_product_types entry against tier allowed types
    if (data.selected_product_types) {
      const invalid = data.selected_product_types.filter(t => !allowedTypes.includes(t));
      if (invalid.length > 0) {
        return res.status(403).json({
          success: false,
          error: 'tier_restricted',
          message: `Product type(s) '${invalid.join(', ')}' not available on your current plan`,
          allowed_types: allowedTypes,
        });
      }
    }

    // Cross-capability constraint validation (CCL write-time check, Rule R22)
    const typesToValidate = data.selected_product_types || (data.selected_product_type ? [data.selected_product_type] : []);
    if (typesToValidate.length > 0) {
      const currentCaps = await resolveEffectiveCapabilities(tenantId);
      if (currentCaps) {
        const simulated = JSON.parse(JSON.stringify(currentCaps.effective));
        simulated.product_types.effective_types = typesToValidate;
        // Backward compat: set effective_type for legacy constraints
        simulated.product_types.effective_type = typesToValidate.length === 1 ? typesToValidate[0] : 'flexible';
        const blockViolations = await validateProposedChange(simulated);
        if (blockViolations.length > 0) {
          return res.status(403).json({
            success: false,
            error: 'constraint_violation',
            message: blockViolations[0].message,
            resolution_hint: blockViolations[0].resolution_hint,
            violations: blockViolations,
          });
        }
      }
    }

    // Force product_types_enabled to false if tier doesn't allow it
    const effectiveData = {
      ...data,
      product_types_enabled: data.product_types_enabled !== undefined
        ? data.product_types_enabled && tierState.enabled
        : undefined,
    };

    // Check if settings exist
    const existing = await prisma.tenant_product_types_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      // Update existing settings
      settings = await prisma.tenant_product_types_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...effectiveData,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new settings
      settings = await prisma.tenant_product_types_settings.create({
        data: {
          id: generateProductTypeSettingsId(tenantId),
          tenant_id: tenantId,
          ...effectiveData,
        },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        product_types_enabled: settings.product_types_enabled,
        selected_product_type: settings.selected_product_type,
        selected_product_types: settings.selected_product_types,
      },
    });
  } catch (error) {
    console.error('Error updating product type settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update product type settings',
    });
  }
});

// Get product type capability state for a tenant
router.get('/:tenantId/product-type/capability', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const productTypeService = ProductTypeService.getInstance();
    const state = await productTypeService.resolveProductTypeState(tenantId);

    res.json({
      success: true,
      capability: state,
    });
  } catch (error) {
    console.error('Error resolving product type capability:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve product type capability',
    });
  }
});

// Public endpoint - Get product type settings for storefront display
// DEPRECATED: Use GET /api/tenants/:tenantId/effective-capabilities instead
router.get('/public/tenant/:tenantId/product-type', async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.warn(`[DEPRECATION] GET /public/tenant/${tenantId}/product-type is deprecated. Use /api/tenants/${tenantId}/effective-capabilities instead.`);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString());

    // Resolve tier capabilities for tier-gate-aware merchant gate
    const productTypeService = ProductTypeService.getInstance();
    const tierState = await productTypeService.resolveProductTypeState(tenantId);

    // Hard gate: if product types is disabled at tier level, return disabled settings
    if (!tierState.enabled) {
      return res.json({
        success: true,
        settings: {
          product_types_enabled: false,
          selected_product_type: null,
          selected_product_types: [],
        },
        tierState,
      });
    }

    // Fetch merchant preferences from DB
    const merchantPrefs = await prisma.tenant_product_types_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = merchantPrefs || DEFAULT_SETTINGS;

    // Enforce tier gates on merchant preferences
    const productTypesEnabled = tierState.enabled && (rawSettings.product_types_enabled !== false);
    let selectedProductType = rawSettings.selected_product_type;
    let selectedProductTypes = rawSettings.selected_product_types || [];

    // Validate selected_product_type against tier allowed types
    const allowedTypes = tierState.allowedTypes.filter((t): t is 'physical' | 'digital' | 'hybrid' | 'service' =>
      t === 'physical' || t === 'digital' || t === 'hybrid' || t === 'service'
    );
    if (selectedProductType && !allowedTypes.includes(selectedProductType as 'physical' | 'digital' | 'hybrid' | 'service')) {
      selectedProductType = tierState.type === 'flexible' ? null : (tierState.type !== 'none' ? tierState.type : null);
    }

    // Validate selected_product_types against tier allowed types
    selectedProductTypes = selectedProductTypes.filter(t =>
      allowedTypes.includes(t as 'physical' | 'digital' | 'hybrid' | 'service')
    );

    res.json({
      success: true,
      settings: {
        product_types_enabled: productTypesEnabled,
        selected_product_type: selectedProductType,
        selected_product_types: selectedProductTypes,
      },
      tierState,
    });
  } catch (error) {
    console.error('Error fetching public product type settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch product type settings',
    });
  }
});

// Public endpoint - Get product type capability state for storefront display
// DEPRECATED: Use GET /api/tenants/:tenantId/effective-capabilities instead
router.get('/public/tenant/:tenantId/product-type/capability', async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.warn(`[DEPRECATION] GET /public/tenant/${tenantId}/product-type/capability is deprecated. Use /api/tenants/${tenantId}/effective-capabilities instead.`);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString());

    const productTypeService = ProductTypeService.getInstance();
    const state = await productTypeService.resolveProductTypeState(tenantId);

    res.json({
      success: true,
      capability: state,
    });
  } catch (error) {
    console.error('Error resolving public product type capability:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve product type capability',
    });
  }
});

export default router;
