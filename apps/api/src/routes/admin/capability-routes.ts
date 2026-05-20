/**
 * Admin Capability Management API Routes
 * 
 * API endpoints for managing tier capabilities and features
 */

import { Router } from 'express';
import { CapabilityGatingService } from '@platform/feature-definitions';

const router = Router();

/**
 * GET /api/admin/capabilities
 * Get all capabilities overview for admin management
 */
router.get('/capabilities', async (req, res) => {
  try {
    // Use CapabilityGatingService to get real data
    const tiers = ['discovery', 'storefront', 'professional', 'enterprise'];
    const capabilities = [];
    
    for (const tierKey of tiers) {
      const capabilityResult = await CapabilityGatingService.checkProductTypeCapability(tierKey);
      capabilities.push({
        capability_type_key: `${tierKey}_product_type`,
        capability_type_name: `${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} Product Types`,
        category: 'product_types',
        tier_key: tierKey,
        tier_name: tierKey.charAt(0).toUpperCase() + tierKey.slice(1),
        description: `${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} product types for ${tierKey} tier`,
        capability_sort_order: tiers.indexOf(tierKey) + 1,
        tier_sort_order: tiers.indexOf(tierKey) + 1,
        feature_count: capabilityResult.availableProductTypes.length,
        features_in_capability: capabilityResult.availableProductTypes.join(', ')
      });
    }
    
    res.json(capabilities);
  } catch (error) {
    console.error('Error fetching capabilities:', error);
    res.status(500).json({ error: 'Failed to fetch capabilities' });
  }
});

/**
 * GET /api/admin/tiers/:tierKey/capabilities
 * Get detailed capabilities for a specific tier
 */
router.get('/tiers/:tierKey/capabilities', async (req, res) => {
  try {
    const { tierKey } = req.params;
    
    // Use CapabilityGatingService to get real data
    const capabilityResult = await CapabilityGatingService.checkProductTypeCapability(tierKey);
    
    const tierCapability = {
      tier_key: tierKey,
      tier_name: tierKey.charAt(0).toUpperCase() + tierKey.slice(1),
      capability_type_key: `${tierKey}_product_type`,
      capability_type_name: `${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} Product Types`,
      capability_category: 'product_types',
      capability_enabled: true,
      is_highlighted: true,
      highlight_order: 1,
      capability_marketing_name: capabilityResult.marketingName || `${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} Product Types`,
      tier_specific_restrictions: capabilityResult.restrictions,
      features: capabilityResult.availableProductTypes.map((featureKey: string) => ({
        feature_key: featureKey,
        feature_name: featureKey.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        is_enabled: true,
        effective_restrictions: capabilityResult.maxItems ? { max_items: capabilityResult.maxItems } : undefined
      })),
      total_features: capabilityResult.availableProductTypes.length
    };
    
    res.json([tierCapability]);
  } catch (error) {
    console.error('Error fetching tier capabilities:', error);
    res.status(500).json({ error: 'Failed to fetch tier capabilities' });
  }
});

/**
 * PUT /api/admin/tiers/:tierKey/capabilities
 * Update capabilities for a specific tier
 */
router.put('/tiers/:tierKey/capabilities', async (req, res) => {
  try {
    const { tierKey } = req.params;
    const capabilities = req.body;
    
    // TODO: Update database
    // 1. Update tier_features_list records
    // 2. Update capability_features_list records for restrictions
    // 3. Update metadata JSONB with new restrictions
    
    console.log(`Updating capabilities for tier ${tierKey}:`, capabilities);
    
    // Mock success response
    res.json({ 
      success: true, 
      message: `Capabilities updated for ${tierKey}`,
      updatedCapabilities: capabilities
    });
  } catch (error) {
    console.error('Error updating tier capabilities:', error);
    res.status(500).json({ error: 'Failed to update tier capabilities' });
  }
});

/**
 * GET /api/admin/features
 * Get all available features for capability assignment
 */
