/**
 * Recommendation API Routes
 * MVP Recommendation System
 */

import { Router, Request, Response } from 'express';
import { getDirectPool } from '../utils/db-pool';
import {
  getStoresViewedBySameUsers,
  getPopularStoresInCategory,
  getTrendingNearby,
  trackUserBehavior,
  getProductsViewedBySameUsers,
  getStoresInUserFavoriteCategories,
  getSimilarStoresInCategory
} from '../services/recommendationService';

const router = Router();

/**
 * POST /api/recommendations/track
 * Track user behavior for recommendations
 */
router.post('/track', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      sessionId,
      entityType = 'store',
      entityId,
      locationLat,
      locationLng,
      referrer,
      userAgent,
      ipAddress
    } = req.body;

    if (!entityId) {
      return res.status(400).json({
        error: 'entity_id_required',
        message: 'Entity ID is required for tracking'
      });
    }

    await trackUserBehavior({
      userId,
      sessionId,
      entityType,
      entityId,
      locationLat,
      locationLng,
      referrer,
      userAgent,
      ipAddress
    });

    res.json({ success: true, tracked: true });

  } catch (error) {
    console.error('Error tracking behavior:', error);
    res.status(500).json({
      error: 'tracking_failed',
      message: 'Failed to track user behavior'
    });
  }
});

/**
 * GET /api/recommendations/stores-like-this/:storeId
 * Get stores viewed by users who also viewed this store
 */
router.get('/stores-like-this/:storeId', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { userId } = req.query;
    const { limit = 3 } = req.query;

    const result = await getStoresViewedBySameUsers(
      storeId,
      userId as string,
      Math.min(Math.max(Number(limit), 1), 10)
    );

    res.json(result);

  } catch (error) {
    console.error('Error getting stores like this:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get store recommendations'
    });
  }
});

/**
 * GET /api/recommendations/popular-in-category/:categorySlug
 * Get popular stores in the same category
 */
router.get('/popular-in-category/:categorySlug', async (req: Request, res: Response) => {
  try {
    const { categorySlug } = req.params;
    const { lat, lng, limit = 3 } = req.query;

    const result = await getPopularStoresInCategory(
      categorySlug,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
      Math.min(Math.max(Number(limit), 1), 10)
    );

    res.json(result);

  } catch (error) {
    console.error('Error getting popular stores in category:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get category recommendations'
    });
  }
});

/**
 * GET /api/recommendations/trending-nearby
 * Get trending stores near user location
 */
router.get('/trending-nearby', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = 25, days = 7, limit = 3 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: 'location_required',
        message: 'Latitude and longitude are required for nearby recommendations'
      });
    }

    const result = await getTrendingNearby(
      Number(lat),
      Number(lng),
      Math.min(Math.max(Number(radius), 1), 100), // 1-100 mile radius
      Math.min(Math.max(Number(days), 1), 30), // 1-30 days
      Math.min(Math.max(Number(limit), 1), 10) // 1-10 results
    );

    res.json(result);

  } catch (error) {
    console.error('Error getting trending nearby:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get nearby recommendations'
    });
  }
});

/**
 * GET /api/recommendations/products-like-this/:productId
 * Get products viewed by users who also viewed this product
 */
router.get('/products-like-this/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { userId } = req.query;
    const { limit = 3 } = req.query;

    const result = await getProductsViewedBySameUsers(
      productId,
      userId as string,
      Math.min(Math.max(Number(limit), 1), 10)
    );

    res.json(result);

  } catch (error) {
    console.error('Error getting products like this:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get product recommendations'
    });
  }
});

/**
 * GET /api/recommendations/stores-for-user
 * Get stores in user's favorite categories
 */
router.get('/stores-for-user', async (req: Request, res: Response) => {
  try {
    const { userId, lat, lng, limit = 3 } = req.query;

    if (!userId) {
      return res.status(400).json({
        error: 'user_id_required',
        message: 'User ID is required for personalized recommendations'
      });
    }

    const result = await getStoresInUserFavoriteCategories(
      userId as string,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
      Math.min(Math.max(Number(limit), 1), 10)
    );

    res.json(result);

  } catch (error) {
    console.error('Error getting stores for user:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get user recommendations'
    });
  }
});

/**
 * GET /api/recommendations/for-product/:productId
 * Get all recommendations for a product page
 */
