import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import FeaturedOptionsService, { FeaturedType } from '../services/FeaturedOptionsService';

const router = Router();

// Validation schema
const featuredOptionsSettingsSchema = z.object({
  featured_enabled: z.boolean().optional(),
  featured_store_selection: z.boolean().optional(),
  featured_new_arrival: z.boolean().optional(),
  featured_seasonal: z.boolean().optional(),
  featured_sale: z.boolean().optional(),
  featured_staff_pick: z.boolean().optional(),
  featured_clearance: z.boolean().optional(),
  featured_featured: z.boolean().optional(),
  featured_bestseller: z.boolean().optional(),
  featured_trending: z.boolean().optional(),
  featured_recommended: z.boolean().optional(),
  featured_random_featured: z.boolean().optional(),
});

// Default settings — tenant types on, platform types off by default
const DEFAULT_SETTINGS = {
  featured_enabled: true,
  featured_store_selection: true,
  featured_new_arrival: true,
  featured_seasonal: true,
  featured_sale: true,
  featured_staff_pick: true,
  featured_clearance: true,
  featured_featured: true,
  featured_bestseller: false,
  featured_trending: false,
  featured_recommended: false,
  featured_random_featured: false,
};

// Map feature key (DB column) to FeaturedType
const FEATURE_KEY_TO_TYPE: Record<string, FeaturedType> = {
  featured_store_selection: 'store_selection',
  featured_new_arrival: 'new_arrival',
  featured_seasonal: 'seasonal',
  featured_sale: 'sale',
  featured_staff_pick: 'staff_pick',
  featured_clearance: 'clearance',
  featured_featured: 'featured',
  featured_bestseller: 'bestseller',
  featured_trending: 'trending',
  featured_recommended: 'recommended',
  featured_random_featured: 'random_featured',
};

// Get featured options settings for a tenant
router.get('/:tenantId/featured-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Resolve tier capabilities for tier-gate-aware merchant gate
    const featuredService = FeaturedOptionsService.getInstance();
    const tierState = await featuredService.resolveFeaturedOptionsState(tenantId);

    // Hard gate: if featured is disabled at tier level, return all-false
    if (!tierState.enabled) {
      return res.json({
        success: true,
        settings: {
          featured_enabled: false,
          featured_store_selection: false,
          featured_new_arrival: false,
          featured_seasonal: false,
          featured_sale: false,
          featured_staff_pick: false,
          featured_clearance: false,
          featured_featured: false,
          featured_bestseller: false,
          featured_trending: false,
          featured_recommended: false,
          featured_random_featured: false,
        },
        tierState,
      });
    }

    // Fetch merchant preferences from DB
    const merchantPrefs = await prisma.tenant_featured_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = merchantPrefs || DEFAULT_SETTINGS;

    // Enforce tier gates: force off any feature not in tier's allowedTypes
    const tierFilteredSettings: Record<string, boolean> = {
      featured_enabled: !!rawSettings.featured_enabled && tierState.enabled,
    };
    for (const [key, type] of Object.entries(FEATURE_KEY_TO_TYPE)) {
      const isAllowed = tierState.allowedTypes.includes(type);
      tierFilteredSettings[key] = isAllowed ? !!(rawSettings as any)[key] : false;
    }

    res.json({
      success: true,
      settings: tierFilteredSettings,
      tierState,
    });
  } catch (error) {
    console.error('Error fetching featured options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch featured options settings',
    });
  }
});

// Update featured options settings for a tenant
router.put('/:tenantId/featured-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = featuredOptionsSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid featured options settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Resolve tier capabilities for tier-gate-aware validation
    const featuredService = FeaturedOptionsService.getInstance();
    const tierState = await featuredService.resolveFeaturedOptionsState(tenantId);

    // Hard gate: if featured is disabled at tier level, block all updates
    if (!tierState.enabled) {
      return res.status(403).json({
        success: false,
        error: 'capability_disabled',
        message: 'Featured options capability is disabled for this tenant\'s tier',
      });
    }

    // Type gate: validate each feature toggle against tier allowed types
    const filteredData: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'featured_enabled') {
        filteredData[key] = value;
        continue;
      }
      const type = FEATURE_KEY_TO_TYPE[key];
      if (type && tierState.allowedTypes.includes(type)) {
        filteredData[key] = value;
      } else if (type && !tierState.allowedTypes.includes(type)) {
        return res.status(403).json({
          success: false,
          error: 'tier_restricted',
          message: `Featured type '${type}' is not available on your current plan`,
          feature_key: key,
        });
      }
    }

    // Check if settings exist
    const existing = await prisma.tenant_featured_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      // Update existing settings
      settings = await prisma.tenant_featured_options_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...filteredData,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new settings
      settings = await prisma.tenant_featured_options_settings.create({
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
        featured_enabled: settings.featured_enabled,
        featured_store_selection: settings.featured_store_selection,
        featured_new_arrival: settings.featured_new_arrival,
        featured_seasonal: settings.featured_seasonal,
        featured_sale: settings.featured_sale,
        featured_staff_pick: settings.featured_staff_pick,
        featured_clearance: settings.featured_clearance,
        featured_featured: settings.featured_featured,
        featured_bestseller: settings.featured_bestseller,
        featured_trending: settings.featured_trending,
        featured_recommended: settings.featured_recommended,
        featured_random_featured: settings.featured_random_featured,
      },
    });
  } catch (error) {
    console.error('Error updating featured options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update featured options settings',
    });
  }
});

// Get featured options capability state for a tenant
router.get('/:tenantId/featured-options/capability', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const featuredService = FeaturedOptionsService.getInstance();
    const state = await featuredService.resolveFeaturedOptionsState(tenantId);

    res.json({
      success: true,
      capability: state,
    });
  } catch (error) {
    console.error('Error resolving featured options capability:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve featured options capability',
    });
  }
});

export default router;
