-- Migration 265: Category Market Enrichment (Phase 1)
-- Adds market-level SEO enrichment table, tenant listing enrichment log,
-- and operator-override attribution columns to seed provenance.
-- Idempotent: all CREATE/ADD use IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS directory_category_enrichment (
  id                              text PRIMARY KEY,
  category_key                    text NOT NULL,
  category_name                   text NOT NULL,
  city                            text NOT NULL,
  state                           text NOT NULL,
  meta_title                      text,
  description                     text,
  keywords                        text[] NOT NULL DEFAULT '{}',
  secondary_categories            text[] NOT NULL DEFAULT '{}',
  schema_type_hint                text,
  operator_override_description   text,
  operator_override_meta_title    text,
  operator_override_keywords      text[],
  override_by                     text,
  override_at                     timestamptz,
  intelligence_profile_id         text,
  gold_standard_profile_id        text,
  composer_version                int  NOT NULL DEFAULT 1,
  enriched_at                     timestamptz NOT NULL DEFAULT now(),
  enriched_by                     text,
  trigger_source                  text NOT NULL DEFAULT 'manual'
                                  CHECK (trigger_source IN ('manual', 'profile_activated')),
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_key, city, state)
);

CREATE INDEX IF NOT EXISTS idx_dce_markets
  ON directory_category_enrichment (category_key, state, city);

CREATE TABLE IF NOT EXISTS directory_listing_enrichment_log (
  id                       text PRIMARY KEY,
  tenant_id                text NOT NULL,
  listing_id               text NOT NULL,
  category_key             text NOT NULL,
  city                     text NOT NULL,
  state                    text NOT NULL,
  fields_projected         text[] NOT NULL DEFAULT '{}',
  fields_skipped           text[] NOT NULL DEFAULT '{}',
  skip_reasons             jsonb,
  fields_values            jsonb,
  intelligence_profile_id  text,
  composer_version         int  NOT NULL DEFAULT 1,
  enriched_at              timestamptz NOT NULL DEFAULT now(),
  enriched_by              text,
  trigger_source           text NOT NULL
    CHECK (trigger_source IN ('manual', 'profile_activated', 'operator_override', 'operator_reset', 'owner_edit')),
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dlel_listing_latest
  ON directory_listing_enrichment_log (listing_id, enriched_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlel_tenant
  ON directory_listing_enrichment_log (tenant_id, enriched_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlel_market
  ON directory_listing_enrichment_log (category_key, city, state, enriched_at DESC);

ALTER TABLE directory_field_provenance
  ADD COLUMN IF NOT EXISTS override_by text,
  ADD COLUMN IF NOT EXISTS override_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_dll_market_scan
  ON directory_listings_list (LOWER(primary_category), LOWER(city), state)
  WHERE is_published;
