-- Migration 226: Directory search demand log
--
-- Logs search demand events from the public /place/search page.
-- When users search for a category+city and get zero or few results,
-- that's a demand signal that feeds back into the seek pipeline.

CREATE TABLE IF NOT EXISTS directory_search_demand_log (
  id                SERIAL PRIMARY KEY,
  search_query      VARCHAR(255) NOT NULL,
  resolved_category VARCHAR(100),
  resolved_city     VARCHAR(100),
  result_count      INT NOT NULL DEFAULT 0,
  searched_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash           VARCHAR(64),
  user_agent_hash   VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_dsdl_searched_at ON directory_search_demand_log (searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_dsdl_category_city ON directory_search_demand_log (resolved_category, resolved_city);
CREATE INDEX IF NOT EXISTS idx_dsdl_result_count ON directory_search_demand_log (result_count);
CREATE INDEX IF NOT EXISTS idx_dsdl_query ON directory_search_demand_log (search_query);

-- Dedup index: one demand event per ip_hash + query per day
-- Note: DATE(searched_at) is STABLE not IMMUTABLE so can't be in an index
-- expression. Index on the raw timestamp instead; the dedup query uses
-- DATE(searched_at) = DATE(now()) as a range filter which is supported.
CREATE INDEX IF NOT EXISTS idx_dsdl_dedup ON directory_search_demand_log (ip_hash, search_query, searched_at);
