-- 361 — Tier inheritance edges.
--
-- The capability architecture resolves WHAT a tenant has; it has never known what a tier SHOULD
-- have. Order/inheritance/closure existed only as codebase assertions (shared/tier-contract.json,
-- web TIER_HIERARCHY, contract suites), so the capability admin UI could empty a tier and nothing
-- objected — the web path still gated on the static copy while the API resolver served the emptied
-- rows. This table gives the graph a runtime home so both paths can read it.
--
-- Seeded from shared/tier-contract.json inheritance.edges (already the transitive CLOSURE by
-- contract, so storing it verbatim is idempotent under the resolver's union walk).
-- Apply: cd apps/api && doppler run --config prd -- node scripts/apply-sql-file.cjs ../../database/migrations/361_tier_inheritance_edges.sql

CREATE TABLE IF NOT EXISTS tier_inheritance_edges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_tier_key  varchar(64) NOT NULL,
  parent_tier_key varchar(64) NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tier_inheritance_edges_unique UNIQUE (child_tier_key, parent_tier_key),
  CONSTRAINT tier_inheritance_edges_no_self CHECK (child_tier_key <> parent_tier_key)
);

CREATE INDEX IF NOT EXISTS idx_tier_inheritance_child ON tier_inheritance_edges (child_tier_key);

INSERT INTO tier_inheritance_edges (child_tier_key, parent_tier_key) VALUES
  ('google_only', 'directory_presence'),
  ('presence', 'directory_presence'),
  ('starter', 'google_only'),
  ('starter', 'directory_presence'),
  ('discovery', 'google_only'),
  ('discovery', 'directory_presence'),
  ('storefront', 'discovery'),
  ('storefront', 'google_only'),
  ('storefront', 'directory_presence'),
  ('commitment', 'storefront'),
  ('commitment', 'discovery'),
  ('commitment', 'google_only'),
  ('commitment', 'directory_presence'),
  ('ecommerce', 'storefront'),
  ('ecommerce', 'discovery'),
  ('ecommerce', 'google_only'),
  ('ecommerce', 'directory_presence'),
  ('omnichannel', 'commitment'),
  ('omnichannel', 'ecommerce'),
  ('omnichannel', 'storefront'),
  ('omnichannel', 'discovery'),
  ('omnichannel', 'google_only'),
  ('omnichannel', 'directory_presence'),
  ('professional', 'omnichannel'),
  ('professional', 'commitment'),
  ('professional', 'ecommerce'),
  ('professional', 'storefront'),
  ('professional', 'discovery'),
  ('professional', 'google_only'),
  ('professional', 'directory_presence'),
  ('enterprise', 'professional'),
  ('enterprise', 'omnichannel'),
  ('enterprise', 'commitment'),
  ('enterprise', 'ecommerce'),
  ('enterprise', 'storefront'),
  ('enterprise', 'discovery'),
  ('enterprise', 'google_only'),
  ('enterprise', 'directory_presence'),
  ('organization', 'professional'),
  ('organization', 'omnichannel'),
  ('organization', 'commitment'),
  ('organization', 'ecommerce'),
  ('organization', 'storefront'),
  ('organization', 'discovery'),
  ('organization', 'google_only'),
  ('organization', 'directory_presence'),
  ('chain_starter', 'starter'),
  ('chain_starter', 'google_only'),
  ('chain_starter', 'directory_presence'),
  ('chain_professional', 'professional'),
  ('chain_professional', 'omnichannel'),
  ('chain_professional', 'commitment'),
  ('chain_professional', 'ecommerce'),
  ('chain_professional', 'storefront'),
  ('chain_professional', 'discovery'),
  ('chain_professional', 'google_only'),
  ('chain_professional', 'directory_presence'),
  ('chain_enterprise', 'enterprise'),
  ('chain_enterprise', 'professional'),
  ('chain_enterprise', 'omnichannel'),
  ('chain_enterprise', 'commitment'),
  ('chain_enterprise', 'ecommerce'),
  ('chain_enterprise', 'storefront'),
  ('chain_enterprise', 'discovery'),
  ('chain_enterprise', 'google_only'),
  ('chain_enterprise', 'directory_presence')
ON CONFLICT (child_tier_key, parent_tier_key) DO NOTHING;
