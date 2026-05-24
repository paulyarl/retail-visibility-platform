/**
 * Tier-Capability SQL Fragments
 *
 * Shared SQL fragments for capability-aware featured product queries.
 * Two layers of filtering:
 *   1. Tier capability: what the subscription plan allows (from tier_features_list)
 *   2. Tenant preferences: what the tenant has toggled on/off (from tenant_featured_options_settings)
 *
 * Used by:
 *   - directory-random-featured-global
 *   - storefront-featured (all-buckets + per-type)
 *   - directory-featured-products
 *   - directory-random-featured
 *   - FeaturedService (public products/featured)
 *   - directory-premium-featured
 */

// ====================
// CTE: Tier Featured Access
// ====================

/**
 * CTE that pre-computes allowed featured types per tier.
 * Returns one row per tier_key with boolean flags + array of allowed type keys.
 *
 * Handles:
 *   - featured_enabled / featured_disabled (global gate)
 *   - featured_flexible (all types allowed)
 *   - featured_tenant_enabled / featured_tenant_disabled (tenant-controlled group)
 *   - featured_platform_enabled / featured_platform_disabled (platform-controlled group)
 *   - Individual featured_{type} keys (e.g., featured_bestseller, featured_sale)
 */
export const TIER_FEATURED_ACCESS_CTE = `
  tier_featured_access AS (
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
    JOIN tier_features_list tfl ON tfl.tier_id = stl.id
    WHERE tfl.is_enabled = true
      AND tfl.feature_key LIKE 'featured_%'
    GROUP BY stl.tier_key
  )
`;

// ====================
// JOIN + WHERE fragments (Tier Capability)
// ====================

/** LEFT JOIN clause for mv_global_discovery → tier_featured_access */
export const TIER_FEATURED_ACCESS_JOIN = `LEFT JOIN tier_featured_access tfa ON tfa.tier_key = mgd.subscription_tier`;

/**
 * WHERE conditions that enforce tier capability gates.
 * Must be ANDed into the existing WHERE clause.
 *
 * Gates:
 *   1. featured_enabled = true AND featured_disabled = false
 *   2. Specific featured_type allowed (flexible OR featured_{type} in allowed_type_keys)
 *   3. Tenant-controlled group gate (tenant_enabled AND NOT tenant_disabled)
 *   4. Platform-controlled group gate (platform_enabled AND NOT platform_disabled)
 */
export const TIER_FEATURED_ACCESS_WHERE = `
  -- Capability gate: tier must have featured enabled and not disabled
  AND (tfa.featured_enabled = true AND tfa.featured_disabled = false)
  -- Capability gate: specific featured_type must be allowed
  AND (
    tfa.is_flexible = true
    OR ('featured_' || mgd.featured_type) = ANY(tfa.allowed_type_keys)
  )
  -- Group gate: tenant-controlled types
  AND (
    mgd.featured_type NOT IN ('store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick', 'clearance', 'featured')
    OR (tfa.tenant_enabled = true AND tfa.tenant_disabled = false)
  )
  -- Group gate: platform-controlled types
  AND (
    mgd.featured_type NOT IN ('bestseller', 'trending', 'recommended', 'random_featured')
    OR (tfa.platform_enabled = true AND tfa.platform_disabled = false)
  )
`;

// ====================
// JOIN + WHERE fragments (Tenant Preferences)
// ====================

/**
 * LEFT JOIN clause for mv_global_discovery → tenant_featured_options_settings.
 * Joins on tenant_id so each product row is checked against its owner's preferences.
 */
export const TENANT_PREFS_JOIN = `LEFT JOIN tenant_featured_options_settings tfos ON tfos.tenant_id = mgd.tenant_id`;

/**
 * WHERE conditions that enforce tenant preference gates.
 * Must be ANDed into the existing WHERE clause (after tier capability gates).
 *
 * When no settings row exists (new tenant), defaults apply:
 *   - featured_enabled = true
 *   - Tenant-controlled types = true (on by default)
 *   - Platform-controlled types = false (off by default)
 *
 * Gates:
 *   1. Tenant must have featured_enabled = true (or no row = default true)
 *   2. Specific featured_type must be toggled on in tenant settings
 */
export const TENANT_PREFS_WHERE = `
  -- Tenant preference gate: tenant must have featured enabled
  AND COALESCE(tfos.featured_enabled, true) = true
  -- Tenant preference gate: specific featured_type must be toggled on
  AND CASE mgd.featured_type
    WHEN 'store_selection' THEN COALESCE(tfos.featured_store_selection, true)
    WHEN 'new_arrival' THEN COALESCE(tfos.featured_new_arrival, true)
    WHEN 'seasonal' THEN COALESCE(tfos.featured_seasonal, true)
    WHEN 'sale' THEN COALESCE(tfos.featured_sale, true)
    WHEN 'staff_pick' THEN COALESCE(tfos.featured_staff_pick, true)
    WHEN 'clearance' THEN COALESCE(tfos.featured_clearance, true)
    WHEN 'featured' THEN COALESCE(tfos.featured_featured, true)
    WHEN 'bestseller' THEN COALESCE(tfos.featured_bestseller, false)
    WHEN 'trending' THEN COALESCE(tfos.featured_trending, false)
    WHEN 'recommended' THEN COALESCE(tfos.featured_recommended, false)
    WHEN 'random_featured' THEN COALESCE(tfos.featured_random_featured, false)
    ELSE false
  END = true
`;

// ====================
// Convenience: Full CTE block (WITH clause)
// ====================

/**
 * Complete WITH clause for the tier_featured_access CTE.
 * Prepend to any query that needs capability-aware filtering.
 * Usage: `WITH ${TIER_FEATURED_ACCESS_WITH} SELECT ...`
 */
export const TIER_FEATURED_ACCESS_WITH = TIER_FEATURED_ACCESS_CTE;

// ====================
// Tenant-controlled and platform-controlled type lists
// ====================

export const TENANT_CONTROLLED_TYPES = ['store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick', 'clearance', 'featured'];
export const PLATFORM_CONTROLLED_TYPES = ['bestseller', 'trending', 'recommended', 'random_featured'];
