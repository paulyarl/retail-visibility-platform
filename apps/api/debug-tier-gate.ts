import { getDirectPool } from './src/utils/db-pool';

async function debugTierGate() {
  const tenantId = 'tid-m8ijkrnk';

  // Check tier configuration
  const tierQuery = `
    SELECT 
      stl.tier_key,
      stl.tier_type,
      tfl.feature_key,
      tfl.is_enabled
    FROM subscription_tiers_list stl
    JOIN tenants t ON t.subscription_tier = stl.tier_key
    LEFT JOIN tier_features_list tfl ON tfl.tier_id = stl.id
    WHERE t.id = $1
      AND tfl.feature_key LIKE 'featured_%'
    ORDER BY tfl.feature_key
  `;

  const tierResult = await getDirectPool().query(tierQuery, [tenantId]);
  console.log('Tier features for tenant:', tenantId);
  console.table(tierResult.rows);

  // Check tenant featured options settings
  const prefsQuery = `
    SELECT * FROM tenant_featured_options_settings
    WHERE tenant_id = $1
  `;

  const prefsResult = await getDirectPool().query(prefsQuery, [tenantId]);
  console.log('\nTenant featured options settings:');
  console.table(prefsResult.rows);

  // Check what the tier gate CTE produces
  const cteQuery = `
    WITH tier_featured_access AS (
      SELECT
        stl.tier_key,
        MAX(CASE WHEN tfl.feature_key = 'featured_enabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS featured_enabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_disabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS featured_disabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_flexible' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS is_flexible,
        MAX(CASE WHEN tfl.feature_key = 'featured_tenant_enabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS tenant_enabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_tenant_disabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS tenant_disabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_platform_enabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS platform_enabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_platform_disabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS platform_disabled,
        array_agg(tfl.feature_key) FILTER (
          WHERE tfl.feature_key LIKE 'featured_%'
            AND tfl.feature_key NOT IN (
              'featured_enabled', 'featured_disabled', 'featured_flexible',
              'featured_tenant_enabled', 'featured_tenant_disabled',
              'featured_platform_enabled', 'featured_platform_disabled'
            )
            AND tfl.is_enabled = true
        ) AS allowed_type_keys
      FROM subscription_tiers_list stl
      JOIN tenants t ON t.subscription_tier = stl.tier_key
      JOIN tier_features_list tfl ON tfl.tier_id = stl.id
      WHERE t.id = $1
        AND tfl.is_enabled = true
        AND tfl.feature_key LIKE 'featured_%'
      GROUP BY stl.tier_key
    )
    SELECT * FROM tier_featured_access
  `;

  const cteResult = await getDirectPool().query(cteQuery, [tenantId]);
  console.log('\nTier featured access CTE result:');
  console.table(cteResult.rows);

  // Test the actual query with tier gate to see what gets filtered (with LIMIT like the endpoint)
  const testQuery = `
    WITH tier_featured_access AS (
      SELECT
        stl.tier_key,
        MAX(CASE WHEN tfl.feature_key = 'featured_enabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS featured_enabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_disabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS featured_disabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_flexible' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS is_flexible,
        MAX(CASE WHEN tfl.feature_key = 'featured_tenant_enabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS tenant_enabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_tenant_disabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS tenant_disabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_platform_enabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS platform_enabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_platform_disabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS platform_disabled,
        array_agg(tfl.feature_key) FILTER (
          WHERE tfl.feature_key LIKE 'featured_%'
            AND tfl.feature_key NOT IN (
              'featured_enabled', 'featured_disabled', 'featured_flexible',
              'featured_tenant_enabled', 'featured_tenant_disabled',
              'featured_platform_enabled', 'featured_platform_disabled'
            )
            AND tfl.is_enabled = true
        ) AS allowed_type_keys
      FROM subscription_tiers_list stl
      JOIN tenants t ON t.subscription_tier = stl.tier_key
      JOIN tier_features_list tfl ON tfl.tier_id = stl.id
      WHERE t.id = $1
        AND tfl.is_enabled = true
        AND tfl.feature_key LIKE 'featured_%'
      GROUP BY stl.tier_key
    )
    SELECT 
      mv.featured_type,
      COUNT(*) as count
    FROM mv_storefront_discovery mv
    LEFT JOIN tier_featured_access tfa ON tfa.tier_key = mv.subscription_tier
    LEFT JOIN tenant_featured_options_settings tfos ON tfos.tenant_id = mv.tenant_id
    WHERE mv.tenant_id = $1
      AND mv.featured_is_active = true
      AND mv.item_status = 'active'
      AND mv.visibility = 'public'
      AND (
        tfa.tier_key IS NULL
        OR (
          tfa.featured_enabled = true AND tfa.featured_disabled = false
          AND (
            mv.featured_type NOT IN ('store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick', 'clearance', 'featured')
            OR (
              tfa.tenant_disabled = false
              AND (
                tfa.is_flexible = true
                OR tfa.tenant_enabled = true
                OR ('featured_' || mv.featured_type) = ANY(tfa.allowed_type_keys)
              )
            )
          )
          AND (
            mv.featured_type NOT IN ('bestseller', 'trending', 'recommended', 'random_featured')
            OR (
              tfa.platform_disabled = false
              AND (
                tfa.is_flexible = true
                OR tfa.platform_enabled = true
                OR ('featured_' || mv.featured_type) = ANY(tfa.allowed_type_keys)
              )
            )
          )
        )
      )
      AND COALESCE(tfos.featured_enabled, true) = true
      AND CASE mv.featured_type
        WHEN 'store_selection' THEN COALESCE(tfos.featured_store_selection, true)
        WHEN 'new_arrival' THEN COALESCE(tfos.featured_new_arrival, true)
        WHEN 'seasonal' THEN COALESCE(tfos.featured_seasonal, true)
        WHEN 'sale' THEN COALESCE(tfos.featured_sale, true)
        WHEN 'staff_pick' THEN COALESCE(tfos.featured_staff_pick, true)
        WHEN 'clearance' THEN COALESCE(tfos.featured_clearance, true)
        WHEN 'featured' THEN COALESCE(tfos.featured_featured, true)
        WHEN 'bestseller' THEN COALESCE(tfos.featured_bestseller, true)
        WHEN 'trending' THEN COALESCE(tfos.featured_trending, true)
        WHEN 'recommended' THEN COALESCE(tfos.featured_recommended, true)
        WHEN 'random_featured' THEN COALESCE(tfos.featured_random_featured, true)
        ELSE false
      END = true
    GROUP BY mv.featured_type
    ORDER BY mv.featured_type
  `;

  const testResult = await getDirectPool().query(testQuery, [tenantId]);
  console.log('\nProducts after tier + tenant gate filtering (no limit):');
  console.table(testResult.rows);

  // Test with LIMIT like the endpoint uses
  const testQueryWithLimit = `
    WITH tier_featured_access AS (
      SELECT
        stl.tier_key,
        MAX(CASE WHEN tfl.feature_key = 'featured_enabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS featured_enabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_disabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS featured_disabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_flexible' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS is_flexible,
        MAX(CASE WHEN tfl.feature_key = 'featured_tenant_enabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS tenant_enabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_tenant_disabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS tenant_disabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_platform_enabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS platform_enabled,
        MAX(CASE WHEN tfl.feature_key = 'featured_platform_disabled' AND tfl.is_enabled = true THEN 1 ELSE 0 END) = 1 AS platform_disabled,
        array_agg(tfl.feature_key) FILTER (
          WHERE tfl.feature_key LIKE 'featured_%'
            AND tfl.feature_key NOT IN (
              'featured_enabled', 'featured_disabled', 'featured_flexible',
              'featured_tenant_enabled', 'featured_tenant_disabled',
              'featured_platform_enabled', 'featured_platform_disabled'
            )
            AND tfl.is_enabled = true
        ) AS allowed_type_keys
      FROM subscription_tiers_list stl
      JOIN tenants t ON t.subscription_tier = stl.tier_key
      JOIN tier_features_list tfl ON tfl.tier_id = stl.id
      WHERE t.id = $1
        AND tfl.is_enabled = true
        AND tfl.feature_key LIKE 'featured_%'
      GROUP BY stl.tier_key
    )
    SELECT 
      mv.featured_type,
      mv.inventory_item_id,
      mv.featured_priority,
      mv.featured_at
    FROM mv_storefront_discovery mv
    LEFT JOIN tier_featured_access tfa ON tfa.tier_key = mv.subscription_tier
    LEFT JOIN tenant_featured_options_settings tfos ON tfos.tenant_id = mv.tenant_id
    WHERE mv.tenant_id = $1
      AND mv.featured_is_active = true
      AND mv.item_status = 'active'
      AND mv.visibility = 'public'
      AND (
        tfa.tier_key IS NULL
        OR (
          tfa.featured_enabled = true AND tfa.featured_disabled = false
          AND (
            mv.featured_type NOT IN ('store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick', 'clearance', 'featured')
            OR (
              tfa.tenant_disabled = false
              AND (
                tfa.is_flexible = true
                OR tfa.tenant_enabled = true
                OR ('featured_' || mv.featured_type) = ANY(tfa.allowed_type_keys)
              )
            )
          )
          AND (
            mv.featured_type NOT IN ('bestseller', 'trending', 'recommended', 'random_featured')
            OR (
              tfa.platform_disabled = false
              AND (
                tfa.is_flexible = true
                OR tfa.platform_enabled = true
                OR ('featured_' || mv.featured_type) = ANY(tfa.allowed_type_keys)
              )
            )
          )
        )
      )
      AND COALESCE(tfos.featured_enabled, true) = true
      AND CASE mv.featured_type
        WHEN 'store_selection' THEN COALESCE(tfos.featured_store_selection, true)
        WHEN 'new_arrival' THEN COALESCE(tfos.featured_new_arrival, true)
        WHEN 'seasonal' THEN COALESCE(tfos.featured_seasonal, true)
        WHEN 'sale' THEN COALESCE(tfos.featured_sale, true)
        WHEN 'staff_pick' THEN COALESCE(tfos.featured_staff_pick, true)
        WHEN 'clearance' THEN COALESCE(tfos.featured_clearance, true)
        WHEN 'featured' THEN COALESCE(tfos.featured_featured, true)
        WHEN 'bestseller' THEN COALESCE(tfos.featured_bestseller, true)
        WHEN 'trending' THEN COALESCE(tfos.featured_trending, true)
        WHEN 'recommended' THEN COALESCE(tfos.featured_recommended, true)
        WHEN 'random_featured' THEN COALESCE(tfos.featured_random_featured, true)
        ELSE false
      END = true
    ORDER BY mv.featured_priority DESC, mv.featured_at DESC
    LIMIT $2
  `;

  const testResultWithLimit = await getDirectPool().query(testQueryWithLimit, [tenantId, 40]);
  console.log('\nProducts with LIMIT 40 (like endpoint):');
  console.table(testResultWithLimit.rows);

  process.exit(0);
}

debugTierGate().catch(console.error);
