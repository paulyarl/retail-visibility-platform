// ============================================================================
// ENHANCED DIRECTORY ROUTES WITH 3-CATEGORY SUPPORT + FALLBACK
// ============================================================================

import { Router, Request, Response } from 'express';
import { getDirectPool } from '../utils/db-pool';
import { getCategoryCounts } from '../utils/category-counts';

const router = Router();

/**
 * GET /api/directory/:slug/related
 * Enhanced related stores with 3-category support and fallback
 */
router.get('/:slug/related', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const limit = Math.min(6, Number(req.query.limit) || 6);

    console.log(`[Related Stores] Finding related stores for: ${slug}`);

    // First, get the current listing
    const currentListing = await getDirectPool().query(
      `SELECT * FROM directory_listings_list WHERE slug = $1 AND is_published = true
         AND (business_hours IS NULL OR business_hours::text != 'null') LIMIT 1`,
      [slug]
    );

    if (currentListing.rows.length === 0) {
      console.log(`[Related Stores] Listing not found: ${slug}`);
      return res.status(404).json({ error: 'listing_not_found' });
    }

    const current = currentListing.rows[0];
    console.log(`[Related Stores] Found current listing: ${current.business_name}`);

    // Try MV approach first, fallback to direct query
    let relatedListings = [];

    try {
      // Try using the materialized view (faster)
      console.log(`[Related Stores] Trying MV approach...`);
      const relatedQuery = `
        SELECT DISTINCT ON (dcl.id)
          dcl.*,
          (
            CASE
              WHEN dcl.is_primary = true AND dcl.category_name = $1 THEN 3
              WHEN dcl.is_primary = false AND dcl.category_name = $1 THEN 2
              WHEN dcl.category_name = ANY($7) THEN 2
              ELSE 0
            END +
            CASE
              WHEN dcl.city = $2 AND dcl.state = $3 THEN 2
              WHEN dcl.state = $3 THEN 1
              ELSE 0
            END +
            CASE
              WHEN ABS(dcl.rating_avg - $4) < 0.5 THEN 1
              ELSE 0
            END
          ) as relevance_score
        FROM directory_category_listings dcl
        WHERE dcl.slug != $5
        ORDER BY dcl.id, relevance_score DESC, dcl.rating_avg DESC, dcl.product_count DESC
        LIMIT $6
      `;

      const related = await getDirectPool().query(relatedQuery, [
        current.primary_category,
        current.city,
        current.state,
        current.rating_avg || 0,
        slug,
        limit,
        current.secondary_categories || [],
      ]);

      relatedListings = related.rows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        business_name: row.business_name,
        slug: row.slug,
        address: row.address,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code,
        phone: row.phone,
        email: row.email,
        website: row.website,
        latitude: row.latitude,
        longitude: row.longitude,
        primaryCategory: row.category_name,
        secondaryCategories: [],
        logoUrl: row.logo_url,
        description: row.description,
        ratingAvg: row.rating_avg || 0,
        ratingCount: row.rating_count || 0,
        productCount: row.product_count || 0,
        isFeatured: row.is_featured || false,
        subscription_tier: row.subscription_tier || 'trial',
        useCustomWebsite: row.use_custom_website || false,
        isPublished: row.is_published || true,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      console.log(`[Related Stores] MV approach found ${relatedListings.length} related stores`);

    } catch (mvError) {
      console.log(`[Related Stores] MV approach failed, using fallback:`, mvError);
      
      // Fallback: Direct query without MV
      const fallbackQuery = `
        SELECT *,
          (
            CASE
              WHEN primary_category = $1 THEN 3
              WHEN $1 = ANY(secondary_categories) THEN 2
              ELSE 0
            END +
            CASE
              WHEN city = $2 AND state = $3 THEN 2
              WHEN state = $3 THEN 1
              ELSE 0
            END +
            CASE
              WHEN ABS(rating_avg - $4) < 0.5 THEN 1
              ELSE 0
            END
          ) as relevance_score
        FROM directory_listings_list
        WHERE slug != $5
          AND is_published = true
          AND (business_hours IS NULL OR business_hours::text != 'null')
          AND tenant_id IN (SELECT id FROM tenants WHERE id IS NOT NULL)
        ORDER BY relevance_score DESC, rating_avg DESC, product_count DESC
        LIMIT $6
      `;

      const fallbackResult = await getDirectPool().query(fallbackQuery, [
        current.primary_category,
        current.city,
        current.state,
        current.rating_avg || 0,
        slug,
        limit,
      ]);

      relatedListings = fallbackResult.rows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        business_name: row.business_name,
        slug: row.slug,
        address: row.address,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code,
        phone: row.phone,
        email: row.email,
        website: row.website,
        latitude: row.latitude,
        longitude: row.longitude,
        primaryCategory: row.primary_category,
        secondaryCategories: row.secondary_categories || [],
        logoUrl: row.logo_url,
        description: row.description,
        ratingAvg: row.rating_avg || 0,
        ratingCount: row.rating_count || 0,
        productCount: row.product_count || 0,
        isFeatured: row.is_featured || false,
        subscription_tier: row.subscription_tier || 'trial',
        useCustomWebsite: row.use_custom_website || false,
        isPublished: row.is_published || true,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      console.log(`[Related Stores] Fallback approach found ${relatedListings.length} related stores`);
    }

    return res.json({
      related: relatedListings,
      count: relatedListings.length,
      method: relatedListings.length > 0 ? 'success' : 'no_related_found'
    });

  } catch (error) {
    console.error('[Related Stores] Error:', error);
    return res.status(500).json({ 
      error: 'related_stores_failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/directory/categories/enhanced
 * Enhanced categories with 3-category support
 */
router.get('/categories/enhanced', async (req: Request, res: Response) => {
  try {
    const { tenantId, categoryType } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ 
        error: 'Tenant ID is required',
        code: 'MISSING_TENANT_ID'
      });
    }

    // Validate categoryType if provided
    const validTypes = ['tenant', 'gbp_primary', 'gbp_secondary', 'platform'];
    if (categoryType && !validTypes.includes(categoryType as string)) {
      return res.status(400).json({ 
        error: 'Invalid categoryType. Must be one of: ' + validTypes.join(', '),
        code: 'INVALID_CATEGORY_TYPE'
      });
    }

    const categories = await getCategoryCounts(
      tenantId, 
      false, 
      categoryType as any
    );

    // Group by category type for enhanced frontend response
    const groupedCategories = categories.reduce((acc: Record<string, typeof categories>, cat: typeof categories[0]) => {
      const type = cat.category_type || 'unknown';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(cat);
      return acc;
    }, {} as Record<string, typeof categories>);

    // Clean response to avoid field duplication
    const cleanResponse = {
      success: true,
      data: {
        categories: categoryType ? categories : groupedCategories,
        summary: {
          total_categories: categories.length,
          category_types: [...new Set(categories.map((c: typeof categories[0]) => c.category_type))],
          total_products: categories.reduce((sum: number, cat: typeof categories[0]) => sum + (Number(cat.count) || 0), 0),
          filter_applied: categoryType || null
        }
      }
    };

    // Send as raw JSON to bypass Express middleware that adds camelCase fields
    const jsonString = JSON.stringify(cleanResponse);
    res.setHeader('Content-Type', 'application/json');
    res.send(jsonString);

  } catch (error) {
    console.error('[Enhanced Categories API] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch categories',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/directory/categories/types
 * Get available category types for tenant
 */
router.get('/categories/types', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ 
        error: 'Tenant ID is required',
        code: 'MISSING_TENANT_ID'
      });
    }

    // Get all categories to determine available types
    const allCategories = await getCategoryCounts(tenantId);
    
    // Group by category type and count
    const typeSummary = allCategories.reduce((acc: Record<string, any>, cat: typeof allCategories[0]) => {
      const type = cat.category_type || 'unknown';
      if (!acc[type]) {
        acc[type] = {
          type,
          count: 0,
          products: 0,
          isPrimary: false,
          categories: []
        };
      }
      acc[type].count++;
      acc[type].products += Number(cat.count) || 0;
      acc[type].isPrimary = acc[type].isPrimary || (cat.is_primary === true);
      acc[type].categories.push({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        count: cat.count
      });
      return acc;
    }, {} as Record<string, any>);

    // Order by priority: tenant > gbp_primary > gbp_secondary > platform
    const orderedTypes = ['tenant', 'gbp_primary', 'gbp_secondary', 'platform'];
    const availableTypes = orderedTypes
      .filter(type => typeSummary[type])
      .map(type => typeSummary[type]);

    // Clean response to avoid field duplication
    const cleanResponse = {
      success: true,
      data: {
        tenant_id: tenantId,
        availableTypes,
        summary: {
          total_types: availableTypes.length,
          total_categories: allCategories.length,
          total_products: allCategories.reduce((sum: number, cat: typeof allCategories[0]) => sum + (Number(cat.count) || 0), 0)
        }
      }
    };

    // Send as raw JSON to bypass Express middleware that adds camelCase fields
    const jsonString = JSON.stringify(cleanResponse);
    res.setHeader('Content-Type', 'application/json');
    res.send(jsonString);

  } catch (error) {
    console.error('[Category Types API] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch category types',
      code: 'INTERNAL_ERROR'
    });
  }
});

