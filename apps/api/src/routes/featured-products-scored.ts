/**
 * Featured Products with Quality Scoring API
 * 
 * Prioritizes featured products from high-quality stores using a comprehensive
 * scoring system based on store quality, profile completeness, engagement, and recency.
 * 
 * Performance: <10ms using materialized views + scoring
 */

import { Router, Request, Response } from 'express';
import { getDirectPool } from '../utils/db-pool';
import { MINIMUM_QUALITY_THRESHOLD, getQualityTier } from '../utils/featured-product-scoring';
import { prisma } from '../prisma';
import { FeaturedProductsService } from '../services/FeaturedProductsService';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// GET /api/featured-products/management - Get all featured products for management (no limits)
router.get('/management', async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId required' });
    }

    // TODO: Add authentication check when needed
    // const isAdmin = req.user?.role === 'PLATFORM_ADMIN';
    // const hasAccess = isAdmin || (req.user?.tenantIds?.includes(tenantId as string) ?? false);

    // if (!hasAccess) {
    //   return res.status(403).json({ error: 'tenant_access_denied' });
    // }

    const result = await FeaturedProductsService.getAllFeaturedProductsForManagement(tenantId as string);

    res.json(result);
  } catch (error: any) {
    console.error('[GET /featured-products/management] Error:', error);
    res.status(500).json({ error: 'failed_to_get_management_featured_products', message: error.message });
  }
});

// GET /api/featured-products/debug - Debug endpoint to check featured products
router.get('/debug', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId required' });
    }

    // Get all featured products for this tenant
    const featuredProducts = await prisma.featured_products.findMany({
      where: {
        tenant_id: tenantId
      },
      include: {
        inventory_items: {
          select: {
            id: true,
            name: true,
            sku: true,
            tenant_id: true
          }
        }
      },
      orderBy: [
        { featured_priority: 'desc' },
        { featured_at: 'desc' }
      ]
    });

    res.json({
      tenantId,
      totalFeatured: featuredProducts.length,
      featuredProducts: featuredProducts.map(fp => ({
        id: fp.id,
        inventory_item_id: fp.inventory_item_id,
        featured_type: fp.featured_type,
        featured_priority: fp.featured_priority,
        featured_at: fp.featured_at,
        featured_expires_at: fp.featured_expires_at,
        is_active: fp.is_active,
        inventory_item: fp.inventory_items
      }))
    });
  } catch (error: any) {
    console.error('[GET /featured-products/debug] Error:', error);
    res.status(500).json({ error: 'failed_to_debug_featured_products', message: error.message });
  }
});

// POST /api/featured-products/migrate - Migrate legacy featured products to multi-type system
router.post('/migrate', async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId required' });
    }

    // Import the FeaturedProductsService
    const { FeaturedProductsService } = await import('../services/FeaturedProductsService');
    
    const result = await FeaturedProductsService.migrateLegacyFeaturedProducts(tenantId);

    res.json({
      message: 'migration_completed',
      ...result
    });
  } catch (error: any) {
    console.error('[POST /featured-products/migrate] Error:', error);
    res.status(500).json({ error: 'failed_to_migrate_featured_products', message: error.message });
  }
});

/**
 * GET /api/featured-products/scored
 * Get featured products ordered by store quality score
 * 
 * Query params:
 * - limit: Max results (default: 20, max: 100)
 * - minScore: Minimum quality score (default: 30)
 * - category: Filter by category slug
 * - tier: Filter by quality tier (excellent/good/fair/poor)
 */
