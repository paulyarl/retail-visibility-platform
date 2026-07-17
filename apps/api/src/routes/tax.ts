/**
 * Tax Calculation API Routes
 *
 * POST /api/tax/calculate — Calculate tax for a checkout order (public, used during checkout)
 * GET  /api/tenants/:tenantId/tax-settings — Get tax settings (authenticated)
 * PUT  /api/tenants/:tenantId/tax-settings — Update tax settings (authenticated)
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import { taxService } from '../services/TaxService';
import { generateTenantCommerceSettingsId } from '../lib/id-generator';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { logger } from '../logger';

const router = Router();

// Validation schema for tax settings
const taxSettingsSchema = z.object({
  tax_enabled: z.boolean().optional(),
  tax_provider: z.enum(['stripe_tax', 'manual']).nullable().optional(),
  manual_tax_rate_percent: z.number().min(0).max(1).nullable().optional(),
  tax_shipping: z.boolean().optional(),
});

/**
 * POST /api/tax/calculate
 * Public endpoint — called during checkout after shipping address is entered
 */
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const {
      tenant_id,
      subtotal_cents,
      shipping_cents = 0,
      shipping_address,
      line_items,
      stripe_account_id,
    } = req.body;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenant_id',
        message: 'tenant_id is required',
      });
    }

    if (typeof subtotal_cents !== 'number' || subtotal_cents < 0) {
      return res.status(400).json({
        success: false,
        error: 'invalid_subtotal',
        message: 'subtotal_cents must be a non-negative number',
      });
    }

    const result = await taxService.calculateTax(
      tenant_id,
      subtotal_cents,
      shipping_cents,
      shipping_address || null,
      line_items,
      stripe_account_id
    );

    res.json({
      success: true,
      tax: {
        tax_cents: result.taxCents,
        tax_rate: result.taxRate,
        provider: result.provider,
        jurisdiction: result.jurisdiction || null,
      },
    });
  } catch (error: any) {
    logger.error('[Tax] Calculation error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'tax_calculation_failed',
      message: 'Failed to calculate tax',
    });
  }
});

/**
 * GET /api/tenants/:tenantId/tax-settings
 * Authenticated — merchant reads their tax configuration
 */
router.get('/:tenantId/tax-settings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const settings = await prisma.tenant_commerce_settings.findUnique({
      where: { tenant_id: tenantId },
      select: {
        tax_enabled: true,
        tax_provider: true,
        manual_tax_rate_percent: true,
        tax_shipping: true,
      },
    });

    res.json({
      success: true,
      settings: {
        tax_enabled: settings?.tax_enabled ?? false,
        tax_provider: settings?.tax_provider ?? null,
        manual_tax_rate_percent: settings?.manual_tax_rate_percent
          ? parseFloat(settings.manual_tax_rate_percent.toString())
          : null,
        tax_shipping: settings?.tax_shipping ?? false,
      },
    });
  } catch (error: any) {
    logger.error('[Tax] Error fetching tax settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch tax settings',
    });
  }
});

/**
 * PUT /api/tenants/:tenantId/tax-settings
 * Authenticated — merchant updates their tax configuration
 */
router.put('/:tenantId/tax-settings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const validationResult = taxSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid tax settings',
        details: validationResult.error.issues,
      });
    }

    const taxSettings = validationResult.data;

    const result = await prisma.tenant_commerce_settings.upsert({
      where: { tenant_id: tenantId },
      update: taxSettings,
      create: {
        id: generateTenantCommerceSettingsId(tenantId),
        tenant_id: tenantId,
        ...taxSettings,
      },
    });

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        tax_enabled: result.tax_enabled,
        tax_provider: result.tax_provider,
        manual_tax_rate_percent: result.manual_tax_rate_percent
          ? parseFloat(result.manual_tax_rate_percent.toString())
          : null,
        tax_shipping: result.tax_shipping,
      },
    });
  } catch (error: any) {
    logger.error('[Tax] Error updating tax settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update tax settings',
    });
  }
});

export default router;
