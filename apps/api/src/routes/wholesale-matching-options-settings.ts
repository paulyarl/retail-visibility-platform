/**
 * Wholesale Matching Options Settings Routes
 *
 * GET /:tenantId/wholesale-matching-options — get capability settings
 * PUT /:tenantId/wholesale-matching-options — update settings
 *
 * Tier-gated (not preference-gated), but merchant can soft-toggle.
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { requireWritableSubscription } from '../middleware/subscription';
import { z } from 'zod';
import { prisma } from '../prisma';
import { invalidateEffectiveCapabilities, resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';

const router = Router();

const wholesaleMatchingSettingsSchema = z.object({
  wholesale_matching_enabled: z.boolean().optional(),
});

// GET /:tenantId/wholesale-matching-options
router.get('/:tenantId/wholesale-matching-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Resolve tier-gated state
    const caps = await resolveEffectiveCapabilities(tenantId);
    const tierState = caps?.effective?.wholesale_matching ?? { enabled: false, tier: 'none', can_check_supplier_match: false, can_search_faire: false, can_build_affiliate_link: false, can_view_brand_partners: false, is_flexible: false };

    // Fetch merchant settings (or defaults if no row yet)
    const settings = await prisma.tenant_wholesale_matching_settings.findUnique({
      where: { tenant_id: tenantId },
    }).catch(() => null);

    res.json({
      success: true,
      settings: {
        wholesale_matching_enabled: settings?.wholesale_matching_enabled ?? true,
      },
      tierState,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get settings',
    });
  }
});

// PUT /:tenantId/wholesale-matching-options
router.put('/:tenantId/wholesale-matching-options', authenticateToken, requireTenantAdmin, requireWritableSubscription, async (req, res) => {
  try {
    const parsed = wholesaleMatchingSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    // Upsert merchant settings
    const { tenantId } = req.params;
    const settings = await prisma.tenant_wholesale_matching_settings.upsert({
      where: { tenant_id: tenantId },
      update: {
        wholesale_matching_enabled: parsed.data.wholesale_matching_enabled ?? true,
      },
      create: {
        tenant_id: tenantId,
        wholesale_matching_enabled: parsed.data.wholesale_matching_enabled ?? true,
      },
    }).catch((err) => {
      console.error('[PUT wholesale-matching-options] Failed to upsert settings:', err);
      return null;
    });

    await invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        wholesale_matching_enabled: settings?.wholesale_matching_enabled ?? parsed.data.wholesale_matching_enabled ?? true,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update settings',
    });
  }
});

export default router;