router.get('/features', async (req, res) => {
  try {
    // TODO: Query from features_list
    // const query = `
    //   SELECT id, key, name, description, category, marketing_name, icon_name, sort_order
    //   FROM features_list
    //   WHERE is_active = true
    //   ORDER BY category, sort_order
    // `;
    
    // Mock data
    const features = [
      {
        id: 'physical_product_id',
        key: 'physical_product',
        name: 'Physical Product',
        description: 'Create tangible goods with inventory management',
        category: 'product_types',
        marketing_name: 'Physical Products',
        icon_name: 'package',
        sort_order: 1
      },
      {
        id: 'digital_product_id',
        key: 'digital_product',
        name: 'Digital Product',
        description: 'Create downloadable products and digital content',
        category: 'product_types',
        marketing_name: 'Digital Products',
        icon_name: 'download',
        sort_order: 2
      },
      {
        id: 'hybrid_product_id',
        key: 'hybrid_product',
        name: 'Hybrid Product',
        description: 'Create products with both physical and digital components',
        category: 'product_types',
        marketing_name: 'Hybrid Products',
        icon_name: 'layers',
        sort_order: 3
      },
      {
        id: 'custom_product_id',
        key: 'custom_product',
        name: 'Custom Product',
        description: 'Create products with custom attributes and configurations',
        category: 'product_types',
        marketing_name: 'Custom Products',
        icon_name: 'settings',
        sort_order: 4
      },
      {
        id: 'service_product_id',
        key: 'service_product',
        name: 'Service Product',
        description: 'Create service-based offerings and appointments',
        category: 'product_types',
        marketing_name: 'Service Products',
        icon_name: 'calendar',
        sort_order: 5
      },
      {
        id: 'subscription_product_id',
        key: 'subscription_product',
        name: 'Subscription Product',
        description: 'Create recurring subscription products',
        category: 'product_types',
        marketing_name: 'Subscription Products',
        icon_name: 'repeat',
        sort_order: 6
      }
    ];
    
    res.json(features);
  } catch (error) {
    console.error('Error fetching features:', error);
    res.status(500).json({ error: 'Failed to fetch features' });
  }
});

// Helper functions for mock data
function getMockFeaturesForTier(tierKey: string) {
  const baseFeatures = [
    {
      feature_key: 'physical_product',
      feature_name: 'Physical Product',
      is_enabled: true,
      effective_restrictions: { max_items: tierKey === 'discovery' ? 10 : tierKey === 'storefront' ? 100 : tierKey === 'professional' ? 1000 : null }
    },
    {
      feature_key: 'digital_product',
      feature_name: 'Digital Product',
      is_enabled: ['storefront', 'professional', 'enterprise'].includes(tierKey),
      effective_restrictions: { max_items: tierKey === 'storefront' ? 100 : tierKey === 'professional' ? 1000 : null }
    },
    {
      feature_key: 'hybrid_product',
      feature_name: 'Hybrid Product',
      is_enabled: ['professional', 'enterprise'].includes(tierKey),
      effective_restrictions: { max_items: tierKey === 'professional' ? 1000 : null }
    },
    {
      feature_key: 'custom_product',
      feature_name: 'Custom Product',
      is_enabled: ['professional', 'enterprise'].includes(tierKey),
      effective_restrictions: { max_items: tierKey === 'professional' ? 1000 : null }
    }
  ];

  if (tierKey === 'enterprise') {
    baseFeatures.push(
      {
        feature_key: 'service_product',
        feature_name: 'Service Product',
        is_enabled: true,
        effective_restrictions: { max_items: null }
      },
      {
        feature_key: 'subscription_product',
        feature_name: 'Subscription Product',
        is_enabled: true,
        effective_restrictions: { max_items: null }
      }
    );
  }

  return baseFeatures;
}

function getTotalFeaturesForTier(tierKey: string): number {
  switch (tierKey) {
    case 'discovery':
    case 'starter':
      return 1;
    case 'storefront':
      return 2;
    case 'professional':
      return 4;
    case 'enterprise':
      return 6;
    default:
      return 1;
  }
}

export default router;
