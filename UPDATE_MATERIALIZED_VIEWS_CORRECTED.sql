-- Update Materialized Views to Include Store Rating System - CORRECTED VERSION
-- This script updates all materialized views to join with the new store_rating_summary table
-- Uses the ACTUAL column names from your database

-- 1. Update directory_category_listings Materialized View
DROP MATERIALIZED VIEW IF EXISTS directory_category_listings CASCADE;

CREATE MATERIALIZED VIEW directory_category_listings AS
SELECT 
    dcl.tenant_id,
    dcl.business_name,
    dcl.slug,
    dcl.address,
    dcl.city,
    dcl.state,
    dcl.zip_code,
    dcl.phone,
    dcl.email,
    dcl.website,
    dcl.latitude,
    dcl.longitude,
    dcl.primary_category,
    dcl.secondary_categories,
    dcl.logo_url,
    dcl.description,
    dcl.business_hours,
    dcl.product_count,
    dcl.is_featured,
    dcl.subscription_tier,
    dcl.use_custom_website,
    dcl.is_published,
    dcl.created_at,
    dcl.updated_at,
    -- Use existing rating columns but prefer summary data
    COALESCE(srs.rating_avg, dcl.rating_avg, 0) as rating_avg,
    COALESCE(srs.rating_count, dcl.rating_count, 0) as rating_count,
    COALESCE(srs.rating_1_count, 0) as rating_1_count,
    COALESCE(srs.rating_2_count, 0) as rating_2_count,
    COALESCE(srs.rating_3_count, 0) as rating_3_count,
    COALESCE(srs.rating_4_count, 0) as rating_4_count,
    COALESCE(srs.rating_5_count, 0) as rating_5_count,
    COALESCE(srs.verified_purchase_count, 0) as verified_purchase_count,
    srs.last_review_at