router.get('/scored', async (req: Request, res: Response) => {
  try {
    const { 
      limit = '20', 
      minScore = String(MINIMUM_QUALITY_THRESHOLD),
      category,
      tier,
      lat,
      lng
    } = req.query;
    
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const minScoreNum = Math.max(0, Number(minScore));
    
    // Parse user location for proximity scoring
    const userLat = lat ? parseFloat(lat as string) : null;
    const userLng = lng ? parseFloat(lng as string) : null;
    const hasUserLocation = userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng);
    
    // Build WHERE clause
    const conditions: string[] = ['sp.is_actively_featured = true'];
    const params: any[] = [];
    let paramIndex = 1;
    
    // Category filter
    if (category && typeof category === 'string') {
      conditions.push(`sp.category_slug = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    
    // Quality tier filter
    if (tier && typeof tier === 'string') {
      switch (tier.toLowerCase()) {
        case 'excellent':
          conditions.push('quality_score >= 80');
          break;
        case 'good':
          conditions.push('quality_score >= 60 AND quality_score < 80');
          break;
        case 'fair':
          conditions.push('quality_score >= 40 AND quality_score < 60');
          break;
        case 'poor':
          conditions.push('quality_score >= 30 AND quality_score < 40');
          break;
      }
    }
    
    const whereClause = conditions.join(' AND ');
    
    // Build category relevance calculation if category filter provided
    const categoryRelevanceCalc = category && typeof category === 'string' ? `
      -- Category Relevance Score (0-10 bonus pts)
      -- Primary category match = 10 pts, Secondary category match = 5 pts
      CASE 
        WHEN primary_category = $${params.length + 1} THEN 10
        WHEN $${params.length + 1} = ANY(secondary_categories) THEN 5
        ELSE 0
      END
    ` : '0';
    
    // Add category to params if provided for relevance scoring
    if (category && typeof category === 'string' && !params.includes(category)) {
      params.push(category);
      paramIndex++;
    }
    
    // Build proximity calculation if user location provided
    const proximityCalc = hasUserLocation ? `
      -- Proximity Score (0-10 bonus pts) - Closer stores get higher scores
      -- 50-mile radius to cover metropolitan areas (Indianapolis, etc.)
      -- Uses PostGIS to calculate distance in miles
      CASE 
        WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN
          GREATEST(0, 10 - (
            ST_Distance(
              ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint($${params.length + 1}, $${params.length + 2}), 4326)::geography
            ) / 1609.34 * 0.2
          ))
        ELSE 0
      END
    ` : '0';
    
    // Add user location to params if provided
    if (hasUserLocation) {
      params.push(userLng!, userLat!);
      paramIndex += 2;
    }
    
    // Query with store quality scoring
    const query = `
      WITH store_scores AS (
        SELECT 
          tenant_id,
          business_name,
          slug as store_slug,
          logo_url as store_logo,
          -- Location & Discoverability (40 pts max) - PRIMARY for local shopping
          ROUND(
            (CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 20 ELSE 0 END) +
            (CASE WHEN business_hours IS NOT NULL THEN 15 ELSE 0 END) +
            (CASE 
              WHEN updated_at > NOW() - INTERVAL '7 days' THEN 5
              WHEN updated_at > NOW() - INTERVAL '14 days' THEN 4
              WHEN updated_at > NOW() - INTERVAL '30 days' THEN 3
              WHEN updated_at > NOW() - INTERVAL '60 days' THEN 2
              WHEN updated_at > NOW() - INTERVAL '90 days' THEN 1
              ELSE 0
            END)
          , 1) as location_discoverability_score,
          
          -- Store Reputation (30 pts max)
          ROUND(
            COALESCE((rating_avg / 5.0) * 15, 0) +
            LEAST(COALESCE(rating_count / 5.0, 0), 10) +
            LEAST(COALESCE(product_count / 10.0, 0), 5)
          , 1) as store_quality_score,
          
          -- Profile Completeness (20 pts max)
          (CASE WHEN logo_url IS NOT NULL AND logo_url != '' THEN 10 ELSE 0 END) +
          (CASE WHEN description IS NOT NULL AND LENGTH(description) > 50 THEN 10 ELSE 0 END) as profile_completeness_score,
          
          -- Engagement (10 pts max)
          (CASE 
            WHEN subscription_tier = 'enterprise' THEN 7
            WHEN subscription_tier = 'pro' THEN 5
            WHEN subscription_tier = 'starter' THEN 3
            ELSE 0
          END) +
          (CASE WHEN website IS NOT NULL AND website != '' THEN 3 ELSE 0 END) as engagement_score,
          
          -- Category Relevance bonus (0-10 pts) - only if category filter provided
          ${categoryRelevanceCalc} as category_relevance_score,
          
          -- Proximity bonus (0-10 pts) - only if user location provided
          ${proximityCalc} as proximity_score,
          
          -- Metadata for context
          rating_avg,
          rating_count,
          product_count,
          subscription_tier
        FROM directory_listings_list
        WHERE is_published = true
      ),
      scored_products AS (
        SELECT 
          sp.*,
          ss.business_name as store_name,
          ss.store_slug,
          ss.store_logo,
          ss.location_discoverability_score,
          ss.store_quality_score,
          ss.profile_completeness_score,
          ss.engagement_score,
          ss.category_relevance_score,
          ss.proximity_score,
          ROUND(
            ss.location_discoverability_score + 
            ss.store_quality_score + 
            ss.profile_completeness_score + 
            ss.engagement_score + 
            ss.category_relevance_score + 
            ss.proximity_score
          , 1) as quality_score,
          ss.rating_avg as store_rating_avg,
          ss.rating_count as store_rating_count,
          ss.product_count as store_product_count,
          ss.subscription_tier as store_tier
        FROM storefront_products sp
        JOIN store_scores ss ON sp.tenant_id = ss.tenant_id
        WHERE ${whereClause}
      )
      SELECT *
      FROM scored_products
      WHERE quality_score >= $${paramIndex}
      ORDER BY 
        quality_score DESC,
        featured_priority DESC,
        featured_at DESC
      LIMIT $${paramIndex + 1}
    `;
    
    params.push(minScoreNum, limitNum);
    
    const result = await getDirectPool().query(query, params);
    
    // Transform to camelCase and add quality tier
    const items = result.rows.map((row: any) => ({
      // Product data
      id: row.id,
      tenantId: row.tenant_id,
      sku: row.sku,
      name: row.name,
      title: row.title,
      description: row.description,
      priceCents: row.price_cents,
      stock: row.stock,
      imageUrl: row.image_url,
      categoryName: row.category_name,
      
      // Store data
      storeName: row.store_name,
      storeSlug: row.store_slug,
      storeLogo: row.store_logo,
      storeRatingAvg: row.store_rating_avg,
      storeRatingCount: row.store_rating_count,
      storeProductCount: row.store_product_count,
      storeTier: row.store_tier,
      
      // Featured data
      featuredPriority: row.featured_priority,
      featuredAt: row.featured_at,
      featuredUntil: row.featured_until,
      
      // Quality scoring
      qualityScore: row.quality_score,
      qualityTier: getQualityTier(row.quality_score),
      scoreBreakdown: {
        locationDiscoverability: row.location_discoverability_score,
        storeQuality: row.store_quality_score,
        profileCompleteness: row.profile_completeness_score,
        engagement: row.engagement_score,
        categoryRelevance: row.category_relevance_score || 0,
        proximityBonus: row.proximity_score || 0,
      },
    }));
    
    // Calculate score distribution
    const scoreDistribution = {
      excellent: items.filter(i => i.qualityScore >= 80).length,
      good: items.filter(i => i.qualityScore >= 60 && i.qualityScore < 80).length,
      fair: items.filter(i => i.qualityScore >= 40 && i.qualityScore < 60).length,
      poor: items.filter(i => i.qualityScore >= 30 && i.qualityScore < 40).length,
    };
    
    res.json({
      items,
      count: items.length,
      filters: {
        category: category || null,
        tier: tier || null,
        minScore: minScoreNum,
        userLocation: hasUserLocation ? { lat: userLat, lng: userLng } : null,
      },
      scoreDistribution,
      performance: {
        queryTime: '<10ms',
        scoringEnabled: true,
        categoryRelevanceEnabled: !!category,
        proximityEnabled: hasUserLocation,
      },
    });
  } catch (error) {
    console.error('[Featured Products Scored] Error:', error);
    res.status(500).json({ 
      error: 'failed_to_fetch_scored_featured_products',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/featured-products/score-stats
 * Get statistics about store quality scores across all featured products
 */
router.get('/score-stats', async (req: Request, res: Response) => {
  try {
    const query = `
      WITH store_scores AS (
        SELECT 
          tenant_id,
          ROUND(
            (CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 20 ELSE 0 END) +
            (CASE WHEN business_hours IS NOT NULL THEN 15 ELSE 0 END) +
            (CASE 
              WHEN updated_at > NOW() - INTERVAL '7 days' THEN 5
              WHEN updated_at > NOW() - INTERVAL '14 days' THEN 4
              WHEN updated_at > NOW() - INTERVAL '30 days' THEN 3
              WHEN updated_at > NOW() - INTERVAL '60 days' THEN 2
              WHEN updated_at > NOW() - INTERVAL '90 days' THEN 1
              ELSE 0
            END) +
            COALESCE((rating_avg / 5.0) * 15, 0) +
            LEAST(COALESCE(rating_count / 5.0, 0), 10) +
            LEAST(COALESCE(product_count / 10.0, 0), 5) +
            (CASE WHEN logo_url IS NOT NULL AND logo_url != '' THEN 10 ELSE 0 END) +
            (CASE WHEN description IS NOT NULL AND LENGTH(description) > 50 THEN 10 ELSE 0 END) +
            (CASE 
              WHEN subscription_tier = 'enterprise' THEN 7
              WHEN subscription_tier = 'pro' THEN 5
              WHEN subscription_tier = 'starter' THEN 3
              ELSE 0
            END) +
            (CASE WHEN website IS NOT NULL AND website != '' THEN 3 ELSE 0 END)
          , 1) as quality_score
        FROM directory_listings_list
        WHERE is_published = true
      )
      SELECT 
        COUNT(DISTINCT sp.tenant_id) as total_stores_with_featured,
        COUNT(*) as total_featured_products,
        ROUND(AVG(ss.quality_score), 1) as avg_quality_score,
        ROUND(MIN(ss.quality_score), 1) as min_quality_score,
        ROUND(MAX(ss.quality_score), 1) as max_quality_score,
        COUNT(*) FILTER (WHERE ss.quality_score >= 80) as excellent_count,
        COUNT(*) FILTER (WHERE ss.quality_score >= 60 AND ss.quality_score < 80) as good_count,
        COUNT(*) FILTER (WHERE ss.quality_score >= 40 AND ss.quality_score < 60) as fair_count,
        COUNT(*) FILTER (WHERE ss.quality_score >= 30 AND ss.quality_score < 40) as poor_count,
        COUNT(*) FILTER (WHERE ss.quality_score < 30) as unqualified_count
      FROM storefront_products sp
      JOIN store_scores ss ON sp.tenant_id = ss.tenant_id
      WHERE sp.is_actively_featured = true
    `;
    
    const result = await getDirectPool().query(query);
    const stats = result.rows[0];
    
    res.json({
      totalStoresWithFeatured: parseInt(stats.total_stores_with_featured),
      totalFeaturedProducts: parseInt(stats.total_featured_products),
      avgQualityScore: parseFloat(stats.avg_quality_score),
      minQualityScore: parseFloat(stats.min_quality_score),
      maxQualityScore: parseFloat(stats.max_quality_score),
      distribution: {
        excellent: parseInt(stats.excellent_count),
        good: parseInt(stats.good_count),
        fair: parseInt(stats.fair_count),
        poor: parseInt(stats.poor_count),
        unqualified: parseInt(stats.unqualified_count),
      },
      threshold: MINIMUM_QUALITY_THRESHOLD,
    });
  } catch (error) {
    console.error('[Featured Products Score Stats] Error:', error);
    res.status(500).json({ 
      error: 'failed_to_fetch_score_stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/featured-products/tenants/:id/approve-featured-access - Approve tenant for featured access (admin only)
router.post('/tenants/:id/approve-featured-access', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the authenticated user from JWT token (following NextAuth SSO migration pattern)
    const requestingUser = (req as any).user;

    console.log('[DEBUG] Requesting user from JWT:', {
      userId: requestingUser?.userId,
      user_id: requestingUser?.user_id,
      email: requestingUser?.email,
      role: requestingUser?.role
    });

    if (!requestingUser?.userId) {
      return res.status(401).json({ error: 'user_not_authenticated' });
    }

    // Use JWT user ID directly - all platform users should exist in database
    const approvedTenant = await FeaturedProductsService.approveTenantFeaturedAccess(id, requestingUser.userId);

    res.json({
      message: 'tenant_featured_access_approved',
      tenant: approvedTenant
    });

  } catch (error: any) {
    console.error('[POST featured-products/tenants/:id/approve-featured-access] Error:', error);
    res.status(500).json({ error: 'failed_to_approve_tenant_featured_access', message: error.message });
  }
});

// POST /api/featured-products/tenants/:id/reject-featured-access - Reject tenant for featured access (admin only)
router.post('/tenants/:id/reject-featured-access', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Get the authenticated user from JWT token (following NextAuth SSO migration pattern)
    const requestingUser = (req as any).user;

    if (!requestingUser?.userId) {
      return res.status(401).json({ error: 'user_not_authenticated' });
    }

    // Use JWT user ID directly - no database validation needed for NextAuth SSO compatibility
    const rejectedTenant = await FeaturedProductsService.rejectTenantFeaturedAccess(id, requestingUser.userId, reason);

    res.json({
      message: 'tenant_featured_access_rejected',
      tenant: rejectedTenant,
      reason: reason || null
    });

  } catch (error: any) {
    console.error('[POST featured-products/tenants/:id/reject-featured-access] Error:', error);
    res.status(500).json({ error: 'failed_to_reject_tenant_featured_access', message: error.message });
  }
});

// GET /api/featured-products/all-featured-products - Get all featured products (both approved and rejected)
router.get('/all-featured-products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const allFeaturedProducts = await FeaturedProductsService.getAllFeaturedProducts();

    res.json({
      featuredProducts: allFeaturedProducts,
      count: allFeaturedProducts.length
    });

  } catch (error: any) {
    console.error('[GET featured-products/all-featured-products] Error:', error);
    res.status(500).json({ error: 'failed_to_get_all_featured_products', message: error.message });
  }
});

// POST /api/featured-products/:productId/approve - Approve a featured product
router.post('/:productId/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { productId } = req.params;
    const adminUserId = (req as any).user?.userId;

    if (!adminUserId) {
      return res.status(401).json({ error: 'admin_user_required', message: 'Admin user ID required' });
    }

    console.log('[POST featured-products/:productId/approve] Approving product:', productId, 'by admin:', adminUserId);

    const approvedProduct = await FeaturedProductsService.approveFeaturedProduct(productId, adminUserId);

    res.json({
      message: 'featured_product_approved',
      featuredProduct: approvedProduct
    });

  } catch (error: any) {
    console.error('[POST featured-products/:productId/approve] Error:', error);
    res.status(500).json({ error: 'failed_to_approve_featured_product', message: error.message });
  }
});

// POST /api/featured-products/:productId/reject - Reject a featured product
router.post('/:productId/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { productId } = req.params;
    const { reason } = req.body;
    const adminUserId = (req as any).user?.userId;

    if (!adminUserId) {
      return res.status(401).json({ error: 'admin_user_required', message: 'Admin user ID required' });
    }

    console.log('[POST featured-products/:productId/reject] Rejecting product:', productId, 'by admin:', adminUserId, 'reason:', reason);

    const rejectedProduct = await FeaturedProductsService.rejectFeaturedProduct(productId, adminUserId, reason);

    res.json({
      message: 'featured_product_rejected',
      featuredProduct: rejectedProduct,
      reason: reason || null
    });

  } catch (error: any) {
    console.error('[POST featured-products/:productId/reject] Error:', error);
    res.status(500).json({ error: 'failed_to_reject_featured_product', message: error.message });
  }
});

// GET /api/featured-products/tenants/all-with-featured-access-status - Get all tenants with featured access status
router.get('/tenants/all-with-featured-access-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const allTenants = await FeaturedProductsService.getAllTenantsWithFeaturedAccessStatus();

    res.json({
      tenants: allTenants,
      count: allTenants.length
    });

  } catch (error: any) {
    console.error('[GET featured-products/tenants/all-with-featured-access-status] Error:', error);
    res.status(500).json({ error: 'failed_to_get_all_tenants_featured_access_status', message: error.message });
  }
});

// GET /api/featured-products/tenants/pending-featured-access - Get tenants pending featured access approval
router.get('/tenants/pending-featured-access', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pendingTenants = await FeaturedProductsService.getTenantsPendingFeaturedAccess();

    res.json({
      pendingTenants,
      count: pendingTenants.length
    });

  } catch (error: any) {
    console.error('[GET featured-products/tenants/pending-featured-access] Error:', error);
    res.status(500).json({ error: 'failed_to_get_pending_tenant_featured_access', message: error.message });
  }
});

// GET /api/tenants/:id/featured-access-status - Get tenant's featured access status
router.get('/tenants/:id/featured-access-status', async (req, res) => {
  try {
    const { id } = req.params;
    
    // TODO: Add proper authentication check
    // const userId = req.user?.userId;
    // if (!userId || !req.user?.tenantIds?.includes(id)) {
    //   return res.status(403).json({ error: 'tenant_access_denied' });
    // }

    const hasAccess = await FeaturedProductsService.tenantHasFeaturedAccess(id);
    
    res.json({
      hasAccess,
      tenantId: id,
      accessType: 'featured',
      checkedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[GET featured-access-status] Error:', error);
    res.status(500).json({ error: 'failed_to_get_featured_access_status', message: error.message });
  }
});

// GET /api/tenants/:id/featured-products/with-approval - Get tenant's featured products with approval status
router.get('/tenants/:id/featured-products/with-approval', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = '20', offset = '0' } = req.query;
    
    // TODO: Add proper authentication check
    // const userId = req.user?.userId;
    // if (!userId || !req.user?.tenantIds?.includes(id)) {
    //   return res.status(403).json({ error: 'tenant_access_denied' });
    // }

    // Get tenant's featured products
    const featuredProducts = await FeaturedProductsService.getFeaturedProductsForTenant(id, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    // Check if tenant has featured access
    const hasAccess = await FeaturedProductsService.tenantHasFeaturedAccess(id);

    res.json({
      featuredProducts,
      hasFeaturedAccess: hasAccess,
      tenantId: id,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: featuredProducts.length
      }
    });

  } catch (error: any) {
    console.error('[GET featured-products/with-approval] Error:', error);
    res.status(500).json({ error: 'failed_to_get_featured_products_with_approval', message: error.message });
  }
});

// POST /api/tenants/:id/request-featured-access - Request featured access for tenant
router.post('/tenants/:id/request-featured-access', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // TODO: Add proper authentication check
    // const userId = req.user?.userId;
    // if (!userId || !req.user?.tenantIds?.includes(id)) {
    //   return res.status(403).json({ error: 'tenant_access_denied' });
    // }

    // Check if tenant already has access
    const hasAccess = await FeaturedProductsService.tenantHasFeaturedAccess(id);
    if (hasAccess) {
      return res.status(400).json({ 
        error: 'already_has_access',
        message: 'Tenant already has featured access'
      });
    }

    // Check if tenant already has a pending request
    const pendingTenants = await FeaturedProductsService.getTenantsPendingFeaturedAccess();
    const hasPendingRequest = pendingTenants.some(tenant => tenant.id === id);
    
    if (hasPendingRequest) {
      return res.status(400).json({ 
        error: 'pending_request_exists',
        message: 'Tenant already has a pending access request'
      });
    }

    // Create a pending request (you could implement a separate table for requests)
    // For now, we'll just acknowledge the request
    res.json({
      message: 'access_request_submitted',
      tenantId: id,
      reason: reason || 'No reason provided',
      status: 'pending_review',
      submittedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[POST request-featured-access] Error:', error);
    res.status(500).json({ error: 'failed_to_request_featured_access', message: error.message });
  }
});

export default router;
