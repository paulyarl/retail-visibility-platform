import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import IntegrationOptionsService from '../services/IntegrationOptionsService';

const router = Router();

// Validation schema
const integrationOptionsSettingsSchema = z.object({
  integration_enabled: z.boolean().optional(),
  integration_clover: z.boolean().optional(),
  integration_square: z.boolean().optional(),
  integration_gbp: z.boolean().optional(),
  integration_google_shopping: z.boolean().optional(),
  integration_google_merchant_center: z.boolean().optional(),
  integration_gmc_sync: z.boolean().optional(),
});

// Default settings — Google integrations on, POS off by default
const DEFAULT_SETTINGS = {
  integration_enabled: true,
  integration_clover: false,
  integration_square: false,
  integration_gbp: false,
  integration_google_shopping: true,
  integration_google_merchant_center: true,
  integration_gmc_sync: false,
};

// Get integration options settings for a tenant
router.get('/:tenantId/integration-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Resolve tier capabilities first — only block when explicitly disabled
    const integrationService = IntegrationOptionsService.getInstance();
    const capabilityState = await integrationService.resolveIntegrationOptionsState(tenantId);

    // Only return all false when the tier explicitly sets integration_disabled
    if (capabilityState.features?.integration_disabled) {
      return res.json({
        success: true,
        settings: {
          integration_enabled: false,
          integration_clover: false,
          integration_square: false,
          integration_gbp: false,
          integration_google_shopping: false,
          integration_google_merchant_center: false,
          integration_gmc_sync: false,
        },
      });
    }

    const settings = await prisma.tenant_integration_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!settings) {
      return res.json({
        success: true,
        settings: DEFAULT_SETTINGS,
      });
    }

    res.json({
      success: true,
      settings: {
        integration_enabled: settings.integration_enabled,
        integration_clover: settings.integration_clover,
        integration_square: settings.integration_square,
        integration_gbp: settings.integration_gbp,
        integration_google_shopping: settings.integration_google_shopping,
        integration_google_merchant_center: settings.integration_google_merchant_center,
        integration_gmc_sync: settings.integration_gmc_sync,
      },
    });
  } catch (error) {
    console.error('Error fetching integration options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch integration options settings',
    });
  }
});

// Update integration options settings for a tenant
router.put('/:tenantId/integration-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = integrationOptionsSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid integration options settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Resolve tier capabilities to determine which toggles are allowed
    const integrationService = IntegrationOptionsService.getInstance();
    const state = await integrationService.resolveIntegrationOptionsState(tenantId);

    // Filter out toggles that aren't allowed by tier
    const filteredData: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'integration_enabled') {
        filteredData[key] = value;
        continue;
      }
      // Only allow toggling integrations that are in the tenant's allowed types
      const integrationType = integrationService.getIntegrationTypeFromFeatureKey(key);
      if (integrationType && state.allowedTypes.includes(integrationType)) {
        filteredData[key] = value;
      } else if (integrationType && !state.allowedTypes.includes(integrationType)) {
        // Tenant tried to enable an integration not allowed by their tier
        return res.status(403).json({
          success: false,
          error: 'tier_restricted',
          message: `Integration '${integrationType}' is not available on your current plan`,
          feature_key: key,
          required_tier: integrationService.getIntegrationTypeMeta(integrationType).minTier,
        });
      }
    }

    // Check if settings exist
    const existing = await prisma.tenant_integration_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      settings = await prisma.tenant_integration_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...filteredData,
          updated_at: new Date(),
        },
      });
    } else {
      settings = await prisma.tenant_integration_settings.create({
        data: {
          id: `ios-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tenant_id: tenantId,
          ...filteredData,
        },
      });
    }

    res.json({
      success: true,
      settings: {
        integration_enabled: settings.integration_enabled,
        integration_clover: settings.integration_clover,
        integration_square: settings.integration_square,
        integration_gbp: settings.integration_gbp,
        integration_google_shopping: settings.integration_google_shopping,
        integration_google_merchant_center: settings.integration_google_merchant_center,
        integration_gmc_sync: settings.integration_gmc_sync,
      },
    });
  } catch (error) {
    console.error('Error updating integration options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update integration options settings',
    });
  }
});

// Get integration options capability state for a tenant
router.get('/:tenantId/integration-options/capability', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const integrationService = IntegrationOptionsService.getInstance();
    const state = await integrationService.resolveIntegrationOptionsState(tenantId);

    res.json({
      success: true,
      capability: state,
    });
  } catch (error) {
    console.error('Error resolving integration options capability:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve integration options capability',
    });
  }
});

export default router;
