/**
 * Tenant Cache Demo Route
 * Demonstrates the unified cache service for tenant data
 */

import { Router } from 'express';
import { getDirectPool } from '../utils/db-pool';
import CacheService, { CacheKeys, CACHE_TTL } from '../lib/cache-service';

const router = Router();

// GET /api/tenant/:tenantId/info
// Returns tenant information with caching
router.get('/:tenantId/info', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Check cache first
    const cacheKey = CacheKeys.TENANT_INFO(tenantId);
    const cached = await CacheService.get(cacheKey);
    
    if (cached) {
      console.log(`[Tenant Info] Cache hit for tenant ${tenantId}`);
      return res.json({
        ...cached,
        cached: true,
        refreshed_at: new Date().toISOString()
      });
    }
    
    console.log(`[Tenant Info] Cache miss for tenant ${tenantId}, fetching from database`);
    
    const pool = getDirectPool();
    
    // Get tenant information
    const query = `
      SELECT 
        t.id,
        t.business_name,
        t.slug,
        t.description,
        t.logo_url,
        t.city,
        t.state,
        t.country,
        t.subscription_tier,
        t.subscription_status,
        t.created_at,
        t.updated_at,
        COUNT(DISTINCT sp.id) as product_count,
        COUNT(DISTINCT sp.id) FILTER (WHERE sp.is_actively_featured = true) as featured_count
      FROM tenants t
      LEFT JOIN storefront_products sp ON sp.tenant_id = t.id
      WHERE t.id = $1
      GROUP BY t.id
    `;
    
    const result = await pool.query(query, [tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const tenant = result.rows[0];
    
    // Get tenant limits
    const limitsQuery = `
      SELECT 
        max_products,
        max_locations,
        max_users,
        api_rate_limit,
        storage_limit_mb
      FROM tenant_limits
      WHERE tenant_id = $1
    `;
    
    const limitsResult = await pool.query(limitsQuery, [tenantId]);
    const limits = limitsResult.rows[0] || {};
    
    // Get usage statistics
    const usageQuery = `
      SELECT 
        COUNT(DISTINCT id) as current_products,
        COUNT(DISTINCT id) FILTER (WHERE is_actively_featured = true) as current_featured,
        COUNT(DISTINCT id) FILTER (WHERE stock > 0) as in_stock
      FROM storefront_products
      WHERE tenant_id = $1
    `;
    
    const usageResult = await pool.query(usageQuery, [tenantId]);
    const usage = usageResult.rows[0] || {};
    
    const responseData = {
      tenant: {
        id: tenant.id,
        businessName: tenant.business_name,
        slug: tenant.slug,
        description: tenant.description,
        logoUrl: tenant.logo_url,
        location: {
          city: tenant.city,
          state: tenant.state,
          country: tenant.country
        },
        subscription: {
          tier: tenant.subscription_tier,
          status: tenant.subscription_status
        },
        stats: {
          productCount: parseInt(tenant.product_count) || 0,
          featuredCount: parseInt(tenant.featured_count) || 0,
          currentProducts: parseInt(usage.current_products) || 0,
          currentFeatured: parseInt(usage.current_featured) || 0,
          inStock: parseInt(usage.in_stock) || 0
        },
        createdAt: tenant.created_at,
        updatedAt: tenant.updated_at
      },
      limits: {
        maxProducts: limits.max_products || 100,
        maxLocations: limits.max_locations || 1,
        maxUsers: limits.max_users || 5,
        apiRateLimit: limits.api_rate_limit || 1000,
        storageLimitMb: limits.storage_limit_mb || 1000
      },
      cached: false
    };
    
    // Cache the result for 15 minutes
    await CacheService.set(cacheKey, responseData, CACHE_TTL.MEDIUM);
    
    res.json({
      ...responseData,
      refreshed_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Tenant Info] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tenant information',
      cached: false,
      refreshed_at: new Date().toISOString()
    });
  }
});