router.get('/for-product/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { userId, lat, lng, tenantId, categorySlug } = req.query;

    const recommendations = [];

    // 1. Products like this (always included)
    const productsLikeThis = await getProductsViewedBySameUsers(
      productId,
      userId as string,
      3
    );
    if (productsLikeThis.recommendations.length > 0) {
      recommendations.push({
        type: 'products_like_this',
        title: 'Products Like This You Viewed',
        ...productsLikeThis
      });
    }

    // 2. Popular in category (if category provided)
    if (categorySlug) {
      const popularInCategory = await getPopularStoresInCategory(
        categorySlug as string,
        lat ? Number(lat) : undefined,
        lng ? Number(lng) : undefined,
        3
      );
      if (popularInCategory.recommendations.length > 0) {
        recommendations.push({
          type: 'popular_in_category',
          title: `Popular ${(categorySlug as string).replace('-', ' ')}`,
          ...popularInCategory
        });
      }
    }

    // 3. Trending nearby (if location provided)
    if (lat && lng) {
      const trendingNearby = await getTrendingNearby(
        Number(lat),
        Number(lng),
        25,
        7,
        3
      );
      if (trendingNearby.recommendations.length > 0) {
        recommendations.push({
          type: 'trending_nearby',
          title: 'Trending Nearby',
          ...trendingNearby
        });
      }
    }

    res.json({
      recommendations,
      productId,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Error getting recommendations for product:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get product recommendations'
    });
  }
});

/**
 * GET /api/recommendations/for-storefront/:tenantId
 * Get recommendations for storefront pages with enhanced filtering
 * Uses same filtering logic as directory related stores (active stores, GBP scoring, category scoring)
 */