FROM directory_listings_list dcl
LEFT JOIN store_rating_summary srs ON dcl.tenant_id = srs.tenant_id
WHERE dcl.is_published = true;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_directory_category_listings_tenant_id ON directory_category_listings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_directory_category_listings_rating_avg ON directory_category_listings(rating_avg DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_directory_category_listings_rating_count ON directory_category_listings(rating_count DESC NULLS LAST);

-- 2. Update directory_gbp_listings Materialized View
DROP MATERIALIZED VIEW IF EXISTS directory_gbp_listings CASCADE;

CREATE MATERIALIZED VIEW directory_gbp_listings AS
SELECT 
    dcl.tenant_id,
    dcl.business_name,
    dcl.slug,
    dcl.address,
    dcl.city,
    dcl.state,
    dcl.zip_code,
    dcl.phone,
    dcl.email,
    dcl.website,
    dcl.latitude,
    dcl.longitude,
    dcl.primary_category,
    dcl.secondary_categories,
    dcl.logo_url,
    dcl.description,
    dcl.business_hours,
    dcl.product_count,
    dcl.is_featured,
    dcl.subscription_tier,
    dcl.use_custom_website,
    dcl.is_published,
    dcl.created_at,
    dcl.updated_at,
    -- Use existing rating columns but prefer summary data
    COALESCE(srs.rating_avg, dcl.rating_avg, 0) as rating_avg,
    COALESCE(srs.rating_count, dcl.rating_count, 0) as rating_count,
    COALESCE(srs.rating_1_count, 0) as rating_1_count,
    COALESCE(srs.rating_2_count, 0) as rating_2_count,
    COALESCE(srs.rating_3_count, 0) as rating_3_count,
    COALESCE(srs.rating_4_count, 0) as rating_4_count,
    COALESCE(srs.rating_5_count, 0) as rating_5_count,
    COALESCE(srs.verified_purchase_count, 0) as verified_purchase_count,
    srs.last_review_at
FROM directory_listings_list dcl
LEFT JOIN store_rating_summary srs ON dcl.tenant_id = srs.tenant_id
WHERE dcl.is_published = true
    AND dcl.primary_category IS NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_directory_gbp_listings_tenant_id ON directory_gbp_listings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_directory_gbp_listings_rating_avg ON directory_gbp_listings(rating_avg DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_directory_gbp_listings_rating_count ON directory_gbp_listings(rating_count DESC NULLS LAST);

-- 3. Update storefront_materialized_view Materialized View
DROP MATERIALIZED VIEW IF EXISTS storefront_materialized_view CASCADE;

CREATE MATERIALIZED VIEW storefront_materialized_view AS
SELECT 
    dcl.tenant_id,
    dcl.business_name,
    dcl.slug,
    dcl.address,
    dcl.city,
    dcl.state,
    dcl.zip_code,
    dcl.phone,
    dcl.email,
    dcl.website,
    dcl.latitude,
    dcl.longitude,
    dcl.primary_category,
    dcl.secondary_categories,
    dcl.logo_url,
    dcl.description,
    dcl.business_hours,
    dcl.product_count,
    dcl.is_featured,
    dcl.subscription_tier,
    dcl.use_custom_website,
    dcl.is_published,
    dcl.created_at,
    dcl.updated_at,
    -- Use existing rating columns but prefer summary data
    COALESCE(srs.rating_avg, dcl.rating_avg, 0) as rating_avg,
    COALESCE(srs.rating_count, dcl.rating_count, 0) as rating_count,
    COALESCE(srs.rating_1_count, 0) as rating_1_count,
    COALESCE(srs.rating_2_count, 0) as rating_2_count,
    COALESCE(srs.rating_3_count, 0) as rating_3_count,
    COALESCE(srs.rating_4_count, 0) as rating_4_count,
    COALESCE(srs.rating_5_count, 0) as rating_5_count,
    COALESCE(srs.verified_purchase_count, 0) as verified_purchase_count,
    srs.last_review_at
FROM directory_listings_list dcl
LEFT JOIN store_rating_summary srs ON dcl.tenant_id = srs.tenant_id
WHERE dcl.is_published = true;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_storefront_mv_tenant_id ON storefront_materialized_view(tenant_id);
CREATE INDEX IF NOT EXISTS idx_storefront_mv_rating_avg ON storefront_materialized_view(rating_avg DESC NULLS LAST);

-- 4. Update directory_category_stats Materialized View
DROP MATERIALIZED VIEW IF EXISTS directory_category_stats CASCADE;

CREATE MATERIALIZED VIEW directory_category_stats AS
WITH category_stats AS (
    SELECT 
        tc.id as category_id,
        tc.slug as category_slug,
        tc.name as category_name,
        COUNT(dcl.tenant_id) as store_count,
        AVG(COALESCE(srs.rating_avg, dcl.rating_avg, 0)) as avg_rating,
        SUM(COALESCE(srs.rating_count, dcl.rating_count, 0)) as total_reviews,
        COUNT(CASE WHEN dcl.is_featured = true THEN 1 END) as featured_count,
        COUNT(CASE WHEN dcl.subscription_tier IN ('professional', 'enterprise', 'organization') THEN 1 END) as premium_count
    FROM tenant_categories tc
    LEFT JOIN directory_listings_list dcl ON tc.id = ANY(dcl.secondary_categories)
    LEFT JOIN store_rating_summary srs ON dcl.tenant_id = srs.tenant_id
    WHERE dcl.is_published = true
        AND tc.is_active = true
    GROUP BY tc.id, tc.slug, tc.name
)
SELECT 
    category_id,
    category_slug,
    category_name,
    store_count,
    avg_rating,
    total_reviews,
    featured_count,
    premium_count,
    -- Calculate rating score (stores with ratings get bonus)
    CASE 
        WHEN store_count > 0 THEN 
            store_count + (COALESCE(avg_rating, 0) * 2) + (COALESCE(total_reviews, 0) * 0.1)
        ELSE 0 
    END as rating_score
FROM category_stats
WHERE store_count >= 1;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_directory_category_stats_category_id ON directory_category_stats(category_id);
CREATE INDEX IF NOT EXISTS idx_directory_category_stats_category_slug ON directory_category_stats(category_slug);
CREATE INDEX IF NOT EXISTS idx_directory_category_stats_store_count ON directory_category_stats(store_count DESC);
CREATE INDEX IF NOT EXISTS idx_directory_category_stats_avg_rating ON directory_category_stats(avg_rating DESC NULLS LAST);

-- 5. Update directory_store_type_stats Materialized View
DROP MATERIALIZED VIEW IF EXISTS directory_store_type_stats CASCADE;

CREATE MATERIALIZED VIEW directory_store_type_stats AS
WITH store_type_stats AS (
    SELECT 
        dcl.primary_category as store_type_slug,
        COUNT(dcl.tenant_id) as store_count,
        AVG(COALESCE(srs.rating_avg, dcl.rating_avg, 0)) as avg_rating,
        SUM(COALESCE(srs.rating_count, dcl.rating_count, 0)) as total_reviews,
        COUNT(CASE WHEN dcl.is_featured = true THEN 1 END) as featured_count,
        COUNT(CASE WHEN dcl.subscription_tier IN ('professional', 'enterprise', 'organization') THEN 1 END) as premium_count
    FROM directory_listings_list dcl
    LEFT JOIN store_rating_summary srs ON dcl.tenant_id = srs.tenant_id
    WHERE dcl.is_published = true
        AND dcl.primary_category IS NOT NULL
    GROUP BY dcl.primary_category
)
SELECT 
    store_type_slug,
    store_count,
    avg_rating,
    total_reviews,
    featured_count,
    premium_count,
    -- Calculate rating score
    CASE 
        WHEN store_count > 0 THEN 
            store_count + (COALESCE(avg_rating, 0) * 2) + (COALESCE(total_reviews, 0) * 0.1)
        ELSE 0 
    END as rating_score
FROM store_type_stats
WHERE store_count >= 1;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_directory_store_type_stats_slug ON directory_store_type_stats(store_type_slug);
CREATE INDEX IF NOT EXISTS idx_directory_store_type_stats_store_count ON directory_store_type_stats(store_count DESC);
CREATE INDEX IF NOT EXISTS idx_directory_store_type_stats_avg_rating ON directory_store_type_stats(avg_rating DESC NULLS LAST);

-- 6. Refresh all materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_listings;
REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_listings;
REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_materialized_view;
REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY directory_store_type_stats;

-- 7. Create a function to refresh rating summaries and materialized views
CREATE OR REPLACE FUNCTION refresh_rating_system()
RETURNS void AS $$
BEGIN
    -- First update any missing rating summaries
    INSERT INTO store_rating_summary (tenant_id, rating_avg, rating_count, updated_at)
    SELECT 
        dcl.tenant_id,
        COALESCE(AVG(sr.rating), 0)::DECIMAL(3, 2),
        COUNT(sr.rating),
        NOW()
    FROM directory_listings_list dcl
    LEFT JOIN store_reviews sr ON dcl.tenant_id = sr.tenant_id
    WHERE dcl.is_published = true
    GROUP BY dcl.tenant_id
    ON CONFLICT (tenant_id) DO UPDATE SET
        rating_avg = EXCLUDED.rating_avg,
        rating_count = EXCLUDED.rating_count,
        updated_at = EXCLUDED.updated_at;
    
    -- Then refresh materialized views
    REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_listings;
    REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_listings;
    REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_materialized_view;
    REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY directory_store_type_stats;
    
    RAISE NOTICE 'Rating system and materialized views refreshed successfully';
END;
$$ LANGUAGE plpgsql;

COMMIT;
