-- Migration 222: Directory places search index + sitemap log
--
-- Adds a tsvector expression index for full-text search across
-- business_name, city, state, and category on directory_listings_list.
-- Also adds a trigram similarity index on business_name for fuzzy search.
-- Adds a sitemap generation log table.

-- Enable pg_trgm if not already enabled (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index on business_name for fuzzy/similarity search
CREATE INDEX IF NOT EXISTS idx_dll_business_name_trgm
  ON directory_listings_list USING gin (business_name gin_trgm_ops);

-- Composite tsvector expression index for full-text search
-- Covers business_name, city, state for published directory_seed listings
CREATE INDEX IF NOT EXISTS idx_dll_places_fts
  ON directory_listings_list USING gin (
    to_tsvector('english',
      coalesce(business_name, '') || ' ' ||
      coalesce(city, '') || ' ' ||
      coalesce(state, '') || ' ' ||
      coalesce(slug, '')
    )
  )
  WHERE is_published = true AND listing_origin = 'directory_seed';

-- Sitemap generation log
CREATE TABLE IF NOT EXISTS directory_places_sitemap_log (
  id            SERIAL PRIMARY KEY,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  url_count     INT NOT NULL,
  etag          VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_dpsl_generated_at
  ON directory_places_sitemap_log (generated_at DESC);
