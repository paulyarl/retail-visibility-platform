/**
 * MVP Recommendation Service
 * 
 * Simple but impactful recommendations for store discovery
 * Phase 1: 3 core recommendation types
 */

import { Pool } from 'pg';
import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

export interface Recommendation {
  tenantId: string;
  businessName: string;
  slug: string;
  score: number;
  reason: string;
  address?: string;
  city?: string;
  state?: string;
  distance?: number;

  // Rich product data from mv_storefront_discovery
  productId?: string;
  productName?: string;
  productTitle?: string;
  productDescription?: string;
  productPrice?: number;
  productPriceCents?: number;
  productSalePrice?: number;
  productSalePriceCents?: number;
  productStock?: number;
  productImageUrl?: string;
  productBrand?: string;
  // NEW: Slug registry fields for cross-tenant matching
  productSlug?: string;
  brandNormalized?: string;
  categoryNormalized?: string;
  slugType?: string;
  platformTenantCount?: number;
  platformPurchaseCount?: number;
  productRatingLive?: number;
  productReviewsCountLive?: number;
  productHelpfulCountLive?: number;
  productReviewsApprovedLive?: number;
  productAverageRating?: number;
  productReviewCount?: number;
  storeAverageRating?: number;
  storeReviewCount?: number;
  viewCount?: number;
  uniqueViewers?: number;
  engagementCount?: number;
  conversionCount?: number;
  revenueCents?: number;
  unitsSold?: number;
  wishlistCount?: number;
  shareCount?: number;
  trendingScore?: number;
  priceStatus?: string;
  stockStatus?: string;
  hasImage?: boolean;
  hasGallery?: boolean;
  hasDescription?: boolean;
  hasBrand?: boolean;
  hasPrice?: boolean;
  inStock?: boolean;
  hasActivePaymentGateway?: boolean;
  defaultGatewayType?: string;
  tenantLogoUrl?: string;
  tenantCategory?: string;
  productCategory?: string;
  productCategorySlug?: string;
  featuredType?: string;
  featuredTypeArray?: string[];
  featuredPriority?: number;
  featuredAt?: string;
  isFeaturedActive?: boolean;
  productType?: string;
}

export interface RecommendationResponse {
  recommendations: Recommendation[];
  algorithm: string;
  generatedAt: Date;
}

/**
 * 1. "Stores Like This You Viewed" 
 * Users who viewed this store also viewed these stores
 */