// GET /api/tenant/:tenantId/limits
// Returns tenant limits with caching
router.get('/:tenantId/limits', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Check cache first
    const cacheKey = CacheKeys.TENANT_LIMITS(tenantId);
    const cached = await CacheService.get(cacheKey);
    
    if (cached) {
      console.log(`[Tenant Limits] Cache hit for tenant ${tenantId}`);
      return res.json({
        ...cached,
        cached: true,
        refreshed_at: new Date().toISOString()
      });
    }
    
    console.log(`[Tenant Limits] Cache miss for tenant ${tenantId}, fetching from database`);
    
    const pool = getDirectPool();
    
    // Get tenant limits and usage
    const query = `
      SELECT 
        tl.max_products,
        tl.max_locations,
        tl.max_users,
        tl.api_rate_limit,
        tl.storage_limit_mb,
        COUNT(DISTINCT sp.id) as current_products,
        COUNT(DISTINCT sp.id) FILTER (WHERE sp.is_actively_featured = true) as current_featured,
        COUNT(DISTINCT sp.id) FILTER (WHERE stock > 0) as in_stock,
        ROUND((COUNT(DISTINCT sp.id)::float / tl.max_products) * 100, 2) as product_usage_percentage,
        ROUND((COUNT(DISTINCT sp.id) FILTER (WHERE sp.is_actively_featured = true)::float / (tl.max_products * 0.2)) * 100, 2) as featured_usage_percentage
      FROM tenant_limits tl
      LEFT JOIN storefront_products sp ON sp.tenant_id = tl.tenant_id
      WHERE tl.tenant_id = $1
      GROUP BY tl.tenant_id, tl.max_products, tl.max_locations, tl.max_users, tl.api_rate_limit, tl.storage_limit_mb
    `;
    
    const result = await pool.query(query, [tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant limits not found' });
    }
    
    const limits = result.rows[0];
    
    const responseData = {
      limits: {
        maxProducts: limits.max_products || 100,
        maxLocations: limits.max_locations || 1,
        maxUsers: limits.max_users || 5,
        apiRateLimit: limits.api_rate_limit || 1000,
        storageLimitMb: limits.storage_limit_mb || 1000
      },
      usage: {
        currentProducts: parseInt(limits.current_products) || 0,
        currentFeatured: parseInt(limits.current_featured) || 0,
        inStock: parseInt(limits.in_stock) || 0,
        productUsagePercentage: parseFloat(limits.product_usage_percentage) || 0,
        featuredUsagePercentage: parseFloat(limits.featured_usage_percentage) || 0
      },
      warnings: {
        nearLimit: (limits.product_usage_percentage || 0) > 80,
        featuredLimit: (limits.featured_usage_percentage || 0) > 80,
        lowStock: (limits.in_stock || 0) < (limits.current_products || 0) * 0.2
      },
      cached: false
    };
    
    // Cache the result for 5 minutes (limits change frequently)
    await CacheService.set(cacheKey, responseData, CACHE_TTL.SHORT);
    
    res.json({
      ...responseData,
      refreshed_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Tenant Limits] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tenant limits',
      cached: false,
      refreshed_at: new Date().toISOString()
    });
  }
});

// POST /api/tenant/:tenantId/cache/clear
// Clear cache for a specific tenant
router.post('/:tenantId/cache/clear', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Clear all cache keys for this tenant
    await CacheService.del(CacheKeys.TENANT_INFO(tenantId));
    await CacheService.del(CacheKeys.TENANT_LIMITS(tenantId));
    await CacheService.del(CacheKeys.TENANT_USAGE(tenantId));
    
    // Clear product-related cache
    await CacheService.clear(`products:${tenantId}:*`);
    
    console.log(`[Tenant Cache] Cleared all cache for tenant ${tenantId}`);
    
    res.json({ 
      success: true,
      message: `Cache cleared for tenant ${tenantId}`,
      cleared_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Tenant Cache Clear] Error:', error);
    res.status(500).json({ 
      error: 'Failed to clear tenant cache',
      cleared_at: new Date().toISOString()
    });
  }
});

// GET /api/cache/stats
// Get cache statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await CacheService.getStats();
    
    res.json({
      ...stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Cache Stats] Error:', error);
    res.status(500).json({ 
      error: 'Failed to get cache statistics',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