router.get('/for-storefront/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { userId, lat, lng } = req.query;
    const limit = 6; // Show up to 6 recommendations on storefront

    console.log(`[Storefront Recommendations] Getting enhanced recommendations for tenant: ${tenantId}`);

    // Import database utility
    const { getDirectPool } = await import('../utils/db-pool');

    // First, get the current store's directory listing for scoring
    const currentListing = await getDirectPool().query(
      `SELECT 
         dcl.tenant_id,
         dcl.business_name,
         dcl.slug,
         dcl.address,
         dcl.city,
         dcl.state,
         dcl.zip_code,
         dcl.category_id,
         dcl.category_name,
         dcl.category_slug,
         dcl.google_category_id,
         dcl.gbp_primary_category_name,
         dcl.is_primary,
         dcl.rating_avg,
         dcl.rating_count,
         dcl.product_count,
         dcl.logo_url,
         t.location_status as tenant_location_status
       FROM directory_category_listings dcl
       INNER JOIN tenants t ON dcl.tenant_id = t.id
       WHERE dcl.tenant_id = $1 
         AND dcl.is_primary = true
       LIMIT 1`,
      [tenantId]
    );

    if (currentListing.rows.length === 0) {
      // If no directory listing, fall back to basic recommendations
      console.log(`[Storefront Recommendations] No directory listing found, using basic fallback`);
      const similarStores = await getSimilarStoresInCategory(tenantId, limit);
      
      return res.json({
        recommendations: similarStores.recommendations.length > 0 ? [{
          type: 'similar_stores',
          title: 'You Might Also Like',
          recommendations: similarStores.recommendations
        }] : [],
        tenantId,
        generatedAt: new Date()
      });
    }

    const current = currentListing.rows[0];
    let relatedListings = [];

    // Helper function to generate reason text
    const getReasonText = (score: number, categoryMatch: boolean, targetCity: string, storeCity: string, targetState: string, storeState: string) => {
      if (categoryMatch && storeCity === targetCity) {
        return `Same category in ${storeCity}`;
      } else if (categoryMatch) {
        return `Same category`;
      } else if (storeCity === targetCity) {
        return `Nearby in ${storeCity}`;
      } else if (storeState === targetState) {
        return `In ${storeState}`;
      }
      return 'Similar store';
    };

    try {
      // Use directory_category_listings MV for recommendations but get REAL product counts
      const relatedQuery = `
        SELECT DISTINCT ON (dcl.tenant_id)
          dcl.tenant_id,
          dcl.business_name,
          dcl.slug,
          dcl.address,
          dcl.city,
          dcl.state,
          dcl.zip_code,
          dcl.category_id,
          dcl.category_name,
          dcl.category_slug,
          dcl.google_category_id,
          dcl.gbp_primary_category_name,
          dcl.is_primary,
          dcl.rating_avg,
          dcl.rating_count,
          dcl.logo_url,
          dcl.is_featured,
          dll.business_hours,
          t.location_status as tenant_location_status,
          
          -- Get ACTUAL product count from inventory_items table
          COALESCE((
            SELECT COUNT(*)
            FROM inventory_items ii
            WHERE ii.tenant_id = dcl.tenant_id
              AND ii.item_status = 'active'
              AND ii.visibility = 'public'
          ), 0) as actual_product_count,
          
          (
            (
              CASE
                WHEN LOWER(dcl.gbp_primary_category_name) = LOWER($7) THEN 4
                WHEN dcl.google_category_id = $6 THEN 3
                WHEN dcl.category_name = $1 THEN 2
                ELSE 0
              END
            ) * 2 +
            (
              CASE
                WHEN dcl.city = $2 AND dcl.state = $3 THEN 2
                WHEN dcl.state = $3 THEN 1
                ELSE 0
              END
            ) +
            (
              CASE
                WHEN ABS(COALESCE(dcl.rating_avg, 0) - $4) < 0.5 THEN 1
                ELSE 0
              END
            )
          ) as relevance_score
        FROM directory_category_listings dcl
        INNER JOIN tenants t ON dcl.tenant_id = t.id
        LEFT JOIN directory_listings_list dll ON dll.tenant_id = dcl.tenant_id
        WHERE dcl.tenant_id != $5
          AND dcl.tenant_exists = true
          AND dcl.is_active_location = true
          AND dcl.is_directory_visible = true
        ORDER BY dcl.tenant_id, relevance_score DESC, dcl.rating_avg DESC NULLS LAST, actual_product_count DESC
      `;

      const related = await getDirectPool().query(relatedQuery, [
        current.category_name,
        current.city,
        current.state,
        current.rating_avg || 0,
        tenantId,
        current.google_category_id,
        current.gbp_primary_category_name
      ]);

      console.log(`[Storefront Recommendations] MV query returned ${related.rows.length} rows`);
      console.log(`[Storefront Recommendations] Current store - Platform Category: ${current.category_name}, GBP Category: ${current.gbp_primary_category_name}, City: ${current.city}, State: ${current.state}`);
      
      // Log all scores for debugging
      related.rows.forEach((row: any, idx: number) => {
        if (idx < 10) { // Only log first 10 to avoid spam
          console.log(`[Storefront Recommendations] Store ${idx + 1}: ${row.business_name} - Platform: ${row.category_name}, GBP: ${row.gbp_primary_category_name}, City: ${row.city}, State: ${row.state}, Score: ${row.relevance_score}`);
        }
      });
      
      // Filter and map results
      relatedListings = related.rows
        .filter((row: any) => (row.relevance_score || 0) > 0)
        .slice(0, limit)
        .map((row: any) => ({
          id: row.tenant_id,
          tenantId: row.tenant_id,
          businessName: row.business_name,
          slug: row.slug,
          address: row.address,
          city: row.city,
          state: row.state,
          primaryCategory: row.category_name,
          logoUrl: row.logo_url,
          ratingAvg: row.rating_avg || 0,
          ratingCount: row.rating_count || 0,
          productCount: row.actual_product_count || 0, // Use actual count from inventory_items
          businessHours: row.business_hours,
          relevanceScore: row.relevance_score || 0,
          reason: getReasonText(
            row.relevance_score, 
            row.category_name === current.category_name || 
            row.google_category_id === current.google_category_id ||
            (row.gbp_primary_category_name && current.gbp_primary_category_name && 
             row.gbp_primary_category_name.toLowerCase() === current.gbp_primary_category_name.toLowerCase()),
            current.city, 
            row.city, 
            current.state, 
            row.state
          )
        }));

      console.log(`[Storefront Recommendations] Found ${relatedListings.length} stores with score > 0 (after filtering from ${related.rows.length} total)`);

    } catch (mvError) {
      console.log(`[Storefront Recommendations] MV approach failed, using fallback:`, mvError);
      
      // Fallback: Same query structure but using actual product counts
      const fallbackQuery = `
        SELECT DISTINCT ON (dcl.tenant_id)
          dcl.tenant_id,
          dcl.business_name,
          dcl.slug,
          dcl.address,
          dcl.city,
          dcl.state,
          dcl.category_name,
          dcl.logo_url,
          dcl.rating_avg,
          dcl.rating_count,
          dll.business_hours,
          t.location_status as tenant_location_status,
          
          -- Get ACTUAL product count from inventory_items table
          COALESCE((
            SELECT COUNT(*)
            FROM inventory_items ii
            WHERE ii.tenant_id = dcl.tenant_id
              AND ii.item_status = 'active'
              AND ii.visibility = 'public'
          ), 0) as actual_product_count,
          
          (
            (
              CASE
                WHEN dcl.category_name = $1 THEN 3
                WHEN dcl.google_category_id = $6 THEN 2
                ELSE 0
              END
            ) * 2 +
            (
              CASE
                WHEN dcl.city = $2 AND dcl.state = $3 THEN 2
                WHEN dcl.state = $3 THEN 1
                ELSE 0
              END
            ) +
            (
              CASE
                WHEN ABS(COALESCE(dcl.rating_avg, 0) - $4) < 0.5 THEN 1
                ELSE 0
              END
            )
          ) as relevance_score
        FROM directory_category_listings dcl
        INNER JOIN tenants t ON dcl.tenant_id = t.id
        LEFT JOIN directory_listings_list dll ON dll.tenant_id = dcl.tenant_id
        WHERE dcl.tenant_id != $5
          AND dcl.tenant_exists = true
          AND dcl.is_active_location = true
          AND dcl.is_directory_visible = true
        ORDER BY dcl.tenant_id, relevance_score DESC, dcl.rating_avg DESC NULLS LAST, actual_product_count DESC
      `;

      const fallbackResult = await getDirectPool().query(fallbackQuery, [
        current.category_name,
        current.city,
        current.state,
        current.rating_avg || 0,
        tenantId,
        current.google_category_id
      ]);

      console.log(`[Storefront Recommendations] Fallback query returned ${fallbackResult.rows.length} rows`);
      
      relatedListings = fallbackResult.rows
        .filter((row: any) => (row.relevance_score || 0) >= 1)
        .slice(0, limit)
        .map((row: any) => ({
          id: row.tenant_id,
          tenantId: row.tenant_id,
          businessName: row.business_name,
          slug: row.slug,
          address: row.address,
          city: row.city,
          state: row.state,
          primaryCategory: row.category_name,
          logoUrl: row.logo_url,
          ratingAvg: row.rating_avg || 0,
          ratingCount: row.rating_count || 0,
          productCount: row.actual_product_count || 0, // Use actual count from inventory_items
          businessHours: row.business_hours,
          relevanceScore: row.relevance_score || 0,
          reason: getReasonText(
            row.relevance_score, 
            row.category_name === current.category_name || 
            row.google_category_id === current.google_category_id ||
            (row.gbp_primary_category_name && current.gbp_primary_category_name && 
             row.gbp_primary_category_name.toLowerCase() === current.gbp_primary_category_name.toLowerCase()),
            current.city, 
            row.city, 
            current.state, 
            row.state
          )
        }));
    }

    // Ensure at least 1 store is always shown (fallback logic)
    if (relatedListings.length === 0) {
      console.log(`[Storefront Recommendations] No stores found with minimum score, trying fallback`);

      // Fallback: Show featured stores in the same state
      const fallbackFeaturedQuery = `
        SELECT DISTINCT ON (dcl.tenant_id)
          dcl.tenant_id,
          dcl.business_name,
          dcl.slug,
          dcl.address,
          dcl.city,
          dcl.state,
          dcl.category_name,
          dcl.logo_url,
          dcl.rating_avg,
          dcl.rating_count,
          dcl.product_count,
          dll.business_hours,
          t.location_status as tenant_location_status,
          0.5 as relevance_score
        FROM directory_category_listings dcl
        INNER JOIN tenants t ON dcl.tenant_id = t.id
        LEFT JOIN directory_listings_list dll ON dll.tenant_id = dcl.tenant_id
        WHERE dcl.tenant_id != $1
          AND dcl.tenant_exists = true
          AND dcl.is_active_location = true
          AND dcl.is_directory_visible = true
          AND dcl.state = $2
          AND dcl.is_featured = true
        ORDER BY dcl.tenant_id, dcl.rating_avg DESC NULLS LAST, dcl.product_count DESC
        LIMIT 3
      `;

      const fallbackResult = await getDirectPool().query(fallbackFeaturedQuery, [tenantId, current.state]);
      if (fallbackResult.rows.length > 0) {
        relatedListings = fallbackResult.rows.slice(0, limit).map((row: any) => ({
          id: row.tenant_id,
          tenantId: row.tenant_id,
          businessName: row.business_name,
          slug: row.slug,
          address: row.address,
          city: row.city,
          state: row.state,
          primaryCategory: row.category_name,
          logoUrl: row.logo_url,
          ratingAvg: row.rating_avg || 0,
          ratingCount: row.rating_count || 0,
          productCount: row.product_count || 0,
          businessHours: row.business_hours,
          relevanceScore: row.relevance_score || 0,
          reason: 'Featured in your area'
        }));
        console.log(`[Storefront Recommendations] Fallback found ${relatedListings.length} featured stores`);
      }

      // If still no stores, show any active stores in the same state
      if (relatedListings.length === 0) {
        const finalFallbackQuery = `
          SELECT DISTINCT ON (dcl.tenant_id)
            dcl.tenant_id,
            dcl.business_name,
            dcl.slug,
            dcl.address,
            dcl.city,
            dcl.state,
            dcl.category_name,
            dcl.logo_url,
            dcl.rating_avg,
            dcl.rating_count,
            dcl.product_count,
            dll.business_hours,
            t.location_status as tenant_location_status,
            0.1 as relevance_score
          FROM directory_category_listings dcl
          INNER JOIN tenants t ON dcl.tenant_id = t.id
          LEFT JOIN directory_listings_list dll ON dll.tenant_id = dcl.tenant_id
          WHERE dcl.tenant_id != $1
            AND dcl.tenant_exists = true
            AND dcl.is_active_location = true
            AND dcl.is_directory_visible = true
            AND dcl.state = $2
          ORDER BY dcl.tenant_id, dcl.rating_avg DESC NULLS LAST, dcl.product_count DESC
          LIMIT 1
        `;

        const finalResult = await getDirectPool().query(finalFallbackQuery, [tenantId, current.state]);
        if (finalResult.rows.length > 0) {
          relatedListings = finalResult.rows.map((row: any) => ({
            id: row.tenant_id,
            tenantId: row.tenant_id,
            businessName: row.business_name,
            slug: row.slug,
            address: row.address,
            city: row.city,
            state: row.state,
            primaryCategory: row.category_name,
            logoUrl: row.logo_url,
            ratingAvg: row.rating_avg || 0,
            ratingCount: row.rating_count || 0,
            productCount: row.product_count || 0,
            businessHours: row.business_hours,
            relevanceScore: row.relevance_score || 0,
            reason: 'Nearby store'
          }));
          console.log(`[Storefront Recommendations] Final fallback found ${relatedListings.length} stores`);
        }
      }
    }

    // Format response for storefront component
    const recommendations = [{
      type: 'enhanced_related',
      title: 'You Might Also Like',
      recommendations: relatedListings
    }];

    res.json({
      recommendations,
      tenantId,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Error getting recommendations for storefront:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get storefront recommendations'
    });
  }
});

