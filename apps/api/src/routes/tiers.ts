import { Router } from 'express';
import { prisma } from '../prisma';
import { logger } from '../logger';

const router = Router();

/**
 * GET /api/tiers/validate
 * Validate if a tenant has access to a specific feature
 */
router.get('/validate', async (req, res) => {
  try {
    const { tenantId, feature, action } = req.query;
    
    if (!tenantId || !feature) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Tenant ID and feature are required'
      });
    }
    
    // Get tenant with tier information
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId as string }
    });
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Tenant not found'
      });
    }
    
    // Define feature access by tier
    const tierFeatures = {
      'google-only': ['basic_shops', 'directory_listing'],
      'starter': ['basic_shops', 'directory_listing', 'featured_shops', 'analytics'],
      'professional': ['basic_shops', 'directory_listing', 'featured_shops', 'analytics', 'advanced_search', 'branding'],
      'enterprise': ['basic_shops', 'directory_listing', 'featured_shops', 'analytics', 'advanced_search', 'branding', 'api_access', 'white_label'],
      'organization': ['basic_shops', 'directory_listing', 'featured_shops', 'analytics', 'advanced_search', 'branding', 'api_access', 'white_label', 'multi_tenant']
    };
    
    const tierName = (tenant.subscription_tier as string)?.toLowerCase() || 'google-only';
    const availableFeatures = tierFeatures[tierName as keyof typeof tierFeatures] || [];
    
    const hasAccess = availableFeatures.includes(feature as string);
    
    // Check usage limits
    let usageInfo = null;
    if (hasAccess) {
      // Get current usage for the tenant
      const shopCount = await prisma.inventory_items.count({
        where: { tenant_id: tenantId as string }
      });
      
      const tierLimits = {
        'google-only': { maxShops: 250, maxProducts: 1000 },
        'starter': { maxShops: 500, maxProducts: 5000 },
        'professional': { maxShops: 5000, maxProducts: 50000 },
        'enterprise': { maxShops: Infinity, maxProducts: Infinity },
        'organization': { maxShops: Infinity, maxProducts: Infinity }
      };
      
      const limits = tierLimits[tierName as keyof typeof tierLimits] || tierLimits['google-only'];
      
      usageInfo = {
        current: {
          shops: shopCount,
          products: shopCount // Simplified, should be separate count
        },
        limits: {
          shops: limits.maxShops,
          products: limits.maxProducts
        },
        usagePercentage: {
          shops: (shopCount / limits.maxShops) * 100,
          products: (shopCount / limits.maxProducts) * 100
        }
      };
    }
    
    res.json({
      success: true,
      data: {
        tenantId,
        tier: tierName,
        feature: feature,
        hasAccess,
        action: action || 'read',
        usageInfo
      }
    });
  } catch (error) {
    logger.error('[Tier Validation Error]', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to validate tier access'
    });
  }
});

/**
 * GET /api/tiers/:tenant_id
 * Get tier information for a specific tenant
 */
router.get('/:tenant_id', async (req, res) => {
  try {
    const { tenant_id: tenantId } = req.params;
    
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            inventory_items: true
          }
        }
      }
    });
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Tenant not found'
      });
    }
    
    const tierName = (tenant.subscription_tier as string) || 'Google-Only';
    const shopCount = tenant._count.inventory_items;
    
    // Calculate tier limits
    const tierLimits = {
      'Google-Only': { maxShops: 250, maxProducts: 1000, price: 0 },
      'Starter': { maxShops: 500, maxProducts: 5000, price: 29 },
      'Professional': { maxShops: 5000, maxProducts: 50000, price: 99 },
      'Enterprise': { maxShops: Infinity, maxProducts: Infinity, price: 299 },
      'Organization': { maxShops: Infinity, maxProducts: Infinity, price: 499 }
    };
    
    const limits = tierLimits[tierName as keyof typeof tierLimits] || tierLimits['Google-Only'];
    
    res.json({
      success: true,
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          isActive: (tenant.subscription_status as string) === 'active'
        },
        tier: {
          name: tierName,
          limits: {
            maxShops: limits.maxShops,
            maxProducts: limits.maxProducts,
            price: limits.price
          },
          usage: {
            shops: shopCount,
            shopsPercentage: (shopCount / limits.maxShops) * 100,
            shopsRemaining: Math.max(0, limits.maxShops - shopCount)
          }
        }
      }
    });
  } catch (error) {
    logger.error('[Get Tier Info Error]', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch tier information'
    });
  }
});

/**
 * GET /api/tiers
 * Get all available tiers
 */
router.get('/', async (req, res) => {
  try {
    const tiers = await prisma.subscription_tiers_list.findMany({
      orderBy: { price_monthly: 'asc' }
    });
    
    const tierData = tiers.map((tier: any) => ({
      id: tier.id,
      name: tier.name,
      description: tier.description,
      price: tier.price_monthly,
      features: tier.metadata || {},
      maxShops: tier.max_skus || 250,
      maxProducts: tier.max_skus || 1000
    }));
    
    res.json({
      success: true,
      data: tierData
    });
  } catch (error) {
    logger.error('[Get Tiers Error]', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch tiers'
    });
  }
});

export default router;
