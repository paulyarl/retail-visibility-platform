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
import { z } from 'zod';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';

const router = Router();

const wholesaleMatchingSettingsSchema = z.object({
  wholesale_matching_enabled: z.boolean().optional(),
});

// GET /:tenantId/wholesale-matching-options
router.get('/:tenantId/wholesale-matching-options', authenticateToken, async (req, res) => {
  try {
    // No merchant settings table yet — return defaults
    res.json({
      success: true,
      settings: {
        wholesale_matching_enabled: true,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get settings',
    });
  }
});

// PUT /:tenantId/wholesale-matching-options
router.put('/:tenantId/wholesale-matching-options', authenticateToken, requireTenantAdmin, async (req, res) => {
  try {
    const parsed = wholesaleMatchingSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    // No merchant settings table yet — settings are tier-gated only
    // When a table is added, upsert here
    await invalidateEffectiveCapabilities(req.params.tenantId);

    res.json({
      success: true,
      settings: parsed.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update settings',
    });
  }
});

export default router;
