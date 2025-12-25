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
        dcl.tenant_id,
        dcl.business_name,
        dcl.slug,
        dcl.address,
        dcl.city,
        dcl.state,
        osv.view_count as score
      FROM other_stores_viewed osv
      JOIN directory_listings_list dcl ON osv.entity_id::text = dcl.tenant_id::text
      WHERE dcl.is_published = true
    `;
    
    params.push(limit);
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
    // Use pre-aggregated trending_stores_mv for 7-13x faster queries
    const query = `
      SELECT 
        tenant_id,
        business_name,
        slug,
        address,
        city,
        state,
        rating_avg,
        view_count,
        unique_viewers,
        trending_score,
        3959 * ACOS(
          COS(RADIANS($1)) * COS(RADIANS(latitude)) * 
          COS(RADIANS(longitude) - RADIANS($2)) + 
          SIN(RADIANS($1)) * SIN(RADIANS(latitude))
        ) as distance
      FROM trending_stores_mv
      WHERE 3959 * ACOS(
          COS(RADIANS($1)) * COS(RADIANS(latitude)) * 
          COS(RADIANS(longitude) - RADIANS($2)) + 
          SIN(RADIANS($1)) * SIN(RADIANS(latitude))
        ) <= $3
      ORDER BY trending_score DESC, view_count DESC
      LIMIT $4
    `;
    
    const result = await pool.query(query, [userLat, userLng, radiusMiles, limit]);
    
    const recommendations: Recommendation[] = result.rows.map((row: any) => {
      // Calculate location-weighted rating if user location is available
      let locationWeightedRating = row.rating_avg || 0;
      if (userLat && userLng && row.distance !== null) {
        // Apply location bonus: closer stores get rating boost
        const distanceMiles = row.distance;
        const locationBonus = Math.max(0, 1 - (distanceMiles / 50)) * 0.5; // 0 to 0.5 bonus
        locationWeightedRating = Math.min(5, (row.rating_avg || 0) + locationBonus);
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
        reason: `Trending nearby - ${row.view_count} views by ${row.unique_viewers} people${row.rating_avg ? ` (${row.rating_avg.toFixed(1)}⭐)` : ''}`,
        address: row.address,
        city: row.city,
        state: row.state,
        distance: Math.round(row.distance * 10) / 10
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
    // Insert actual entity_id - MVs need this to join with stores
    const query = `
      INSERT INTO user_behavior_simple (
        user_id, session_id, entity_type, entity_id, entity_name, context,
        location_lat, location_lng, referrer, user_agent, ip_address, 
        duration_seconds, page_type
      ) VALUES ($1, $2, $3::text, 
        $4::uuid, 
        $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
