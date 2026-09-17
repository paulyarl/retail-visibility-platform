-- Migration 224: Growth engine daily metrics table
--
-- Stores daily aggregation of the growth engine funnel metrics
-- per category/city. Populated by a nightly aggregation job.

CREATE TABLE IF NOT EXISTS growth_engine_daily_metrics (
  id              SERIAL PRIMARY KEY,
  metric_date     DATE NOT NULL,
  category        VARCHAR(100) NOT NULL DEFAULT '__all__',
  city            VARCHAR(100) NOT NULL DEFAULT '__all__',
  seeks_run       INT NOT NULL DEFAULT 0,
  prospects_queued INT NOT NULL DEFAULT 0,
  seeds_created   INT NOT NULL DEFAULT 0,
  seeds_published INT NOT NULL DEFAULT 0,
  seeds_claimed   INT NOT NULL DEFAULT 0,
  seeds_upgraded  INT NOT NULL DEFAULT 0,
  directory_views INT NOT NULL DEFAULT 0,
  claim_cta_clicks INT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for upsert (one row per date+category+city)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gedm_date_cat_city
  ON growth_engine_daily_metrics (metric_date, category, city);

CREATE INDEX IF NOT EXISTS idx_gedm_date ON growth_engine_daily_metrics (metric_date);
CREATE INDEX IF NOT EXISTS idx_gedm_category ON growth_engine_daily_metrics (category);
CREATE INDEX IF NOT EXISTS idx_gedm_city ON growth_engine_daily_metrics (city);