/**
 * GET /api/recommendations/for-directory
 * Get recommendations for directory home page
 */
router.get('/for-directory', async (req: Request, res: Response) => {
  try {
    const { userId, lat, lng, categorySlug } = req.query;

    const recommendations = [];

    // 1. User favorite categories (if userId provided)
    if (userId) {
      const userFavorites = await getStoresInUserFavoriteCategories(
        userId as string,
        lat ? Number(lat) : undefined,
        lng ? Number(lng) : undefined,
        5
      );
      if (userFavorites.recommendations.length > 0) {
        recommendations.push({
          type: 'user_favorite_categories',
          title: 'Recommended For You',
          ...userFavorites
        });
      }
    }

    // 2. Popular in category (if category provided)
    if (categorySlug) {
      const popularInCategory = await getPopularStoresInCategory(
        categorySlug as string,
        lat ? Number(lat) : undefined,
        lng ? Number(lng) : undefined,
        5
      );
      if (popularInCategory.recommendations.length > 0) {
        recommendations.push({
          type: 'popular_in_category',
          title: `Popular ${(categorySlug as string).replace('-', ' ')}`,
          ...popularInCategory
        });
      }
    }

    // 3. Trending nearby (if location provided)
    if (lat && lng) {
      const trendingNearby = await getTrendingNearby(
        Number(lat),
        Number(lng),
        25,
        7,
        5
      );
      if (trendingNearby.recommendations.length > 0) {
        recommendations.push({
          type: 'trending_nearby',
          title: 'Trending Nearby',
          ...trendingNearby
        });
      }
    }

    res.json({
      recommendations,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Error getting recommendations for directory:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get directory recommendations'
    });
  }
});

