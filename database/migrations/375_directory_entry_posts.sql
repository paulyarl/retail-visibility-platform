-- Migration 375: Directory-entry posts feed (TENANT_CONTENT_HUB_SPEC Phase 2)
--
-- New capability flag `directory_entry_posts_on` — renders dated owner posts
-- on the claimed directory entry (/directory/<slug>) across all three
-- claimed layouts. Free at claim per spec §5: owner-authored content is what
-- makes each listing unique; the flag is the conversion incentive.
--
-- Grant targets: the Entry Presence triad (presence/discovery/storefront).
-- Enterprise resolves via directory_entry_flexible. directory_presence
-- (unclaimed seeds) gets nothing — seeds have no owner to author.
--
-- Fixture-first: shared/tier-contract.json capability_modules.directory_entry
-- gains the key in this same change; regenerate witness dump after apply.

BEGIN;

-- =============================================================
-- 1. Feature key
-- =============================================================
INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'directory_entry_posts_on',
  'Listing Posts',
  'Publish dated owner updates on the public directory entry',
  'directory_entry', true, 90, NOW(), NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

-- Link feature into the directory_entry capability module
INSERT INTO capability_features_list (id, capability_type_id, feature_id, created_at, updated_at)
SELECT 'cf_de_posts_on', ct.id, fl.id, NOW(), NOW()
FROM capability_type_list ct
CROSS JOIN features_list fl
WHERE ct.key = 'directory_entry'
  AND fl.key = 'directory_entry_posts_on'
  AND NOT EXISTS (
    SELECT 1 FROM capability_features_list cfl
    WHERE cfl.capability_type_id = ct.id AND cfl.feature_id = fl.id
  );

-- =============================================================
-- 2. tenant_place_posts — owner-authored dated updates on the entry
-- =============================================================
CREATE TABLE IF NOT EXISTS tenant_place_posts (
  id              VARCHAR(50)   PRIMARY KEY,
  tenant_id       VARCHAR(255)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  body            TEXT          NOT NULL,
  media_url       TEXT,
  status          VARCHAR(20)   NOT NULL DEFAULT 'PUBLISHED',   -- PUBLISHED | DRAFT | ARCHIVED
  pinned          BOOLEAN       NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ   DEFAULT now(),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpp_tenant_status_published
  ON tenant_place_posts (tenant_id, status, published_at DESC);

-- =============================================================
-- 3. Tier grants — Entry Presence triad (claimed tenants)
-- =============================================================
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  'tf_' || t.tier_key || '_de_posts_on',
  t.id,
  fl.key,
  fl.name,
  true,
  false,
  ct.id
FROM subscription_tiers_list t
CROSS JOIN features_list fl
LEFT JOIN capability_type_list ct ON ct.key = 'directory_entry'
WHERE t.tier_key IN ('presence', 'discovery', 'storefront')
  AND fl.key = 'directory_entry_posts_on'
  AND NOT EXISTS (
    SELECT 1 FROM tier_features_list tfl
    WHERE tfl.tier_id = t.id AND tfl.feature_key = fl.key
  );

COMMIT;

-- =============================================================
-- Verify:
--   SELECT tier_key, feature_key FROM tier_features_list tfl
--   JOIN subscription_tiers_list t ON t.id = tfl.tier_id
--   WHERE feature_key = 'directory_entry_posts_on';
--   → presence, discovery, storefront
-- =============================================================
