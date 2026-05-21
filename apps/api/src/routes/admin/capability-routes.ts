/**
 * Admin Capability Management API Routes
 * 
 * API endpoints for managing tier capabilities and features
 */

import { Router } from 'express';
import { prisma } from '../../prisma';

const router = Router();

/**
 * GET /api/admin/capabilities
 * Get all capabilities overview for admin management
 */
router.get('/capabilities', async (req, res) => {
  try {
    // Fetch all active tiers with their capability types and feature counts
    const tiers = await prisma.subscription_tiers_list.findMany({
      where: { is_active: true },
      select: {
        tier_key: true,
        name: true,
        sort_order: true,
        tier_features_list: {
          where: { is_enabled: true },
          select: {
            capability_type_list: { select: { key: true, name: true, category: true } },
          },
        },
      },
      orderBy: { sort_order: 'asc' },
    });

    // Group by capability type across tiers
    const capabilities: Record<string, {
      capability_type_key: string;
      capability_type_name: string;
      category: string;
      tiers: any[];
    }> = {};

    for (const tier of tiers) {
      for (const tf of tier.tier_features_list) {
        const capKey = tf.capability_type_list?.key;
        if (!capKey) continue;

        if (!capabilities[capKey]) {
          capabilities[capKey] = {
            capability_type_key: capKey,
            capability_type_name: tf.capability_type_list?.name || capKey,
            category: tf.capability_type_list?.category || 'uncategorized',
            tiers: [],
          };
        }

        const existing = capabilities[capKey].tiers.find(t => t.tier_key === tier.tier_key);
        if (!existing) {
          capabilities[capKey].tiers.push({
            tier_key: tier.tier_key,
            tier_name: tier.name,
            feature_count: tier.tier_features_list.filter(
              f => f.capability_type_list?.key === capKey
            ).length,
          });
        }
      }
    }

    const result = Object.values(capabilities).map(cap => ({
      capability_type_key: cap.capability_type_key,
      capability_type_name: cap.capability_type_name,
      category: cap.category,
      tiers: cap.tiers,
      total_features: cap.tiers.reduce((sum: number, t: any) => sum + t.feature_count, 0),
    }));

    res.json(result);
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

    const tier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: tierKey },
      include: {
        tier_features_list: {
          where: { is_enabled: true },
          include: {
            capability_type_list: { select: { key: true, name: true, category: true } },
          },
          orderBy: { capability_type_id: 'asc' },
        },
      },
    });

    if (!tier) {
      return res.status(404).json({ error: 'Tier not found' });
    }

    // Group features by capability type
    const grouped: Record<string, {
      tier_key: string;
      tier_name: string;
      capability_type_key: string;
      capability_type_name: string;
      capability_category: string;
      capability_enabled: boolean;
      is_highlighted: boolean;
      highlight_order: number;
      capability_marketing_name: string;
      features: any[];
      total_features: number;
    }> = {};

    for (const tf of tier.tier_features_list) {
      const capKey = tf.capability_type_list?.key || 'uncategorized';

      if (!grouped[capKey]) {
        grouped[capKey] = {
          tier_key: tierKey,
          tier_name: tier.name,
          capability_type_key: capKey,
          capability_type_name: tf.capability_type_list?.name || capKey,
          capability_category: tf.capability_type_list?.category || 'uncategorized',
          capability_enabled: true,
          is_highlighted: false,
          highlight_order: tf.highlight_order || 0,
          capability_marketing_name: tf.marketing_name || tf.capability_type_list?.name || capKey,
          features: [],
          total_features: 0,
        };
      }

      grouped[capKey].features.push({
        feature_key: tf.feature_key,
        feature_name: tf.feature_name || tf.feature_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        is_enabled: tf.is_enabled,
        is_highlighted: tf.is_highlighted,
        marketing_name: tf.marketing_name,
      });

      if (tf.is_highlighted) {
        grouped[capKey].is_highlighted = true;
      }
      grouped[capKey].total_features++;
    }

    res.json(Object.values(grouped));
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