// ============================================================================
// GET /api/directory/enhanced/categories/storefront
// Storefront-optimized categories with deduplication and priority ordering
// ============================================================================
router.get('/categories/storefront', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        error: 'tenantId is required',
        code: 'MISSING_TENANT_ID'
      });
    }

    // Get all categories with enhanced data
    const allCategories = await getCategoryCounts(tenantId, false);

    // Deduplicate by category name with priority ordering
    // Priority: tenant > gbp_primary > gbp_secondary > platform
    const priorityOrder = {
      'tenant': 1,
      'gbp_primary': 2,
      'gbp_secondary': 3,
      'platform': 4
    };

    const deduplicatedCategories = allCategories.reduce((acc: any[], cat) => {
      const existing = acc.find(c => c.name === cat.name);
      
      if (!existing) {
        // First occurrence of this category name
        acc.push({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          count: cat.count,
          category_type: cat.category_type,
          is_primary: cat.is_primary,
          priority: priorityOrder[cat.category_type as keyof typeof priorityOrder] || 999,
          google_category_id: cat.google_category_id,
          sort_order: cat.sort_order
        });
      } else {
        // Category already exists, check if this version has higher priority
        const currentPriority = priorityOrder[cat.category_type as keyof typeof priorityOrder] || 999;
        if (currentPriority < existing.priority) {
          // Replace with higher priority version
          Object.assign(existing, {
            id: cat.id,
            category_type: cat.category_type,
            is_primary: cat.is_primary,
            priority: currentPriority,
            google_category_id: cat.google_category_id
          });
        }
      }
      
      return acc;
    }, []);

    // Sort by priority first, then by sort_order
    deduplicatedCategories.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    // Calculate summary stats
    const totalProducts = deduplicatedCategories.reduce((sum, cat) => sum + (Number(cat.count) || 0), 0);

    // Create completely clean response object
    const cleanCategories = deduplicatedCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      count: cat.count,
      category_type: cat.category_type,
      is_primary: cat.is_primary,
      priority: cat.priority,
      google_category_id: cat.google_category_id,
      sort_order: cat.sort_order
    }));

    // Remove any camelCase properties that might exist
    cleanCategories.forEach(cat => {
      delete (cat as any).categoryType;
      delete (cat as any).isPrimary;
      delete (cat as any).googleCategoryId;
      delete (cat as any).sortOrder;
      delete (cat as any).tenantId;
      delete (cat as any).tenantName;
      delete (cat as any).productsWithImages;
      delete (cat as any).productsWithDescriptions;
      delete (cat as any).avgPriceCents;
      delete (cat as any).minPriceCents;
      delete (cat as any).maxPriceCents;
      delete (cat as any).lastProductUpdated;
    });

    const cleanSummary = {
      total_categories: deduplicatedCategories.length,
      total_products: totalProducts,
      category_types: [...new Set(deduplicatedCategories.map(cat => cat.category_type))]
    };

    const cleanResponse = {
      success: true,
      data: {
        tenant_id: tenantId,
        categories: cleanCategories,
        summary: cleanSummary
      }
    };

    // Remove any camelCase from top level
    delete (cleanResponse.data as any).tenantId;

    console.log('[DEBUG] Clean response before JSON:', JSON.stringify(cleanResponse, null, 2));
    
    // Send as raw JSON to bypass any Express middleware that might be adding camelCase fields
    const jsonString = JSON.stringify(cleanResponse);
    res.setHeader('Content-Type', 'application/json');
    res.send(jsonString);

  } catch (error) {
    console.error('[Storefront Categories API] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch storefront categories',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
