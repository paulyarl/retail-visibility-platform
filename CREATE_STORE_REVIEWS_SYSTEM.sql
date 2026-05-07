-- Store Reviews and Ratings System
-- Complete rating/review infrastructure with location-aware recommendations

-- 1. Store Reviews Table
CREATE TABLE IF NOT EXISTS store_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    helpful_count INTEGER DEFAULT 0,
    verified_purchase BOOLEAN DEFAULT FALSE, -- If user actually purchased from store
    location_lat DECIMAL(10, 8), -- Reviewer location for proximity context
    location_lng DECIMAL(11, 8), -- Reviewer location for proximity context
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- One review per user per store
    UNIQUE(tenant_id, user_id)
);

-- 2. Store Rating Summary Table (aggregated for performance)
CREATE TABLE IF NOT EXISTS store_rating_summary (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    rating_avg DECIMAL(3, 2) DEFAULT 0.00,
    rating_count INTEGER DEFAULT 0,
    rating_1_count INTEGER DEFAULT 0,
    rating_2_count INTEGER DEFAULT 0,
    rating_3_count INTEGER DEFAULT 0,
    rating_4_count INTEGER DEFAULT 0,
    rating_5_count INTEGER DEFAULT 0,
    helpful_count_total INTEGER DEFAULT 0,
    verified_purchase_count INTEGER DEFAULT 0,
    last_review_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Review Helpful Votes Table
CREATE TABLE IF NOT EXISTS review_helpful_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES store_reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- One vote per user per review
    UNIQUE(review_id, user_id)
);

-- 4. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_store_reviews_tenant_id ON store_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_store_reviews_user_id ON store_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_store_reviews_rating ON store_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_store_reviews_created_at ON store_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_reviews_location ON store_reviews USING GIST (
    point(location_lng, location_lat)
) WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_helpful_votes_review_id ON review_helpful_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_helpful_votes_user_id ON review_helpful_votes(user_id);

-- 5. Trigger to Update Rating Summary
CREATE OR REPLACE FUNCTION update_store_rating_summary()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        -- Update the rating summary for the store
        INSERT INTO store_rating_summary (tenant_id, rating_avg, rating_count, 
            rating_1_count, rating_2_count, rating_3_count, rating_4_count, rating_5_count,
            helpful_count_total, verified_purchase_count, last_review_at, updated_at)
        SELECT 
            NEW.tenant_id,
            COALESCE(AVG(rating), 0)::DECIMAL(3, 2),
            COUNT(*),
            COUNT(*) FILTER (WHERE rating = 1),
            COUNT(*) FILTER (WHERE rating = 2),
            COUNT(*) FILTER (WHERE rating = 3),
            COUNT(*) FILTER (WHERE rating = 4),
            COUNT(*) FILTER (WHERE rating = 5),
            COALESCE(SUM(helpful_count), 0),
            COUNT(*) FILTER (WHERE verified_purchase = TRUE),
            MAX(created_at),
            NOW()
        FROM store_reviews
        WHERE tenant_id = NEW.tenant_id
        ON CONFLICT (tenant_id) DO UPDATE SET
            rating_avg = EXCLUDED.rating_avg,
            rating_count = EXCLUDED.rating_count,
            rating_1_count = EXCLUDED.rating_1_count,
            rating_2_count = EXCLUDED.rating_2_count,
            rating_3_count = EXCLUDED.rating_3_count,
            rating_4_count = EXCLUDED.rating_4_count,
            rating_5_count = EXCLUDED.rating_5_count,
            helpful_count_total = EXCLUDED.helpful_count_total,
            verified_purchase_count = EXCLUDED.verified_purchase_count,
            last_review_at = EXCLUDED.last_review_at,
            updated_at = EXCLUDED.updated_at;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_store_rating_summary ON store_reviews;
CREATE TRIGGER trigger_update_store_rating_summary
    AFTER INSERT OR UPDATE OR DELETE ON store_reviews
    FOR EACH ROW EXECUTE FUNCTION update_store_rating_summary();

-- 6. Update Materialized Views to Include Rating Summary
-- This will be updated in the application code when refreshing MVs

-- 7. Location-Aware Rating Query Functions
CREATE OR REPLACE FUNCTION calculate_location_weighted_rating(
    p_tenant_id UUID,
    p_user_lat DECIMAL,
    p_user_lng DECIMAL,
    p_max_distance_miles INTEGER DEFAULT 50
)
RETURNS DECIMAL(3, 2) AS $$
DECLARE
    weighted_rating DECIMAL(3, 2) := 0.00;
    total_weight DECIMAL(5, 2) := 0.00;
    review_record RECORD;
    distance_miles DECIMAL(8, 2);
    location_weight DECIMAL(3, 2);
BEGIN
    -- Calculate location-weighted rating
    FOR review_record IN 
        SELECT 
            sr.rating,
            sr.location_lat,
            sr.location_lng,
            sr.helpful_count,
            sr.verified_purchase
        FROM store_reviews sr
        WHERE sr.tenant_id = p_tenant_id
        AND sr.location_lat IS NOT NULL 
        AND sr.location_lng IS NOT NULL
    LOOP
        -- Calculate distance from reviewer to user
        distance_miles := 3959 * ACOS(
            COS(RADIANS(p_user_lat)) * COS(RADIANS(review_record.location_lat)) * 
            COS(RADIANS(review_record.location_lng) - RADIANS(p_user_lng)) + 
            SIN(RADIANS(p_user_lat)) * SIN(RADIANS(review_record.location_lat))
        );
        
        -- Apply location weight (closer reviews have more weight)
        IF distance_miles <= p_max_distance_miles THEN
            location_weight := 1.0 - (distance_miles / p_max_distance_miles * 0.5); -- 0.5 to 1.0 weight
            
            -- Additional weight for verified purchases
            IF review_record.verified_purchase THEN
                location_weight := location_weight * 1.2;
            END IF;
            
            -- Additional weight for helpful votes
            IF review_record.helpful_count > 0 THEN
                location_weight := location_weight * (1.0 + (review_record.helpful_count * 0.1));
            END IF;
            
            weighted_rating := weighted_rating + (review_record.rating * location_weight);
            total_weight := total_weight + location_weight;
        END IF;
    END LOOP;
    
    -- Return weighted average or fall back to regular average
    IF total_weight > 0 THEN
        RETURN ROUND(weighted_rating / total_weight, 2);
    ELSE
        -- Fall back to regular rating average
        SELECT COALESCE(rating_avg, 0)::DECIMAL(3, 2) 
        INTO weighted_rating 
        FROM store_rating_summary 
        WHERE tenant_id = p_tenant_id;
        
        RETURN weighted_rating;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. Sample Data for Testing (Optional)
-- This would be removed in production
/*
-- Sample store reviews for testing
INSERT INTO store_reviews (tenant_id, user_id, rating, review_text, location_lat, location_lng, verified_purchase) VALUES
    (UUID.generate(), UUID.generate(), 5, 'Excellent store! Great products and service.', 40.7128, -74.0060, TRUE),
    (UUID.generate(), UUID.generate(), 4, 'Good selection, friendly staff.', 40.7589, -73.9851, FALSE),
    (UUID.generate(), UUID.generate(), 5, 'Amazing experience! Will definitely come back.', 40.6892, -74.0445, TRUE);
*/

-- 9. Grant Permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON store_reviews TO app_user;
-- GRANT SELECT ON store_rating_summary TO app_user;
-- GRANT SELECT, INSERT, DELETE ON review_helpful_votes TO app_user;

COMMIT;
