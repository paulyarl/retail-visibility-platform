/**
 * MVP Recommendation Service
 * 
 * Simple but impactful recommendations for store discovery
 * Phase 1: 3 core recommendation types
 */

import { Pool } from 'pg';
import { getDirectPool } from '../utils/db-pool';

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

  // Rich product data from mv_global_discovery
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
  featuredPriority?: number;
  featuredAt?: string;
  isFeaturedActive?: boolean;
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
      JOIN mv_global_discovery mgd ON osv.entity_id::text = mgd.tenant_id::text
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

      // Rich store data from mv_global_discovery
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
    console.error('Error in getStoresViewedBySameUsers:', error);
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
    console.error('Error in getPopularStoresInCategory:', error);
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
    // Use mv_global_discovery for comprehensive store data
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
      FROM mv_global_discovery mgd
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

        // Rich store data from mv_global_discovery
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
    console.error('Error in getTrendingNearby:', error);
    return { recommendations: [], algorithm: 'trending_nearby', generatedAt: new Date() };
  }
}

/**
 * Track user behavior for recommendations
 * Now supports multiple entity types and page types
 */
export async function trackUserBehavior({
  userId,
  sessionId,
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
  userId?: string;
  sessionId?: string;
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
        user_id, session_id, entity_type, entity_id, entity_name, context,
        location_lat, location_lng, referrer, user_agent, ip_address, 
        duration_seconds, page_type
      ) VALUES ($1, $2, $3::text, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT DO NOTHING
    `;
    
    // Use actual entity_id for tracking
    const actualEntityId = entityId;
    
    const queryParams = [
      userId || null,
      sessionId || null,
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
    console.error('Error tracking user behavior:', error);
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
        mgd.tenant_id,
        mgd.tenant_name as business_name,
        mgd.tenant_slug as slug,
        mgd.tenant_address as address,
        mgd.tenant_city as city,
        mgd.tenant_state as state,
        opv.view_count as score
      FROM other_products_viewed opv
      JOIN mv_global_discovery mgd ON opv.entity_id::text = mgd.inventory_item_id::text
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

      // Rich product data from mv_global_discovery
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
      featuredPriority: row.featured_priority,
      featuredAt: row.featured_at,
      isFeaturedActive: row.featured_is_active,

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
    console.error('Error in getProductsViewedBySameUsers:', error);
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
    console.error('Error in getStoresInUserFavoriteCategories:', error);
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
        dcl.rating_avg,
        dcl.rating_count,
        agg.total_category_score,
        agg.best_match_score,
        agg.category_overlap_count,
        CASE WHEN dcl.city = ss.city AND dcl.state = ss.state THEN 5 ELSE 0 END as location_score,
        (agg.total_category_score + CASE WHEN dcl.city = ss.city AND dcl.state = ss.state THEN 5 ELSE 0 END) as combined_score
      FROM aggregated_scores agg
      JOIN directory_listings_list dcl ON dcl.tenant_id = agg.tenant_id
      CROSS JOIN source_store ss
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
    console.log('[getSimilarStoresInCategory] Store categories:', debugResult.rows[0]);
    
    const result = await pool.query(query, [storeId, limit]);
    console.log('[getSimilarStoresInCategory] Query returned:', result.rows.length, 'rows');
    
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
        state: row.state
      };
    });

    return {
      recommendations,
      algorithm: 'similar_category',
      generatedAt: new Date()
    };

  } catch (error) {
    console.error('Error in getSimilarStoresInCategory:', error);
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
          ROW_NUMBER() OVER (
            PARTITION BY ub.entity_id, ub.entity_type 
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
            WHERE dcl.tenant_id = rv.entity_id
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
              'imageUrl', sp.image_url,
              'currency', sp.currency,
              'stock', sp.stock,
              'availability', sp.availability,
              'isFeatured', sp.is_featured,
              'storeName', dcl.business_name,
              'storeSlug', dcl.slug,
              'storeLogo', dcl.logo_url,
              'tenantId', sp.tenant_id,
              'hasActivePaymentGateway', sp.has_active_payment_gateway,
              'defaultGatewayType', sp.default_gateway_type,
              'tenantCategory', CASE 
                WHEN sp.category_id IS NOT NULL THEN
                  json_build_object(
                    'id', sp.category_id,
                    'name', sp.category_name,
                    'slug', sp.category_slug
                  )
                ELSE NULL
              END
            )
            FROM storefront_products sp
            JOIN directory_listings_list dcl ON sp.tenant_id = dcl.tenant_id
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
            ratingAvg: data.ratingAvg,
            ratingCount: data.ratingCount,
            productCount: data.productCount,
            isFeatured: data.isFeatured
          } as Recommendation;
        } else if (row.entity_type === 'product') {
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
            productImage: data.imageUrl,
            productImageUrl: data.imageUrl,
            productStock: data.stock,
            productAvailability: data.availability,
            productCurrency: data.currency,
            productCategory: data.productCategory,
            isFeatured: data.isFeatured,
            tenantLogo: data.storeLogo,
            tenantCategory: data.tenantCategory,
            hasActivePaymentGateway: data.hasActivePaymentGateway,
            defaultGatewayType: data.defaultGatewayType
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
    console.error('Error in getLastViewedItems:', error);
    return { recommendations: [], algorithm: 'last_viewed', generatedAt: new Date() };
  }
}
