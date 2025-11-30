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
    const query = `
      WITH same_user_views AS (
        SELECT DISTINCT ub.user_id
        FROM user_behavior_simple ub
        WHERE ub.entity_id = $1 
          AND ub.entity_type = 'store'
          AND ub.timestamp >= NOW() - INTERVAL '30 days'
          ${userId ? 'AND ub.user_id::text = $2::text' : ''}
      ),
      other_stores_viewed AS (
        SELECT 
          ub.entity_id,
          COUNT(*) as view_count,
          MAX(ub.timestamp) as last_viewed
        FROM user_behavior_simple ub
        JOIN same_user_views suv ON ub.user_id::text = suv.user_id::text
        WHERE ub.entity_id != $1 
          AND ub.entity_type = 'store'
          AND ub.timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY ub.entity_id
        ORDER BY view_count DESC, last_viewed DESC
        LIMIT $3
      )
      SELECT 
        dcl.tenant_id,
        dcl.business_name,
        dcl.slug,
        dcl.address,
        dcl.city,
        dcl.state,
        osv.view_count as score
      FROM other_stores_viewed osv
      JOIN directory_listings_list dcl ON osv.entity_id = dcl.tenant_id
      WHERE dcl.tenant_exists = true
        AND dcl.is_directory_visible = true
    `;
    
    const params = userId ? [storeId, userId, limit] : [storeId, limit];
    const result = await pool.query(query, params);
    
    const recommendations: Recommendation[] = result.rows.map((row: any) => ({
      tenantId: row.tenant_id,
      businessName: row.business_name,
      slug: row.slug,
      score: row.view_count,
      reason: 'Users who viewed this store also viewed this store',
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
    let whereClause = 'dcs.category_slug = $1';
    let params: any[] = [categorySlug];
    let orderBy = 'dcs.store_count DESC, dcs.avg_rating DESC NULLS LAST';
    
    // Add location filtering if available
    if (userLat && userLng) {
      whereClause += ` AND dcl.latitude IS NOT NULL AND dcl.longitude IS NOT NULL`;
      params.push(userLat, userLng);
      orderBy = `distance ASC, ${orderBy}`;
    }
    
    const query = `
      SELECT 
        dcl.tenant_id,
        dcl.business_name,
        dcl.slug,
        dcl.address,
        dcl.city,
        dcl.state,
        dcs.store_count,
        dcs.avg_rating,
        ${userLat && userLng ? `
          3959 * ACOS(
            COS(RADIANS($2)) * COS(RADIANS(dcl.latitude)) * 
            COS(RADIANS(dcl.longitude) - RADIANS($3)) + 
            SIN(RADIANS($2)) * SIN(RADIANS(dcl.latitude))
          ) as distance` : 'NULL as distance'}
      FROM directory_category_stats dcs
      JOIN directory_listings_list dcl ON dcs.category_id = ANY(dcl.category_ids)
      WHERE ${whereClause}
        AND dcl.tenant_exists = true
        AND dcl.is_directory_visible = true
        AND dcs.store_count >= 2
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1}
    `;
    
    params.push(limit);
    const result = await pool.query(query, params);
    
    const recommendations: Recommendation[] = result.rows.map((row: any) => ({
      tenantId: row.tenant_id,
      businessName: row.business_name,
      slug: row.slug,
      score: (row.store_count * 0.7) + ((row.avg_rating || 0) * 5 * 0.3), // Weighted score
      reason: `Popular ${categorySlug.replace('-', ' ')} with ${row.store_count} locations`,
      address: row.address,
      city: row.city,
      state: row.state,
      distance: row.distance ? Math.round(row.distance * 10) / 10 : undefined
    }));

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
    const query = `
      WITH trending_stores AS (
        SELECT 
          ub.entity_id,
          COUNT(*) as view_count,
          COUNT(DISTINCT ub.user_id) as unique_viewers,
          MAX(ub.timestamp) as last_viewed
        FROM user_behavior_simple ub
        WHERE ub.entity_type = 'store'
          AND ub.timestamp >= NOW() - INTERVAL '${days} days'
          AND 3959 * ACOS(
            COS(RADIANS($1)) * COS(RADIANS(ub.location_lat)) * 
            COS(RADIANS(ub.location_lng) - RADIANS($2)) + 
            SIN(RADIANS($1)) * SIN(RADIANS(ub.location_lat))
          ) <= $3
          AND ub.location_lat IS NOT NULL 
          AND ub.location_lng IS NOT NULL
        GROUP BY ub.entity_id
        HAVING COUNT(*) >= 2 -- At least 2 views
        ORDER BY view_count DESC, unique_viewers DESC, last_viewed DESC
        LIMIT $4
      )
      SELECT 
        dcl.tenant_id,
        dcl.business_name,
        dcl.slug,
        dcl.address,
        dcl.city,
        dcl.state,
        ts.view_count,
        ts.unique_viewers,
        3959 * ACOS(
          COS(RADIANS($1)) * COS(RADIANS(dcl.latitude)) * 
          COS(RADIANS(dcl.longitude) - RADIANS($2)) + 
          SIN(RADIANS($1)) * SIN(RADIANS(dcl.latitude))
        ) as distance
      FROM trending_stores ts
      JOIN directory_listings_list dcl ON ts.entity_id = dcl.tenant_id
      WHERE dcl.tenant_exists = true
        AND dcl.is_directory_visible = true
        AND dcl.latitude IS NOT NULL 
        AND dcl.longitude IS NOT NULL
      ORDER BY ts.view_count DESC
    `;
    
    const result = await pool.query(query, [userLat, userLng, radiusMiles, limit]);
    
    const recommendations: Recommendation[] = result.rows.map((row: any) => ({
      tenantId: row.tenant_id,
      businessName: row.business_name,
      slug: row.slug,
      score: row.view_count + (row.unique_viewers * 0.5), // Weight unique viewers
      reason: `Trending nearby - ${row.view_count} views by ${row.unique_viewers} people`,
      address: row.address,
      city: row.city,
      state: row.state,
      distance: Math.round(row.distance * 10) / 10
    }));

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
    const query = `
      INSERT INTO user_behavior_simple (
        user_id, session_id, entity_type, entity_id, entity_name, context,
        location_lat, location_lng, referrer, user_agent, ip_address, 
        duration_seconds, page_type
      ) VALUES ($1, $2, $3, 
        CASE 
          WHEN $3 = 'store'::text THEN $4::uuid
          ELSE '00000000-0000-0000-0000-000000000000'::uuid
        END, 
        $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT DO NOTHING
    `;
    
    // For non-store entities, store the actual entity ID in entity_name
    const actualEntityName = entityType === 'store' ? entityName : entityId;
    
    await pool.query(query, [
      userId || null,
      sessionId || null,
      entityType,
      entityId, // For stores: UUID, for others: will be replaced with placeholder
      actualEntityName || null,
      context ? JSON.stringify(context) : null,
      locationLat || null,
      locationLng || null,
      referrer || null,
      userAgent || null,
      ipAddress || null,
      durationSeconds || null,
      pageType || null
    ]);

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
        opv.entity_id as product_id,
        opv.entity_name as product_name,
        opv.view_count as score,
        ii.tenant_id,
        ii.title,
        ii.price_cents,
        ii.image_url,
        dcl.business_name as store_name,
        dcl.slug as store_slug
      FROM other_products_viewed opv
      JOIN inventory_items ii ON opv.entity_id = ii.id
      JOIN directory_listings_list dcl ON ii.tenant_id = dcl.tenant_id
      WHERE ii.is_active = true
        AND dcl.tenant_exists = true
        AND dcl.is_directory_visible = true
    `;
    
    const params = userId ? [productId, userId, limit] : [productId, limit];
    const result = await pool.query(query, params);
    
    const recommendations: Recommendation[] = result.rows.map((row: any) => ({
      tenantId: row.tenant_id,
      businessName: row.store_name,
      slug: row.store_slug,
      score: row.view_count,
      reason: 'Users who viewed this product also viewed this',
      // Product-specific info
      productId: row.product_id,
      productName: row.product_name,
      productPrice: row.price_cents ? row.price_cents / 100 : undefined,
      productImage: row.image_url
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
    const query = `
      WITH user_category_preferences AS (
        SELECT 
          ub.context->>'category_id' as category_id,
          ub.context->>'category_slug' as category_slug,
          ub.context->>'store_type_slug' as store_type_slug,
          COUNT(*) as browse_count,
          AVG(ub.duration_seconds) as avg_duration,
          MAX(ub.timestamp) as last_browsed
        FROM user_behavior_simple ub
        WHERE ub.user_id = $1
          AND ub.entity_type = 'category'
          AND ub.timestamp >= NOW() - INTERVAL '30 days'
          AND ub.context->>'category_id' IS NOT NULL
        GROUP BY 
          ub.context->>'category_id', 
          ub.context->>'category_slug',
          ub.context->>'store_type_slug'
        HAVING COUNT(*) >= 2
        ORDER BY browse_count DESC, avg_duration DESC, last_browsed DESC
        LIMIT 10
      ),
      user_store_type_preferences AS (
        SELECT 
          ub.context->>'store_type_slug' as store_type_slug,
          COUNT(*) as browse_count,
          AVG(ub.duration_seconds) as avg_duration
        FROM user_behavior_simple ub
        WHERE ub.user_id = $1
          AND ub.entity_type = 'category'
          AND ub.context->>'store_type_slug' IS NOT NULL
          AND ub.timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY ub.context->>'store_type_slug'
        ORDER BY browse_count DESC, avg_duration DESC
        LIMIT 5
      ),
      recommended_stores AS (
        SELECT DISTINCT
          dcl.tenant_id,
          dcl.business_name,
          dcl.slug,
          dcl.address,
          dcl.city,
          dcl.state,
          dcs.store_count,
          dcs.avg_rating,
          ucp.category_id,
          ucp.category_slug,
          ucp.store_type_slug,
          ucp.browse_count as category_browse_count,
          ucp.avg_duration as category_avg_duration,
          ${userLat && userLng ? `
            3959 * ACOS(
              COS(RADIANS($2)) * COS(RADIANS(dcl.latitude)) * 
              COS(RADIANS(dcl.longitude) - RADIANS($3)) + 
              SIN(RADIANS($2)) * SIN(RADIANS(dcl.latitude))
            ) as distance` : 'NULL as distance'},
          -- Boost score for user's preferred store types
          CASE 
            WHEN ucp.store_type_slug IN (SELECT store_type_slug FROM user_store_type_preferences LIMIT 3) 
            THEN 1.5 
            ELSE 1.0 
          END as store_type_boost
        FROM user_category_preferences ucp
        JOIN directory_category_stats dcs ON ucp.category_id = dcs.category_id
        JOIN directory_listings_list dcl ON dcs.category_id = ANY(dcl.category_ids)
        WHERE dcl.tenant_exists = true
          AND dcl.is_directory_visible = true
          AND dcs.store_count >= 2
        ORDER BY 
          store_type_boost DESC,
          dcs.store_count DESC, 
          dcs.avg_rating DESC NULLS LAST,
          ucp.browse_count DESC,
          ucp.avg_duration DESC
        LIMIT $4
      )
      SELECT * FROM recommended_stores
    `;
    
    const params = userLat && userLng ? 
      [userId, userLat, userLng, limit] : 
      [userId, limit];
    
    const result = await pool.query(query, params);
    
    const recommendations: Recommendation[] = result.rows.map((row: any) => ({
      tenantId: row.tenant_id,
      businessName: row.business_name,
      slug: row.slug,
      score: (row.store_count * 0.5) + 
             ((row.avg_rating || 0) * 5 * 0.3) + 
             (row.category_browse_count * 0.1) + 
             ((row.category_avg_duration || 0) * 0.1) * 
             (row.store_type_boost || 1.0),
      reason: `Based on your interest in ${row.category_slug}${row.store_type_slug ? ` and ${row.store_type_slug} stores` : ''}`,
      address: row.address,
      city: row.city,
      state: row.state,
      distance: row.distance ? Math.round(row.distance * 10) / 10 : undefined
    }));

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
