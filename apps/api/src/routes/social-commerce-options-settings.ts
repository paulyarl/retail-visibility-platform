import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';

const router = Router();

// Validation schema
const socialCommerceOptionsSettingsSchema = z.object({
  social_commerce_enabled: z.boolean().optional(),
  social_commerce_meta_enabled: z.boolean().optional(),
  social_commerce_meta_catalog: z.boolean().optional(),
  social_commerce_meta_shop: z.boolean().optional(),
  social_commerce_meta_pixel: z.boolean().optional(),
  social_commerce_tiktok_enabled: z.boolean().optional(),
  social_commerce_tiktok_catalog: z.boolean().optional(),
  social_commerce_tiktok_shop: z.boolean().optional(),
  social_commerce_tiktok_pixel: z.boolean().optional(),
  social_commerce_share_buttons: z.boolean().optional(),
  social_commerce_social_proof: z.boolean().optional(),
  social_commerce_abandoned_cart: z.boolean().optional(),
});

// Default settings — master on, all integrations off (opt-in)
const DEFAULT_SETTINGS = {
  social_commerce_enabled: true,
  social_commerce_meta_enabled: false,
  social_commerce_meta_catalog: false,
  social_commerce_meta_shop: false,
  social_commerce_meta_pixel: false,
  social_commerce_tiktok_enabled: false,
  social_commerce_tiktok_catalog: false,
  social_commerce_tiktok_shop: false,
  social_commerce_tiktok_pixel: false,
  social_commerce_share_buttons: false,
  social_commerce_social_proof: false,
  social_commerce_abandoned_cart: false,
};

const SOCIAL_COMMERCE_FEATURE_KEYS = [
  'social_commerce_enabled',
  'social_commerce_meta_enabled',
  'social_commerce_meta_catalog',
  'social_commerce_meta_shop',
  'social_commerce_meta_pixel',
  'social_commerce_tiktok_enabled',
  'social_commerce_tiktok_catalog',
  'social_commerce_tiktok_shop',
  'social_commerce_tiktok_pixel',
  'social_commerce_share_buttons',
  'social_commerce_social_proof',
  'social_commerce_abandoned_cart',
] as const;

// TIER_GATE_MAP: maps merchant toggle to tier feature keys that unlock it
const TIER_GATE_MAP: Record<string, string[]> = {
  social_commerce_meta_enabled: ['social_commerce_meta_enabled', 'social_commerce_flexible'],
  social_commerce_meta_catalog: ['social_commerce_meta_catalog', 'social_commerce_meta_enabled', 'social_commerce_flexible'],
  social_commerce_meta_shop: ['social_commerce_meta_shop', 'social_commerce_meta_enabled', 'social_commerce_flexible'],
  social_commerce_meta_pixel: ['social_commerce_meta_pixel', 'social_commerce_meta_enabled', 'social_commerce_flexible'],
  social_commerce_tiktok_enabled: ['social_commerce_tiktok_enabled', 'social_commerce_flexible'],
  social_commerce_tiktok_catalog: ['social_commerce_tiktok_catalog', 'social_commerce_tiktok_enabled', 'social_commerce_flexible'],
  social_commerce_tiktok_shop: ['social_commerce_tiktok_shop', 'social_commerce_tiktok_enabled', 'social_commerce_flexible'],
  social_commerce_tiktok_pixel: ['social_commerce_tiktok_pixel', 'social_commerce_tiktok_enabled', 'social_commerce_flexible'],
  social_commerce_share_buttons: ['social_commerce_share_buttons', 'social_commerce_flexible'],
  social_commerce_social_proof: ['social_commerce_social_proof', 'social_commerce_flexible'],
  social_commerce_abandoned_cart: ['social_commerce_abandoned_cart', 'social_commerce_flexible'],
};

