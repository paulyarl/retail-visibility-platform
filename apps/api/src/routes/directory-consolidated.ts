/**
 * Directory Consolidated API Routes
 * Optimized endpoint that returns all data needed for directory page in a single request
 * Reduces multiple API calls to one consolidated endpoint
 */

import { Router, Request, Response } from 'express';
import { getDirectPool } from '../utils/db-pool';

const router = Router();

/**
 * GET /api/directory/consolidated/:slug
 * 
 * Consolidated endpoint that returns all directory page data in a single request
 * Replaces multiple individual API calls with one optimized endpoint
 * 
 * Returns:
 * - Store listing data
 * - Featured products
 * - Store types
 * - Category counts
 * - Recommendations
 * - Payment gateway status
 */
router.get('/consolidated/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const pool = getDirectPool();

    // Start all queries in parallel
    const [
      listingResult,
      featuredProductsResult,
      storeTypesResult,
      categoryCountsResult,
      recommendationsResult,
      lastViewedResult
    ] = await Promise.allSettled([
      // 1. Store listing data
      pool.query(
        `SELECT 
          dll.id,
          dll.tenant_id,
          dll.business_name,
          dll.slug,
          dll.address,
          dll.city,
          dll.state,
          dll.zip_code,
          dll.phone,
          dll.email,
          dll.website,
          dll.latitude,
          dll.longitude,
          dll.primary_category,
          dll.secondary_categories,
          dll.logo_url,
          dll.description,
          dll.business_hours,
          dll.rating_avg,
          dll.rating_count,
          dll.product_count,
          dll.is_featured,
          dll.subscription_tier,
          dll.use_custom_website,
          dll.is_published,
          dll.created_at,
          dll.updated_at,
          dll.keywords
         FROM directory_listings_list dll
         WHERE dll.slug = $1 AND dll.is_published = true
         LIMIT 1`,
        [slug]
      ),

      // 2. Featured products from materialized view
      pool.query(
        `SELECT 
          id,
          tenant_id,
          sku,
          name,
          title,
          description,
          price,
          price_cents,
          currency,
          stock,
          quantity,
          availability,
          image_url,
          image_gallery,
          brand,
          manufacturer,
          condition,
          gtin,
          mpn,
          metadata,
          custom_cta,
          social_links,
          landing_page_theme,
          category_id,
          category_name,
          category_slug,
          is_featured,
          featured_at,
          featured_until,
          featured_priority,
          is_actively_featured,
          has_image,
          in_stock,
          has_gallery,
          created_at,
          updated_at
        FROM storefront_products
        WHERE tenant_id = (SELECT tenant_id FROM directory_listings_list WHERE slug = $1 AND is_published = true LIMIT 1)
          AND is_actively_featured = true
        ORDER BY featured_priority DESC, featured_at DESC
        LIMIT 6`,
        [slug]
      ),

      // 3. Store types
      (async () => {
        const { storeTypeDirectoryService } = await import('../services/store-type-directory.service');
        return await storeTypeDirectoryService.getStoreTypes();
      })(),

      // 4. Category counts
      pool.query(
        `SELECT 
          category_name,
          COUNT(*) as store_count
        FROM directory_listings_list
        WHERE is_published = true AND category_name IS NOT NULL
        GROUP BY category_name
        ORDER BY store_count DESC, category_name ASC`,
        []
      ),

      // Note: Recommendations and last viewed are fetched separately by the frontend
      // since they require user/session context that isn't available in this endpoint
      Promise.resolve({ rows: [] }), // Placeholder for consistency
      Promise.resolve({ rows: [] })  // Placeholder for consistency
    ]);

    // Process results
    const listing = listingResult.status === 'fulfilled' && listingResult.value.rows.length > 0 
      ? listingResult.value.rows[0] 
      : null;

    const featuredProducts = featuredProductsResult.status === 'fulfilled' 
      ? featuredProductsResult.value.rows 
      : [];

    const storeTypes = storeTypesResult.status === 'fulfilled' 
      ? storeTypesResult.value 
      : [];

    const categoryCounts = categoryCountsResult.status === 'fulfilled' 
      ? categoryCountsResult.value.rows 
      : [];

    const recommendations = recommendationsResult.status === 'fulfilled' 
      ? recommendationsResult.value.rows 
      : [];

    const lastViewed = lastViewedResult.status === 'fulfilled' 
      ? lastViewedResult.value.rows 
      : [];

    // Debug logging
    console.log('[Directory Consolidated] Results:', {
      slug,
      listingFound: !!listing,
      tenantId: listing?.tenant_id,
      featuredProductsCount: featuredProducts.length,
      storeTypesCount: Array.isArray(storeTypes) ? storeTypes.length : 0,
      categoryCountsCount: categoryCounts.length,
      featuredProductsStatus: featuredProductsResult.status,
      featuredProductsError: featuredProductsResult.status === 'rejected' ? featuredProductsResult.reason : null
    });

    // Transform categories like the original endpoint
    const categories = [];
    
    if (listing?.primary_category) {
      try {
        let primary;
        if (typeof listing.primary_category === 'string') {
          try {
            primary = JSON.parse(listing.primary_category);
          } catch {
            primary = { name: listing.primary_category };
          }
        } else {
          primary = listing.primary_category;
        }
        
        if (primary && primary.name) {
          const slug = primary.id 
            ? primary.id.replace('gcid:', '').replace(/_/g, '-')
            : primary.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
          
          categories.push({
            id: primary.id || `gcid:${slug}`,
            name: primary.name,
            slug: slug,
            isPrimary: true
          });
        }
      } catch (e) {
        console.error('[Directory Consolidated] Error parsing primary category:', e);
      }
    }
    
    if (listing?.secondary_categories) {
      try {
        let secondary;
        if (typeof listing.secondary_categories === 'string') {
          try {
            secondary = JSON.parse(listing.secondary_categories);
          } catch {
            secondary = [listing.secondary_categories];
          }
        } else {
          secondary = listing.secondary_categories;
        }
        
        if (Array.isArray(secondary)) {
          secondary.forEach((cat: any) => {
            const categoryData = typeof cat === 'string' ? { name: cat } : cat;
            
            if (categoryData && categoryData.name) {
              const slug = categoryData.id 
                ? categoryData.id.replace('gcid:', '').replace(/_/g, '-')
                : categoryData.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
              
              categories.push({
                id: categoryData.id || `gcid:${slug}`,
                name: categoryData.name,
                slug: slug,
                isPrimary: false
              });
            }
          });
        }
      } catch (e) {
        console.error('[Directory Consolidated] Error parsing secondary categories:', e);
      }
    }

    // Transform the listing to match expected response format
    const transformedListing = listing ? {
      id: listing.id,
      tenantId: listing.tenant_id,
      businessName: listing.business_name,
      slug: listing.slug,
      address: listing.address,
      city: listing.city,
      state: listing.state,
      zipCode: listing.zip_code,
      phone: listing.phone,
      email: listing.email,
      website: listing.website,
      latitude: listing.latitude,
      longitude: listing.longitude,
      primaryCategory: listing.primary_category,
      secondaryCategories: listing.secondary_categories,
      logoUrl: listing.logo_url,
      description: listing.description,
      businessHours: listing.business_hours,
      ratingAvg: listing.rating_avg,
      ratingCount: listing.rating_count,
      productCount: listing.product_count,
      isFeatured: listing.is_featured,
      subscriptionTier: listing.subscription_tier,
      useCustomWebsite: listing.use_custom_website,
      isPublished: listing.is_published,
      createdAt: listing.created_at,
      updatedAt: listing.updated_at,
      keywords: listing.keywords,
      categories: categories
    } : null;

    // Check payment gateway status
    let paymentGatewayStatus = { hasActiveGateway: false, defaultGatewayType: null };
    if (listing?.tenant_id) {
      try {
        const gatewayResult = await pool.query(
          `SELECT gateway_type FROM tenant_payment_gateways 
           WHERE tenant_id = $1 AND is_active = true 
           ORDER BY is_default DESC, created_at DESC 
           LIMIT 1`,
          [listing.tenant_id]
        );
        
        if (gatewayResult.rows.length > 0) {
          paymentGatewayStatus = {
            hasActiveGateway: true,
            defaultGatewayType: gatewayResult.rows[0].gateway_type
          };
        }
      } catch (error) {
        console.error('[Directory Consolidated] Error checking payment gateway:', error);
      }
    }

    res.json({
      success: true,
      data: {
        listing: transformedListing,
        featuredProducts,
        storeTypes,
        categoryCounts,
        recommendations,
        lastViewed,
        paymentGatewayStatus,
        // Include metadata for debugging
        meta: {
          timestamp: new Date().toISOString(),
          requestsProcessed: {
            listing: listingResult.status,
            featuredProducts: featuredProductsResult.status,
            storeTypes: storeTypesResult.status,
            categoryCounts: categoryCountsResult.status,
            recommendations: recommendationsResult.status,
            lastViewed: lastViewedResult.status
          }
        }
      }
    });
  } catch (error: any) {
    console.error('[Directory Consolidated] Error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_fetch_consolidated_data',
      message: error?.message
    });
  }
});

export default router;
