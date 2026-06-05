-- Check if materialized views exist
SELECT 
  schemaname,
  matviewname,
  hasindexes,
  ispopulated
FROM pg_matviews
WHERE matviewname IN (
  'mv_global_discovery',
  'mv_category_discovery',
  'mv_shop_discovery',
  'mv_trending_scores',
  'mv_trending_products',
  'mv_selection_products',
  'mv_new_products',
  'mv_sale_products',
  'mv_seasonal_products'
)
ORDER BY matviewname;

-- If the above returns empty, you need to run the create_scope_aware_mvs.sql migration
-- Run this command in your database:
-- \i apps/api/database/migrations/create_scope_aware_mvs.sql

-- If views exist but are not populated (ispopulated = false), refresh them:
-- SELECT refresh_scope_aware_mvs();