/**
 * GET /api/recommendations/for-product-page/:productId
 * Get recommended products for a product detail page
 * Uses scoring algorithm based on category, brand, price, and tenant
 */
router.get('/for-product-page/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { limit = 6, userId } = req.query;
    const limitNum = Math.min(Math.max(Number(limit), 1), 10);

    console.log(`[Product Recommendations] Getting recommendations for product: ${productId}, limit: ${limitNum}`);

    // First get the current product details
    const currentProductQuery = `
      SELECT ii.*,
        ii.tenant_id,
        ii.category_path,
        ii.directory_category_id,
        ii.price_cents,
        ii.brand,
        ii.item_status,
        ii.visibility
      FROM inventory_items ii
      WHERE ii.id = $1 AND ii.item_status = 'active' AND ii.visibility = 'public'
    `;

    const currentProduct = await getDirectPool().query(currentProductQuery, [productId]);
    if (currentProduct.rows.length === 0) {
      return res.json({
        recommendations: [],
        productId,
        generatedAt: new Date()
      });
    }

    const product = currentProduct.rows[0];

    // Build recommendation scoring query
    const recommendationsQuery = `
      SELECT DISTINCT ON (ii.id)
        ii.id,
        ii.name,
        ii.title,
        ii.price_cents,
        ii.currency,
        ii.image_url,
        ii.brand,
        ii.category_path,
        ii.directory_category_id,
        ii.tenant_id,

        -- Calculate relevance score
        (
          -- Same category (highest priority)
          CASE
            WHEN ii.category_path && $1 THEN 4
            WHEN ii.directory_category_id = $2 THEN 3
            ELSE 0
          END +

          -- Same brand
          CASE
            WHEN LOWER(ii.brand) = LOWER($3) AND ii.brand IS NOT NULL THEN 2
            ELSE 0
          END +

          -- Same tenant (other products from same store)
          CASE
            WHEN ii.tenant_id = $4 THEN 1
            ELSE 0
          END +

          -- Similar price range (±25%)
          CASE
            WHEN ii.price_cents BETWEEN ($5 * 0.75) AND ($5 * 1.25) THEN 1
            ELSE 0
          END +

          -- Image boost (prioritize products with photos)
          CASE
            WHEN ii.image_url IS NOT NULL AND ii.image_url != '' THEN 1.5
            ELSE 0
          END
        ) as relevance_score

      FROM inventory_items ii
      WHERE ii.id != $6  -- Exclude current product
        AND ii.item_status = 'active'
        AND ii.visibility = 'public'
        AND ii.tenant_id IS NOT NULL
        AND ii.price_cents > 0
        AND ii.image_url IS NOT NULL
        AND ii.image_url != ''  -- Hard requirement: must have photo
      ORDER BY ii.id, relevance_score DESC, ii.updated_at DESC
      LIMIT $7
    `;

    const params = [
      product.category_path || [],  // $1
      product.directory_category_id, // $2
      product.brand, // $3
      product.tenant_id, // $4
      product.price_cents, // $5
      productId, // $6
      limitNum // $7
    ];

    const recommendationsResult = await getDirectPool().query(recommendationsQuery, params);

    // Format recommendations for frontend
    const recommendations = recommendationsResult.rows
      .filter((row: any) => (row.relevance_score || 0) > 0)
      .slice(0, limitNum)
      .map((row: any) => ({
        id: row.id,
        name: row.name,
        title: row.title || row.name,
        price: row.price_cents ? row.price_cents / 100 : 0,
        currency: row.currency || 'USD',
        imageUrl: row.image_url,
        brand: row.brand,
        relevanceScore: row.relevance_score || 0,
        tenantId: row.tenant_id
      }));

    console.log(`[Product Recommendations] Found ${recommendations.length} recommendations with score > 0`);

    res.json({
      recommendations,
      productId,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Error getting product recommendations:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get product recommendations'
    });
  }
});
export default router;