// Get social commerce options settings for a tenant
router.get('/:tenantId/social-commerce-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const caps = await resolveEffectiveCapabilities(tenantId, { detail: 'summary' });
    const tierState = caps?.effective.social_commerce_options;

    if (!tierState || !tierState.enabled) {
      const allOff: Record<string, boolean> = {};
      for (const key of SOCIAL_COMMERCE_FEATURE_KEYS) { allOff[key] = false; }
      return res.json({ success: true, settings: allOff, tierState: tierState || { enabled: false, is_flexible: false } });
    }

    const merchantPrefs = await prisma.tenant_social_commerce_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = merchantPrefs || DEFAULT_SETTINGS;

    // Tier-filter settings
    const tierFilteredSettings: Record<string, boolean> = {
      social_commerce_enabled: !!rawSettings.social_commerce_enabled && tierState.enabled,
    };

    for (const key of SOCIAL_COMMERCE_FEATURE_KEYS) {
      if (key === 'social_commerce_enabled') continue;
      const gateKeys = TIER_GATE_MAP[key] || [];
      const isAllowed = tierState.is_flexible ||
        gateKeys.some(gk => (tierState as any)[gk] === true) ||
        tierState.allowed_meta_types.includes(key as any) ||
        tierState.allowed_tiktok_types.includes(key as any) ||
        tierState.allowed_experience_types.includes(key as any);
      tierFilteredSettings[key] = isAllowed ? !!(rawSettings as any)[key] : false;
    }

    res.json({ success: true, settings: tierFilteredSettings, tierState });
  } catch (error) {
    console.error('Error fetching social commerce options settings:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch social commerce options settings' });
  }
});

// Update social commerce options settings for a tenant
router.put('/:tenantId/social-commerce-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const validationResult = socialCommerceOptionsSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid social commerce options settings data', details: validationResult.error.issues });
    }

    const data = validationResult.data;

    const caps = await resolveEffectiveCapabilities(tenantId, { detail: 'summary' });
    const tierState = caps?.effective.social_commerce_options;

    if (!tierState || !tierState.enabled) {
      return res.status(403).json({ success: false, error: 'capability_disabled', message: 'Social commerce options capability is disabled for this tenant\'s tier' });
    }

    const filteredData: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'social_commerce_enabled') { filteredData[key] = value; continue; }

      const gateKeys = TIER_GATE_MAP[key] || [];
      const isAllowed = tierState.is_flexible ||
        gateKeys.some(gk => (tierState as any)[gk] === true) ||
        tierState.allowed_meta_types.includes(key as any) ||
        tierState.allowed_tiktok_types.includes(key as any) ||
        tierState.allowed_experience_types.includes(key as any);

      if (isAllowed) {
        filteredData[key] = value;
      } else if (value === true) {
        return res.status(403).json({ success: false, error: 'tier_restricted', message: `Feature '${key}' is not available on your current plan`, feature_key: key });
      }
    }

    const existing = await prisma.tenant_social_commerce_options_settings.findUnique({ where: { tenant_id: tenantId } });
    let settings;
    if (existing) {
      settings = await prisma.tenant_social_commerce_options_settings.update({
        where: { tenant_id: tenantId },
        data: { ...filteredData, updated_at: new Date() },
      });
    } else {
      settings = await prisma.tenant_social_commerce_options_settings.create({
        data: { id: `sco-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, tenant_id: tenantId, ...filteredData },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        social_commerce_enabled: settings.social_commerce_enabled,
        social_commerce_meta_enabled: settings.social_commerce_meta_enabled,
        social_commerce_meta_catalog: settings.social_commerce_meta_catalog,
        social_commerce_meta_shop: settings.social_commerce_meta_shop,
        social_commerce_meta_pixel: settings.social_commerce_meta_pixel,
        social_commerce_tiktok_enabled: settings.social_commerce_tiktok_enabled,
        social_commerce_tiktok_catalog: settings.social_commerce_tiktok_catalog,
        social_commerce_tiktok_shop: settings.social_commerce_tiktok_shop,
        social_commerce_tiktok_pixel: settings.social_commerce_tiktok_pixel,
        social_commerce_share_buttons: settings.social_commerce_share_buttons,
        social_commerce_social_proof: settings.social_commerce_social_proof,
        social_commerce_abandoned_cart: settings.social_commerce_abandoned_cart,
      },
    });
  } catch (error) {
    console.error('Error updating social commerce options settings:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to update social commerce options settings' });
  }
});

// Get social commerce options capability state for a tenant
router.get('/:tenantId/social-commerce-options/capability', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const caps = await resolveEffectiveCapabilities(tenantId, { detail: 'summary' });
    const state = caps?.effective.social_commerce_options;
    if (!state) {
      return res.json({ success: false, error: 'capability_not_found' });
    }
    res.json({ success: true, capability: state });
  } catch (error) {
    console.error('Error resolving social commerce options capability:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to resolve social commerce options capability' });
  }
});

export default router;
