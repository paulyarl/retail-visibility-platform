-- Verify the complete store ratings system is working

-- 1. Check all tables exist and have data
SELECT 
    'store_reviews' as table_name,
    COUNT(*) as row_count
FROM store_reviews
UNION ALL
SELECT 
    'store_rating_summary' as table_name,
    COUNT(*) as row_count
FROM store_rating_summary
UNION ALL
SELECT 
    'review_helpful_votes' as table_name,
    COUNT(*) as row_count
FROM review_helpful_votes;

-- 2. Check rating summaries were created for existing stores
SELECT 
    tenant_id,
    rating_avg,
    rating_count,
    updated_at
FROM store_rating_summary
ORDER BY tenant_id;

-- 3. Test the location-weighted rating function
SELECT calculate_location_weighted_rating(
    't-zjd1o7sm',  -- Your actual tenant ID from directory_listings_list
    39.8121711,   -- Store's actual latitude
    -86.2431516,  -- Store's actual longitude
    50            -- Max distance miles
) as location_weighted_rating;

-- 4. Test trigger by inserting a sample review
-- (This is a test - you can delete it later)
INSERT INTO store_reviews (
    tenant_id, 
    user_id, 
    rating, 
    review_text, 
    verified_purchase,
    location_lat,
    location_lng
) VALUES (
    't-zjd1o7sm',
    'user_1763968815440_gjr1hf',  -- Your actual user ID
    5,
    'Great store! Excellent service and products.',
    true,
    39.8121711,
    -86.2431516
) ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    rating = EXCLUDED.rating,
    review_text = EXCLUDED.review_text,
    updated_at = NOW();

-- 5. Check if the trigger updated the summary
SELECT 
    tenant_id,
    rating_avg,
    rating_count,
    rating_5_count,
    verified_purchase_count,
    last_review_at
FROM store_rating_summary
WHERE tenant_id = 't-zjd1o7sm';

-- 6. Clean up the test review (optional)
-- DELETE FROM store_reviews WHERE tenant_id = 't-zjd1o7sm' AND user_id = 'user_1763968815440_gjr1hf';

COMMIT;
