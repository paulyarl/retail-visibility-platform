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

    console.log(`[DEBUG] Related stores API called for slug: ${slug}, limit: ${limit}`);
    console.log(`[Related Stores] Finding related stores for: ${slug}`);

    // First, get the current listing
    const currentListing = await getDirectPool().query(
      `SELECT * FROM directory_listings_list WHERE slug = $1 AND is_published = true
         AND (business_hours IS NULL OR business_hours::text != 'null') LIMIT 1`,
      [slug]
    );

    if (currentListing.rows.length === 0) {
      return res.status(404).json({ error: 'listing_not_found' });
    }

    const current = currentListing.rows[0];

    // Try MV approach first, fallback to direct query
    let relatedListings = [];

    try {
      // Try using the materialized view (faster)
      const relatedQuery = `
        SELECT DISTINCT ON (dcl.id)
          dcl.*,
          dll.business_hours,
          (
            CASE
              WHEN dcl.is_primary = true AND dcl.category_name = $1 THEN 3
              WHEN dcl.is_primary = false AND dcl.category_name = $1 THEN 2
              WHEN dcl.category_name = ANY($6::text[]) THEN 2
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
        INNER JOIN tenants t ON dcl.tenant_id = t.id
        LEFT JOIN directory_listings_list dll ON dll.tenant_id = dcl.tenant_id
        WHERE dcl.slug != $5
          AND t.location_status IN ('active', 'inactive', 'closed')
        ORDER BY dcl.id, relevance_score DESC, dcl.rating_avg DESC, dcl.product_count DESC
      `;

      const related = await getDirectPool().query(relatedQuery, [
        current.primary_category,
        current.city,
        current.state,
        current.rating_avg || 0,
        slug,
        current.secondary_categories || [],
      ]);

      console.log(`[DEBUG] MV query returned ${related.rows.length} rows`);
      
      // Debug: Check if the problematic tenant is in the raw results
      const problematicTenant = related.rows.find(row => row.tenant_id === 't-lwx9znk8');
      if (problematicTenant) {
        console.log('[DEBUG] Found problematic tenant t-lwx9znk8 in raw MV results:', {
          tenant_id: problematicTenant.tenant_id,
          relevance_score: problematicTenant.relevance_score,
          is_published: problematicTenant.is_published,
          location_status: problematicTenant.location_status,
          tenant_location_status: problematicTenant.tenant_location_status
        });
      }

      relatedListings = related.rows
        .filter(row => (row.relevance_score || 0) >= 1) // Only stores with at least score of 1
        .slice(0, limit) // Limit to requested number
        .map((row: any) => {
          // Debug logging for the problematic tenant
          if (row.tenant_id === 't-lwx9znk8') {
            console.log('[DEBUG] Tenant t-lwx9znk8 found in MV results:', {
              tenant_id: row.tenant_id,
              relevance_score: row.relevance_score,
              is_published: row.is_published,
              location_status: row.location_status,
              business_name: row.business_name
            });
          }
          
          return {
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
          businessHours: row.business_hours,
          relevanceScore: row.relevance_score || 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }});

      console.log(`[Related Stores] MV approach found ${relatedListings.length} stores with score >= 1`);

    } catch (mvError) {
      console.log(`[Related Stores] MV approach failed, using fallback:`, mvError);
      
      // Fallback: Direct query without MV
      const fallbackQuery = `
        SELECT dll.*,
          (
            CASE
              WHEN dll.primary_category = $1 THEN 3  -- Exact primary match
              WHEN dll.primary_category = ANY($6) THEN 2  -- Store primary in target secondary
              WHEN $1 = ANY(dll.secondary_categories) THEN 2  -- Target primary in store secondary
              WHEN $6 && dll.secondary_categories THEN 1  -- Any secondary category overlap
              ELSE 0
            END
          ) as category_score,
          (
            CASE
              WHEN dll.city = $2 AND dll.state = $3 THEN 2
              WHEN dll.state = $3 THEN 1
              ELSE 0
            END
          ) as location_score,
          (
            CASE
              WHEN ABS(dll.rating_avg - $4) < 0.5 THEN 1
              ELSE 0
            END
          ) as rating_score,
          (
            (
              CASE
                WHEN dll.primary_category = $1 THEN 3
                WHEN dll.primary_category = ANY($6) THEN 2
                WHEN $1 = ANY(dll.secondary_categories) THEN 2
                WHEN $6 && dll.secondary_categories THEN 1
                ELSE 0
              END
            ) * 2 + -- Category score weighted 2x
            (
              CASE
                WHEN dll.city = $2 AND dll.state = $3 THEN 2
                WHEN dll.state = $3 THEN 1
                ELSE 0
              END
            ) + -- Location score 1x
            (
              CASE
                WHEN ABS(dll.rating_avg - $4) < 0.5 THEN 1
                ELSE 0
              END
            ) -- Rating score 1x
          ) as relevance_score
        FROM directory_listings_list dll
        INNER JOIN tenants t ON dll.tenant_id = t.id
        WHERE dll.slug != $5
          AND dll.is_published = true
          AND t.location_status IN ('active', 'inactive', 'closed')
          AND (dll.business_hours IS NULL OR dll.business_hours::text != 'null')
        ORDER BY relevance_score DESC, dll.rating_avg DESC, dll.product_count DESC
      `;

      const fallbackResult = await getDirectPool().query(fallbackQuery, [
        current.primary_category,
        current.city,
        current.state,
        current.rating_avg || 0,
        slug,
        current.secondary_categories || [],
      ]);

      console.log(`[DEBUG] Fallback query returned ${fallbackResult.rows.length} rows`);
      
      // Debug: Check if the problematic tenant is in the raw fallback results
      const problematicTenantFallback = fallbackResult.rows.find(row => row.tenant_id === 't-lwx9znk8');
      if (problematicTenantFallback) {
        console.log('[DEBUG] Found problematic tenant t-lwx9znk8 in raw fallback results:', {
          tenant_id: problematicTenantFallback.tenant_id,
          relevance_score: problematicTenantFallback.relevance_score,
          is_published: problematicTenantFallback.is_published,
          location_status: problematicTenantFallback.location_status
        });
        
        // Check the tenant status in database directly
        try {
          const tenantCheck = await getDirectPool().query(
            'SELECT id, location_status, subscription_status FROM tenants WHERE id = $1',
            ['t-lwx9znk8']
          );
          console.log('[DEBUG] Direct tenant lookup for t-lwx9znk8 (fallback):', tenantCheck.rows[0]);
        } catch (tenantErr) {
          console.log('[DEBUG] Error checking tenant status (fallback):', tenantErr);
        }
      }

      relatedListings = fallbackResult.rows
        .filter(row => (row.relevance_score || 0) >= 1) // Only stores with at least score of 1
        .slice(0, limit) // Limit to requested number
        .map((row: any) => {
          // Debug logging for the problematic tenant
          if (row.tenant_id === 't-lwx9znk8') {
            console.log('[DEBUG] Tenant t-lwx9znk8 found in fallback results:', {
              tenant_id: row.tenant_id,
              relevance_score: row.relevance_score,
              is_published: row.is_published,
              location_status: row.location_status,
              business_name: row.business_name
            });
          }
          
          return {
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
          businessHours: row.business_hours,
          relevanceScore: row.relevance_score || 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }});

      console.log(`[Related Stores] Fallback approach found ${relatedListings.length} stores with score >= 1`);
    }

    // Ensure at least 1 store is always shown
    if (relatedListings.length === 0) {
      console.log(`[Related Stores] No stores found with minimum score, trying fallback to show at least 1 store`);

      // Fallback: Show featured stores in the same state (if any)
      const fallbackFeaturedQuery = `
        SELECT dll.*,
          0.5 as relevance_score
        FROM directory_listings_list dll
        INNER JOIN tenants t ON dll.tenant_id = t.id
        WHERE dll.slug != $1
          AND dll.is_published = true
          AND dll.location_status = 'active'
          AND t.location_status IN ('active', 'inactive', 'closed')
          AND dll.state = $2
          AND dll.is_featured = true
          AND (dll.business_hours IS NULL OR dll.business_hours::text != 'null')
        ORDER BY dll.rating_avg DESC, dll.product_count DESC
        LIMIT 3
      `;

      const fallbackResult = await getDirectPool().query(fallbackFeaturedQuery, [slug, current.state]);
      if (fallbackResult.rows.length > 0) {
        relatedListings = fallbackResult.rows.slice(0, limit).map((row: any) => ({
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
          relevanceScore: row.relevance_score || 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
        console.log(`[Related Stores] Fallback found ${relatedListings.length} featured stores in same state`);
      }

      // If still no stores, show any active stores in the same state
      if (relatedListings.length === 0) {
        const finalFallbackQuery = `
          SELECT dll.*,
            0.1 as relevance_score
          FROM directory_listings_list dll
          INNER JOIN tenants t ON dll.tenant_id = t.id
          WHERE dll.slug != $1
            AND dll.is_published = true
            AND dll.location_status = 'active'
            AND t.location_status IN ('active', 'inactive', 'closed')
            AND dll.state = $2
            AND (dll.business_hours IS NULL OR dll.business_hours::text != 'null')
          ORDER BY dll.rating_avg DESC, dll.product_count DESC
          LIMIT 1
        `;

        const finalResult = await getDirectPool().query(finalFallbackQuery, [slug, current.state]);
        if (finalResult.rows.length > 0) {
          relatedListings = finalResult.rows.map((row: any) => ({
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
            relevanceScore: row.relevance_score || 0,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
          console.log(`[Related Stores] Final fallback found ${relatedListings.length} active stores in same state`);
        }
      }
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