export async function getStoresViewedBySameUsers(
  storeId: string, 
  userId?: string,
  limit: number = 3
): Promise<RecommendationResponse> {
  const pool = getDirectPool();
  
  try {
    let query = `
      WITH same_user_views AS (
        SELECT DISTINCT ub.user_id
        FROM user_behavior_simple ub
        WHERE ub.entity_id::text = $1::text 
          AND ub.entity_type = 'store'
          AND ub.timestamp >= NOW() - INTERVAL '30 days'
    `;
    
    let params: any[] = [storeId];
    
    if (userId) {
      query += ` AND ub.user_id::text = $2::text`;
      params.push(userId);
    }
    
    query += `
      ),
      other_stores_viewed AS (
        SELECT 
          ub.entity_id,
          COUNT(*) as view_count,
          MAX(ub.timestamp) as last_viewed
        FROM user_behavior_simple ub
        JOIN same_user_views suv ON ub.user_id::text = suv.user_id::text
        WHERE ub.entity_id::text != $1::text
          AND ub.entity_type = 'store'
          AND ub.timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY ub.entity_id
        ORDER BY view_count DESC, last_viewed DESC
        LIMIT $${params.length + 1}
      )
      SELECT 
        DISTINCT mgd.tenant_id,
        mgd.tenant_name as business_name,
        mgd.tenant_slug as slug,
        mgd.tenant_address as address,
        mgd.tenant_city as city,
        mgd.tenant_state as state,
        mgd.average_rating as store_average_rating,
        mgd.review_count as store_review_count,
        mgd.view_count,
        mgd.unique_viewers,
        mgd.engagement_count,
        mgd.conversion_count,
        mgd.revenue_cents,
        mgd.units_sold,
        mgd.tenant_logo_url,
        mgd.tenant_category,
        osv.view_count as score
      FROM other_stores_viewed osv
      JOIN mv_storefront_discovery mgd ON osv.entity_id::text = mgd.tenant_id::text
      WHERE mgd.item_status = 'active'
        AND mgd.visibility = 'public'
    `;
    
    params.push(limit);
    const result = await pool.query(query, params);
    
    const recommendations: Recommendation[] = result.rows.map((row: any) => ({
      tenantId: row.tenant_id,
      businessName: row.business_name,
      slug: row.slug,
      score: row.score,
      reason: 'Users who viewed this store also viewed this store',

      // Rich store data from mv_storefront_discovery
      storeAverageRating: typeof row.store_average_rating === 'string' ? parseFloat(row.store_average_rating) : row.store_average_rating,
      storeReviewCount: row.store_review_count,
      viewCount: row.view_count,
      uniqueViewers: row.unique_viewers,
      engagementCount: row.engagement_count,
      conversionCount: row.conversion_count,
      revenueCents: row.revenue_cents,
      unitsSold: row.units_sold,
      tenantLogoUrl: row.tenant_logo_url,
      tenantCategory: row.tenant_category,

      // Store location data
      address: row.address,
      city: row.city,
      state: row.state
    }));

    return {
      recommendations,
      algorithm: 'same_users',
      generatedAt: new Date()
    };

  } catch (error) {
    logger.error('Error in getStoresViewedBySameUsers:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return { recommendations: [], algorithm: 'same_users', generatedAt: new Date() };
  }
}

/**
 * 2. "Popular in This Category"
 * Top-rated stores in same category near user location
 */
export async function getPopularStoresInCategory(
  categorySlug: string,
  userLat?: number,
  userLng?: number,
  limit: number = 3
): Promise<RecommendationResponse> {
  const pool = getDirectPool();
  
  try {
    // Use pre-joined popular_stores_by_category_mv for 8-12x faster queries
    let params: any[] = [categorySlug];
    let orderBy = 'popularity_score DESC, rating_avg DESC';
    
    // Add location filtering if available
    if (userLat && userLng) {
      params.push(userLat, userLng);
      orderBy = `distance ASC, ${orderBy}`;
    }
    
    const query = `
      SELECT 
        tenant_id,
        business_name,
        slug,
        address,
        city,
        state,
        rating_avg,
        rating_count,
        popularity_score,
        ${userLat && userLng ? `
          3959 * ACOS(
            COS(RADIANS($2)) * COS(RADIANS(latitude)) * 
            COS(RADIANS(longitude) - RADIANS($3)) + 
            SIN(RADIANS($2)) * SIN(RADIANS(latitude))
          ) as distance` : 'NULL as distance'}
      FROM popular_stores_by_category_mv
      WHERE category_slug = $1
        ${userLat && userLng ? 'AND latitude IS NOT NULL AND longitude IS NOT NULL' : ''}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1}
    `;
    
    params.push(limit);
    const result = await pool.query(query, params);
        const recommendations: Recommendation[] = result.rows.map((row: any) => {
      // Calculate location-weighted rating if user location is available
      let locationWeightedRating = row.rating_avg || 0;
      if (userLat && userLng && row.distance !== null) {
        // Apply location bonus: closer stores get rating boost
        const distanceMiles = row.distance;
        const locationBonus = Math.max(0, 1 - (distanceMiles / 50)) * 0.5; // 0 to 0.5 bonus
        locationWeightedRating = Math.min(5, (row.rating_avg || 0) + locationBonus);
      }
      
      // Enhanced scoring with popularity score from MV
      const baseScore = row.popularity_score + (locationWeightedRating * 2);
      
      // Apply proximity bonus if user location is available
      let proximityBonus = 0;
      if (userLat && userLng && row.distance !== null) {
        proximityBonus = Math.max(0, 1 - (row.distance / 25)) * 10; // 0 to 10 bonus
      }
      
      const finalScore = baseScore + proximityBonus;
      
      return {
        tenantId: row.tenant_id,
        businessName: row.business_name,
        slug: row.slug,
        score: finalScore,
        reason: `Popular ${categorySlug.replace('-', ' ')}${row.rating_avg ? ` (${row.rating_avg.toFixed(1)}⭐ from ${row.rating_count} reviews)` : ''}`,
        address: row.address,
        city: row.city,
        state: row.state,
        distance: row.distance ? Math.round(row.distance * 10) / 10 : undefined
      };
    });

    return {
      recommendations,
      algorithm: 'popular_category',
      generatedAt: new Date()
    };

  } catch (error) {
    logger.error('Error in getPopularStoresInCategory:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return { recommendations: [], algorithm: 'popular_category', generatedAt: new Date() };
  }
}

/**
 * 3. "Trending Nearby"
 * Most viewed stores in user's area last 7 days
 */
export async function getTrendingNearby(
  userLat: number,
  userLng: number,
  radiusMiles: number = 25,
  days: number = 7,
  limit: number = 3
): Promise<RecommendationResponse> {
  const pool = getDirectPool();
  
  try {
    // Use mv_storefront_discovery for comprehensive store data
    const query = `
      SELECT 
        DISTINCT mgd.tenant_id,
        mgd.tenant_name as business_name,
        mgd.tenant_slug as slug,
        mgd.tenant_address as address,
        mgd.tenant_city as city,
        mgd.tenant_state as state,
        mgd.average_rating as store_average_rating,
        mgd.review_count as store_review_count,
        mgd.view_count,
        mgd.unique_viewers,
        mgd.engagement_count,
        mgd.conversion_count,
        mgd.revenue_cents,
        mgd.units_sold,
        mgd.trending_score,
        mgd.tenant_logo_url,
        mgd.tenant_category,
        ${userLat && userLng ? `
          3959 * ACOS(
            COS(RADIANS(${userLat})) * COS(RADIANS(mgd.tenant_latitude)) * 
            COS(RADIANS(mgd.tenant_longitude) - RADIANS(${userLng})) + 
            SIN(RADIANS(${userLat})) * SIN(RADIANS(mgd.tenant_latitude))
          ) as distance` : 'NULL as distance'}
      FROM mv_storefront_discovery mgd
      WHERE mgd.item_status = 'active'
        AND mgd.visibility = 'public'
        AND mgd.trending_score > 0
        ${userLat && userLng ? `AND mgd.tenant_latitude IS NOT NULL AND mgd.tenant_longitude IS NOT NULL
        AND 3959 * ACOS(
          COS(RADIANS(${userLat})) * COS(RADIANS(mgd.tenant_latitude)) * 
          COS(RADIANS(mgd.tenant_longitude) - RADIANS(${userLng})) + 
          SIN(RADIANS(${userLat})) * SIN(RADIANS(mgd.tenant_latitude))
        ) <= ${radiusMiles}` : ''}
      ORDER BY mgd.trending_score DESC, mgd.view_count DESC
      LIMIT ${limit}
    `;
    
    const result = await pool.query(query);
    
    const recommendations: Recommendation[] = result.rows.map((row: any) => {
      // Calculate location-weighted rating if user location is available
      let locationWeightedRating = (typeof row.store_average_rating === 'string' ? parseFloat(row.store_average_rating) : row.store_average_rating) || 0;
      if (userLat && userLng && row.distance !== null) {
        // Apply location bonus: closer stores get rating boost
        const distanceMiles = row.distance;
        const locationBonus = Math.max(0, 1 - (distanceMiles / 50)) * 0.5; // 0 to 0.5 bonus
        locationWeightedRating = Math.min(5, locationWeightedRating + locationBonus);
      }
      
      // Enhanced scoring with location-weighted ratings
      const baseScore = (row.view_count + (row.unique_viewers * 0.5)) + (locationWeightedRating * 2);
      
      // Apply proximity bonus if user location is available
      let proximityBonus = 0;
      if (userLat && userLng && row.distance !== null) {
        proximityBonus = Math.max(0, 1 - (row.distance / 25)) * 5; // 0 to 5 bonus
      }
      
      const finalScore = baseScore + proximityBonus;
      
      return {
        tenantId: row.tenant_id,
        businessName: row.business_name,
        slug: row.slug,
        score: finalScore,
        reason: `Trending nearby - ${row.view_count} views by ${row.unique_viewers} people${row.store_average_rating ? ` (${locationWeightedRating.toFixed(1)}⭐)` : ''}`,

        // Rich store data from mv_storefront_discovery
        storeAverageRating: typeof row.store_average_rating === 'string' ? parseFloat(row.store_average_rating) : row.store_average_rating,
        storeReviewCount: row.store_review_count,
        viewCount: row.view_count,
        uniqueViewers: row.unique_viewers,
        engagementCount: row.engagement_count,
        conversionCount: row.conversion_count,
        revenueCents: row.revenue_cents,
        unitsSold: row.units_sold,
        tenantLogoUrl: row.tenant_logo_url,
        tenantCategory: row.tenant_category,

        // Store location data
        address: row.address,
        city: row.city,
        state: row.state,
        distance: row.distance ? Math.round(row.distance * 10) / 10 : undefined
      };
    });

    return {
      recommendations,
      algorithm: 'trending_nearby',
      generatedAt: new Date()
    };

  } catch (error) {
    logger.error('Error in getTrendingNearby:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return { recommendations: [], algorithm: 'trending_nearby', generatedAt: new Date() };
  }
}

/**
 * Track user behavior for recommendations
 * Now supports multiple entity types and page types
 * 
 * Auth0 Integration:
 * - userId: Server-determined from Auth0 session (null if anonymous)
 * - sessionId: Server-determined (always present)
 * - isAuthenticated: Whether user is authenticated via Auth0
 */
export async function trackUserBehavior({
  userId,
  sessionId,
  isAuthenticated, // Auth0 auth status
  entityType, // 'store', 'product', 'category', 'search'
  entityId,
  entityName,
  context, // Additional context like category_id for products
  locationLat,
  locationLng,
  referrer,
  userAgent,
  ipAddress,
  pageType, // 'directory_detail', 'product_page', 'storefront', 'directory_home'
  durationSeconds
}: {
  userId?: string | null;
  sessionId?: string;
  isAuthenticated?: boolean;
  entityType: string;
  entityId: string;
  entityName?: string;
  context?: any;
  locationLat?: number;
  locationLng?: number;
  referrer?: string;
  userAgent?: string;
  ipAddress?: string;
  pageType?: string;
  durationSeconds?: number;
}): Promise<void> {
  const pool = getDirectPool();
  
  try {
    // entity_id is TEXT column - supports both UUIDs and text slugs
    const query = `
      INSERT INTO user_behavior_simple (
        user_id, session_id, is_authenticated, entity_type, entity_id, entity_name, context,
        location_lat, location_lng, referrer, user_agent, ip_address, 
        duration_seconds, page_type
      ) VALUES ($1, $2, $3, $4::text, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT DO NOTHING
    `;
    
    // Use actual entity_id for tracking
    const actualEntityId = entityId;
    
    const queryParams = [
      userId || null,
      sessionId || null,
      isAuthenticated || false,
      entityType,
      actualEntityId,
      entityName || null,
      context ? JSON.stringify(context) : null,
      locationLat ? locationLat.toString() : null,
      locationLng ? locationLng.toString() : null,
      referrer || null,
      userAgent || null,
      ipAddress || null,
      durationSeconds ? durationSeconds.toString() : null,
      pageType ? pageType.toString() : null
    ];
    
    await pool.query(query, queryParams);

  } catch (error) {
    logger.error('Error tracking user behavior:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    // Don't throw - tracking failures shouldn't break the app
  }
}

/**
 * NEW: Get products viewed by users who viewed this product
 */
export async function getProductsViewedBySameUsers(
  productId: string, 
  userId?: string,
  limit: number = 3
): Promise<RecommendationResponse> {
  const pool = getDirectPool();
  
  try {
    const query = `
      WITH same_user_views AS (
        SELECT DISTINCT ub.user_id
        FROM user_behavior_simple ub
        WHERE ub.entity_id = $1 
          AND ub.entity_type = 'product'
          AND ub.timestamp >= NOW() - INTERVAL '30 days'
          ${userId ? 'AND ub.user_id = $2' : ''}
      ),
      other_products_viewed AS (
        SELECT 
          ub.entity_id,
          ub.entity_name,
          COUNT(*) as view_count,
          MAX(ub.timestamp) as last_viewed
        FROM user_behavior_simple ub
        JOIN same_user_views suv ON ub.user_id = suv.user_id
        WHERE ub.entity_id != $1 
          AND ub.entity_type = 'product'
          AND ub.timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY ub.entity_id, ub.entity_name
        ORDER BY view_count DESC, last_viewed DESC
        LIMIT $3
      )
      SELECT
        mgd.inventory_item_id as product_id,
        mgd.product_name,
        mgd.product_title,
        mgd.product_description,
        mgd.sku,
        mgd.current_price_cents as product_price_cents,
        mgd.sale_price_cents as product_sale_price_cents,
        mgd.stock as product_stock,
        mgd.image_url as product_image_url,
        mgd.brand as product_brand,
        -- NEW: Slug registry fields for cross-tenant matching
        mgd.product_slug,
        mgd.brand_normalized,
        mgd.category_normalized,
        mgd.slug_type,
        mgd.platform_tenant_count,
        mgd.platform_purchase_count,
        mgd.product_rating_live,
        mgd.product_reviews_count_live,
        mgd.product_helpful_count_live,
        mgd.product_reviews_approved_live,
        mgd.product_average_rating,
        mgd.product_review_count,
        mgd.average_rating as store_average_rating,
        mgd.review_count as store_review_count,
        mgd.view_count,
        mgd.unique_viewers,
        mgd.engagement_count,
        mgd.conversion_count,
        mgd.revenue_cents,
        mgd.units_sold,
        mgd.wishlist_count,
        mgd.share_count,
        mgd.trending_score,
        mgd.price_status,
        mgd.stock_status,
        mgd.has_image,
        mgd.has_gallery,
        mgd.has_description,
        mgd.has_brand,
        mgd.has_price,
        mgd.in_stock,
        mgd.has_active_payment_gateway,
        mgd.default_gateway_type,
        mgd.tenant_name,
        mgd.tenant_logo_url,
        mgd.shop_category,
        mgd.product_category,
        mgd.product_category_slug,
        mgd.featured_type,
        mgd.featured_priority,
        mgd.featured_at,
        mgd.featured_is_active,
        mgd.product_type,
        mgd.tenant_id,
        mgd.tenant_name as business_name,
        mgd.tenant_slug as slug,
        mgd.tenant_address as address,
        mgd.tenant_city as city,
        mgd.tenant_state as state,
        opv.view_count as score
      FROM other_products_viewed opv
      JOIN mv_storefront_discovery mgd ON opv.entity_id::text = mgd.inventory_item_id::text
      WHERE mgd.item_status = 'active'
        AND mgd.visibility = 'public'
        AND mgd.has_active_payment_gateway = true
    `;
    
    const params = userId ? [productId, userId, limit] : [productId, limit];
    const result = await pool.query(query, params);
    
    const recommendations: Recommendation[] = result.rows.map((row: any) => ({
      tenantId: row.tenant_id,
      businessName: row.business_name,
      slug: row.slug,
      score: row.score,
      reason: 'Users who viewed this product also viewed this',

      // Rich product data from mv_storefront_discovery
      productId: row.product_id,
      productName: row.product_name,
      productTitle: row.product_title,
      productDescription: row.product_description,
      productSku: row.sku,
      productPrice: row.product_price_cents ? row.product_price_cents / 100 : undefined,
      productPriceCents: row.product_price_cents,
      productSalePrice: row.product_sale_price_cents ? row.product_sale_price_cents / 100 : undefined,
      productSalePriceCents: row.product_sale_price_cents,
      productStock: row.product_stock,
      productImageUrl: row.product_image_url,
      productBrand: row.product_brand,
      // NEW: Slug registry fields
      productSlug: row.product_slug,
      brandNormalized: row.brand_normalized,
      categoryNormalized: row.category_normalized,
      slugType: row.slug_type,
      platformTenantCount: row.platform_tenant_count,
      platformPurchaseCount: row.platform_purchase_count,
      productRatingLive: typeof row.product_rating_live === 'string' ? parseFloat(row.product_rating_live) : row.product_rating_live,
      productReviewsCountLive: row.product_reviews_count_live,
      productHelpfulCountLive: row.product_helpful_count_live,
      productReviewsApprovedLive: row.product_reviews_approved_live,
      productAverageRating: typeof row.product_average_rating === 'string' ? parseFloat(row.product_average_rating) : row.product_average_rating,
      productReviewCount: row.product_review_count,
      storeAverageRating: typeof row.store_average_rating === 'string' ? parseFloat(row.store_average_rating) : row.store_average_rating,
      storeReviewCount: row.store_review_count,
      viewCount: row.view_count,
      uniqueViewers: row.unique_viewers,
      engagementCount: row.engagement_count,
      conversionCount: row.conversion_count,
      revenueCents: row.revenue_cents,
      unitsSold: row.units_sold,
      wishlistCount: row.wishlist_count,
      shareCount: row.share_count,
      trendingScore: typeof row.trending_score === 'string' ? parseFloat(row.trending_score) : row.trending_score,
      priceStatus: row.price_status,
      stockStatus: row.stock_status,
      hasImage: row.has_image,
      hasGallery: row.has_gallery,
      hasDescription: row.has_description,
      hasBrand: row.has_brand,
      hasPrice: row.has_price,
      inStock: row.in_stock,
      hasActivePaymentGateway: row.has_active_payment_gateway,
      defaultGatewayType: row.default_gateway_type,
      tenantLogoUrl: row.tenant_logo_url,
      tenantCategory: row.shop_category,
      productCategory: row.product_category,
      productCategorySlug: row.product_category_slug,
      featuredType: row.featured_type,
      featuredTypeArray: row.featured_type ? [row.featured_type] : [],
      featuredPriority: row.featured_priority,
      featuredAt: row.featured_at,
      isFeaturedActive: row.featured_is_active,
      productType: row.product_type || 'physical',

      // Store location data
      address: row.address,
      city: row.city,
      state: row.state
    }));

    return {
      recommendations,
      algorithm: 'same_users_products',
      generatedAt: new Date()
    };

  } catch (error) {
    logger.error('Error in getProductsViewedBySameUsers:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return { recommendations: [], algorithm: 'same_users_products', generatedAt: new Date() };
  }
}

/**
 * NEW: Get stores in categories user frequently browses
 * Enhanced: Now considers both category browsing time and store type preferences
 */
export async function getStoresInUserFavoriteCategories(
  userId: string,
  userLat?: number,
  userLng?: number,
  limit: number = 3
): Promise<RecommendationResponse> {
  const pool = getDirectPool();
  
  try {
    // Use pre-aggregated user_favorite_categories_mv for 8-12x faster queries
    const query = `
      SELECT 
        psm.tenant_id,
        psm.business_name,
        psm.slug,
        psm.address,
        psm.city,
        psm.state,
        psm.rating_avg,
        psm.rating_count,
        psm.popularity_score,
        ufm.category_slug,
        ufm.category_name,
        ufm.visit_count,
        ufm.engagement_score,
        ufm.category_rank,
        ${userLat && userLng ? `
          3959 * ACOS(
            COS(RADIANS($2)) * COS(RADIANS(psm.latitude)) * 
            COS(RADIANS(psm.longitude) - RADIANS($3)) + 
            SIN(RADIANS($2)) * SIN(RADIANS(psm.latitude))
          ) as distance` : 'NULL as distance'}
      FROM user_favorite_categories_mv ufm
      JOIN popular_stores_by_category_mv psm ON ufm.category_slug = psm.category_slug
      WHERE ufm.user_id = $1
        AND ufm.category_rank <= 5
        ${userLat && userLng ? 'AND psm.latitude IS NOT NULL AND psm.longitude IS NOT NULL' : ''}
      ORDER BY 
        ufm.engagement_score DESC,
        psm.popularity_score DESC,
        psm.rating_avg DESC
      LIMIT $${userLat && userLng ? '4' : '2'}
    `;
    
    const params = userLat && userLng ? 
      [userId, userLat, userLng, limit] : 
      [userId, limit];
    
    const result = await pool.query(query, params);
    
    const recommendations: Recommendation[] = result.rows.map((row: any) => {
      // Calculate location-weighted rating if user location is available
      let locationWeightedRating = row.rating_avg || 0;
      if (userLat && userLng && row.distance !== null) {
        // Apply location bonus: closer stores get rating boost
        const distanceMiles = row.distance;
        const locationBonus = Math.max(0, 1 - (distanceMiles / 50)) * 0.5; // 0 to 0.5 bonus
        locationWeightedRating = Math.min(5, (row.rating_avg || 0) + locationBonus);
      }
      
      // Enhanced scoring with engagement and popularity from MVs
      const baseScore = (row.engagement_score * 2) + 
                       (row.popularity_score * 1.5) + 
                       (locationWeightedRating * 2);
      
      // Apply proximity bonus if user location is available
      let proximityBonus = 0;
      if (userLat && userLng && row.distance !== null) {
        proximityBonus = Math.max(0, 1 - (row.distance / 25)) * 10; // 0 to 10 bonus
      }
      
      const finalScore = baseScore + proximityBonus;
      
      return {
        tenantId: row.tenant_id,
        businessName: row.business_name,
        slug: row.slug,
        score: finalScore,
        reason: `Based on your interest in ${row.category_name} (${row.visit_count} visits)${row.rating_avg ? ` - ${row.rating_avg.toFixed(1)}⭐` : ''}`,
        address: row.address,
        city: row.city,
        state: row.state,
        distance: row.distance ? Math.round(row.distance * 10) / 10 : undefined
      };
    });

    return {
      recommendations,
      algorithm: 'user_favorite_categories_enhanced',
      generatedAt: new Date()
    };

  } catch (error) {
    logger.error('Error in getStoresInUserFavoriteCategories:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return { recommendations: [], algorithm: 'user_favorite_categories_enhanced', generatedAt: new Date() };
  }
}

/**
 * Fallback: Get similar stores in the same category as this store
 * Uses GBP categories (primary and secondary) for better matching
 */
export async function getSimilarStoresInCategory(
  storeId: string,
  limit: number = 3
): Promise<RecommendationResponse> {
  const pool = getDirectPool();
  
  try {
    // Get stores that share GBP categories with this store
    // Primary category matches score higher (10 pts) than secondary (5 pts)
    const query = `
      WITH source_store AS (
        SELECT city, state FROM directory_listings_list WHERE tenant_id = $1
      ),
      source_primary_category AS (
        -- Source store's primary GBP category
        SELECT gbp.gbp_category_id as category_id
        FROM tenant_business_profiles_list gbp
        WHERE gbp.tenant_id = $1
          AND gbp.gbp_category_id IS NOT NULL
      ),
      source_secondary_categories AS (
        -- Source store's secondary GBP categories
        SELECT tgc.gbp_category_id as category_id
        FROM tenant_gbp_categories tgc
        WHERE tgc.tenant_id = $1
      ),
      matching_tenants AS (
        -- Primary-to-Primary match (highest score: 10)
        SELECT 
          gbp.tenant_id,
          10 as match_score,
          'primary_match' as match_type
        FROM tenant_business_profiles_list gbp
        JOIN source_primary_category spc ON gbp.gbp_category_id = spc.category_id
        WHERE gbp.tenant_id != $1
        
        UNION ALL
        
        -- Primary-to-Secondary match (medium score: 7)
        SELECT 
          tgc.tenant_id,
          7 as match_score,
          'primary_to_secondary' as match_type
        FROM tenant_gbp_categories tgc
        JOIN source_primary_category spc ON tgc.gbp_category_id = spc.category_id
        WHERE tgc.tenant_id != $1
        
        UNION ALL
        
        -- Secondary-to-Primary match (medium score: 7)
        SELECT 
          gbp.tenant_id,
          7 as match_score,
          'secondary_to_primary' as match_type
        FROM tenant_business_profiles_list gbp
        JOIN source_secondary_categories ssc ON gbp.gbp_category_id = ssc.category_id
        WHERE gbp.tenant_id != $1
        
        UNION ALL
        
        -- Secondary-to-Secondary match (lower score: 5)
        SELECT 
          tgc.tenant_id,
          5 as match_score,
          'secondary_match' as match_type
        FROM tenant_gbp_categories tgc
        JOIN source_secondary_categories ssc ON tgc.gbp_category_id = ssc.category_id
        WHERE tgc.tenant_id != $1
      ),
      aggregated_scores AS (
        -- Sum up all category match scores per tenant
        SELECT 
          tenant_id,
          SUM(match_score) as total_category_score,
          MAX(match_score) as best_match_score,
          COUNT(*) as category_overlap_count
        FROM matching_tenants
        GROUP BY tenant_id
      )
      SELECT
        dcl.tenant_id,
        dcl.business_name,
        dcl.slug,
        dcl.address,
        dcl.city,
        dcl.state,
        COALESCE(dcl.logo_url, msd.tenant_logo_url) as logo_url,
        COALESCE(dcl.rating_avg, msd.store_average_rating, 0) as rating_avg,
        COALESCE(dcl.rating_count, msd.store_review_count, 0) as rating_count,
        agg.total_category_score,
        agg.best_match_score,
        agg.category_overlap_count,
        CASE WHEN dcl.city = ss.city AND dcl.state = ss.state THEN 5 ELSE 0 END as location_score,
        (agg.total_category_score + CASE WHEN dcl.city = ss.city AND dcl.state = ss.state THEN 5 ELSE 0 END) as combined_score
      FROM aggregated_scores agg
      JOIN directory_listings_list dcl ON dcl.tenant_id = agg.tenant_id
      CROSS JOIN source_store ss
      LEFT JOIN LATERAL (
        SELECT tenant_logo_url, store_average_rating, store_review_count
        FROM mv_storefront_discovery
        WHERE tenant_id = dcl.tenant_id
        LIMIT 1
      ) msd ON true
      WHERE dcl.is_published = true
      ORDER BY 
        combined_score DESC,
        agg.category_overlap_count DESC,
        dcl.rating_avg DESC NULLS LAST,
        dcl.rating_count DESC NULLS LAST
      LIMIT $2
    `;
    
    // Debug: Check if source store has categories
    const debugQuery = `
      SELECT 
        (SELECT gbp_category_id FROM tenant_business_profiles_list WHERE tenant_id = $1) as primary_cat,
        (SELECT COUNT(*) FROM tenant_gbp_categories WHERE tenant_id = $1) as secondary_count
    `;
    const debugResult = await pool.query(debugQuery, [storeId]);
    // console.log('[getSimilarStoresInCategory] Store categories:', debugResult.rows[0]);
    
    const result = await pool.query(query, [storeId, limit]);
    // console.log('[getSimilarStoresInCategory] Query returned:', result.rows.length, 'rows');
    
    const recommendations: Recommendation[] = result.rows.map((row: any) => {
      const totalScore = row.total_category_score + row.location_score + (row.rating_avg || 0);
      const inSameArea = row.location_score > 0;
      const matchStrength = row.best_match_score >= 10 ? 'strong' : row.best_match_score >= 7 ? 'good' : 'related';
      
      let reason = '';
      if (matchStrength === 'strong') {
        reason = `Same category${inSameArea ? ' in your area' : ''}`;
      } else if (matchStrength === 'good') {
        reason = `Related category${inSameArea ? ' nearby' : ''}`;
      } else {
        reason = `Similar store${inSameArea ? ' nearby' : ''}`;
      }
      if (row.rating_avg) {
        reason += ` (${row.rating_avg.toFixed(1)}⭐)`;
      }
      
      return {
        tenantId: row.tenant_id,
        businessName: row.business_name,
        slug: row.slug,
        score: totalScore,
        reason,
        address: row.address,
        city: row.city,
        state: row.state,
        logoUrl: row.logo_url,
        ratingAvg: row.rating_avg || 0,
        ratingCount: row.rating_count || 0
      };
    });

    return {
      recommendations,
      algorithm: 'similar_category',
      generatedAt: new Date()
    };

  } catch (error) {
    logger.error('Error in getSimilarStoresInCategory:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return { recommendations: [], algorithm: 'similar_category', generatedAt: new Date() };
  }
}

/**
 * NEW: Get user's last viewed items (stores, products, etc.)
 * Returns chronologically ordered list of recently viewed entities
 * Supports both authenticated users (userId) and anonymous users (sessionId)
 */
export async function getLastViewedItems(
  userId?: string,
  sessionId?: string,
  entityType?: 'store' | 'product' | 'all',
  limit: number = 10,
  daysBack: number = 30
): Promise<RecommendationResponse> {
  const pool = getDirectPool();

  // Must have either userId or sessionId
  if (!userId && !sessionId) {
    return { recommendations: [], algorithm: 'last_viewed', generatedAt: new Date() };
  }

  try {
    // Build query to get last viewed items for user or session
    let whereClause = `ub.timestamp >= NOW() - INTERVAL '${daysBack} days'`;
    let params: any[] = [];

    if (userId) {
      whereClause += ` AND ub.user_id = $${params.length + 1}`;
      params.push(userId);
    } else if (sessionId) {
      whereClause += ` AND ub.session_id = $${params.length + 1}`;
      params.push(sessionId);
    }

    if (entityType && entityType !== 'all') {
      whereClause += ` AND ub.entity_type = $${params.length + 1}`;
      params.push(entityType);
    }

    const query = `
      WITH ranked_views AS (
        SELECT 
          ub.entity_id,
          ub.entity_type,
          ub.entity_name,
          ub.timestamp as last_viewed_at,
          ub.page_type,
          ub.context,
          -- For deduplication: get the actual tenant_id for stores (in case entity_id varies)
          CASE 
            WHEN ub.entity_type = 'store' THEN (
              SELECT dcl.tenant_id FROM directory_listings_list dcl 
              WHERE dcl.tenant_id = ub.entity_id OR dcl.slug = ub.entity_id
              LIMIT 1
            )
            ELSE ub.entity_id
          END as dedup_key,
          ROW_NUMBER() OVER (
            PARTITION BY 
              CASE 
                WHEN ub.entity_type = 'store' THEN (
                  SELECT dcl.tenant_id FROM directory_listings_list dcl 
                  WHERE dcl.tenant_id = ub.entity_id OR dcl.slug = ub.entity_id
                  LIMIT 1
                )
                ELSE ub.entity_id
              END,
              ub.entity_type 
            ORDER BY ub.timestamp DESC
          ) as rn
        FROM user_behavior_simple ub
        WHERE ${whereClause}
      )
      SELECT 
        rv.entity_id,
        rv.entity_type,
        rv.entity_name,
        rv.last_viewed_at,
        rv.page_type,
        rv.context,
        rv.dedup_key,
        -- Get additional data based on entity type
        CASE
          WHEN rv.entity_type = 'store' THEN (
            SELECT json_build_object(
              'businessName', dcl.business_name,
              'slug', dcl.slug,
              'address', dcl.address,
              'city', dcl.city,
              'state', dcl.state,
              'logoUrl', dcl.logo_url,
              'primaryCategory',dcl.primary_category,
              'ratingAvg', dcl.rating_avg,
              'ratingCount', dcl.rating_count,
              'productCount', COALESCE((
                SELECT COUNT(*)
                FROM inventory_items ii
                WHERE ii.tenant_id = dcl.tenant_id
                  AND ii.item_status = 'active'
                  AND ii.visibility = 'public'
              ), 0),
              'isFeatured', dcl.is_featured
            )
            FROM directory_listings_list dcl
            WHERE dcl.tenant_id = rv.dedup_key
              AND dcl.is_published = true
            LIMIT 1
          )
          WHEN rv.entity_type = 'product' THEN (
            SELECT json_build_object(
              'title', sp.title,
              'name', sp.name,
              'description', sp.description,
              'brand', sp.brand,
              'sku', sp.sku,
              'priceCents', sp.price_cents,
              'salePriceCents', sp.sale_price_cents,
              'imageUrl', sp.image_url,
              'currency', sp.currency,
              'stock', sp.stock,
              'availability', sp.availability,
              'has_variants', sp.has_variants,
              'variants', COALESCE(sp.variants, '[]'),
              'storeName', dcl.business_name,
              'storeSlug', dcl.slug,
              'storeLogo', dcl.logo_url,
              'primaryCategory',dcl.primary_category,
              'tenantId', sp.tenant_id,
              'hasActivePaymentGateway', mgd.has_active_payment_gateway,
              'defaultGatewayType', mgd.default_gateway_type,
              'productType', mgd.product_type,
              'tenantCategory', CASE 
                WHEN sp.tenant_category_id IS NOT NULL THEN
                  json_build_object(
                    'id', sp.tenant_category_id,
                    'name', dc.name,
                    'slug', dc.slug
                  )
                ELSE NULL
              END
            )
            FROM storefront_products_mv sp
            JOIN directory_listings_list dcl ON sp.tenant_id = dcl.tenant_id
            LEFT JOIN mv_storefront_discovery mgd ON sp.tenant_id = mgd.tenant_id 
             AND mgd.inventory_item_id = sp.id
            LEFT JOIN directory_category dc on dc.id = sp.tenant_category_id
            WHERE sp.id = rv.entity_id
              AND dcl.is_published = true
            LIMIT 1
          )
          ELSE NULL
        END as entity_data
      FROM ranked_views rv
      WHERE rv.rn = 1
      ORDER BY rv.last_viewed_at DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);
    const result = await pool.query(query, params);

    const recommendations: Recommendation[] = result.rows
      .filter((row: any) => row.entity_data) // Only include items that still exist
      .map((row: any, index: number) => {
        const data = row.entity_data;
        const score = limit - index; // Higher score for more recent items

        if (row.entity_type === 'store') {
          return {
            tenantId: row.entity_id,
            businessName: data.businessName,
            slug: data.slug,
            score,
            reason: `Viewed ${new Date(row.last_viewed_at).toLocaleDateString()}${data.ratingAvg ? ` • ${data.ratingAvg.toFixed(1)}⭐` : ''}`,
            address: data.address,
            city: data.city,
            state: data.state,
            logoUrl: data.logoUrl,
            primaryCategory: data.primaryCategory,
            ratingAvg: data.ratingAvg,
            ratingCount: data.ratingCount,
            productCount: data.productCount,
            isFeatured: data.isFeatured
          } as Recommendation;
        } else if (row.entity_type === 'product') {
          // Calculate price range from variants if available
          let priceRange = null;
          if (data.has_variants && data.variants && Array.isArray(data.variants) && data.variants.length > 0) {
            const prices = data.variants
              .map((v: any) => v.sale_price_cents || v.price_cents)
              .filter((p: number) => typeof p === 'number');
            if (prices.length > 0) {
              const minPrice = Math.min(...prices);
              const maxPrice = Math.max(...prices);
              priceRange = {
                min: minPrice / 100,
                max: maxPrice / 100,
                minCents: minPrice,
                maxCents: maxPrice
              };
            }
          }
          
          return {
            tenantId: data.tenantId, // Use actual tenant ID for payment gateway checks
            businessName: data.storeName,
            slug: data.storeSlug,
            score,
            reason: `Viewed ${new Date(row.last_viewed_at).toLocaleDateString()}${data.priceCents ? ` • $${(data.priceCents / 100).toFixed(2)}` : ''}`,
            productId: row.entity_id,
            productName: data.title || data.name,
            productTitle: data.title,
            productDescription: data.description,
            productBrand: data.brand,
            productSku: data.sku,
            productPrice: data.priceCents ? data.priceCents / 100 : undefined,
            productPriceCents: data.priceCents,
            productSalePriceCents: data.salePriceCents,
            productImage: data.imageUrl,
            productImageUrl: data.imageUrl,
            productStock: data.stock,
            productAvailability: data.availability,
            productCurrency: data.currency,
            productCategory: data.productCategory,
            isFeatured: data.isFeatured,
            tenantLogo: data.storeLogo,
            primaryCategory: data.primaryCategory,
            tenantCategory: data.tenantCategory,
            hasActivePaymentGateway: data.hasActivePaymentGateway,
            defaultGatewayType: data.defaultGatewayType,
            productType: data.productType || 'physical',
            // Variant-aware fields
            has_variants: data.has_variants,
            variants: data.variants,
            price_range: priceRange
          } as Recommendation;
        }

        return null;
      })
      .filter((item): item is Recommendation => item !== null);

    return {
      recommendations,
      algorithm: 'last_viewed',
      generatedAt: new Date()
    };

  } catch (error) {
    logger.error('Error in getLastViewedItems:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return { recommendations: [], algorithm: 'last_viewed', generatedAt: new Date() };
  }
}

/**
 * Get a user's badge preferences based on their product viewing history.
 * Analyzes which badge types appear most frequently in products the user has viewed.
 * Returns a map of badge type → preference score (0-1).
 */
export async function getUserBadgePreferences(
  userId: string,
  daysBack: number = 30
): Promise<Map<string, number>> {
  const pool = getDirectPool();

  try {
    const query = `
      WITH viewed_products AS (
        SELECT DISTINCT ub.entity_id
        FROM user_behavior_simple ub
        WHERE ub.user_id = $1
          AND ub.entity_type = 'product'
          AND ub.timestamp >= NOW() - INTERVAL '${daysBack} days'
      ),
      badge_counts AS (
        SELECT
          fp.featured_type,
          COUNT(DISTINCT vp.entity_id) as view_count
        FROM viewed_products vp
        JOIN featured_products fp ON fp.inventory_item_id = vp.entity_id
          AND fp.is_active = true
        GROUP BY fp.featured_type
      ),
      total AS (
        SELECT COUNT(DISTINCT vp.entity_id) as total_views
        FROM viewed_products vp
      )
      SELECT
        bc.featured_type,
        CASE WHEN t.total_views > 0
          THEN bc.view_count::float / t.total_views
          ELSE 0
        END as preference_score
      FROM badge_counts bc
      CROSS JOIN total t
      ORDER BY preference_score DESC
    `;

    const result = await pool.query(query, [userId]);
    const preferences = new Map<string, number>();
    for (const row of result.rows) {
      preferences.set(row.featured_type, parseFloat(row.preference_score));
    }

    return preferences;
  } catch (error) {
    logger.error('Error in getUserBadgePreferences:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return new Map<string, number>();
  }
}

/**
 * Apply badge-based scoring boost to existing recommendations.
 * Products with badge types that match the user's preferences get a score boost.
 */
export function applyBadgeBoost(
  recommendations: Recommendation[],
  badgePreferences: Map<string, number>,
  boostWeight: number = 5
): Recommendation[] {
  return recommendations.map(rec => {
    const badges = rec.featuredTypeArray || (rec.featuredType ? [rec.featuredType] : []);
    if (badges.length === 0) return rec;

    let boost = 0;
    const matchedBadges: string[] = [];

    for (const badge of badges) {
      const pref = badgePreferences.get(badge);
      if (pref && pref > 0) {
        boost += pref * boostWeight;
        matchedBadges.push(badge);
      }
    }

    if (boost === 0) return rec;

    const reasonSuffix = matchedBadges.length > 0
      ? ` • Matches your interest in ${matchedBadges.join(', ')}`
      : '';

    return {
      ...rec,
      score: rec.score + boost,
      reason: rec.reason + reasonSuffix,
    };
  }).sort((a, b) => b.score - a.score);
}
