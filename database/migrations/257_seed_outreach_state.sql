-- 257_seed_outreach_state.sql
-- Seed Outreach Courtesy Window sprint
-- Adds outreach_state state machine to directory_presence_seeds + allocates
-- 5 product slots to the directory_presence tier.

-- ─── Phase A: outreach_state columns ───────────────────────────────────
ALTER TABLE directory_presence_seeds
  ADD COLUMN IF NOT EXISTS outreach_state TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS outreach_state_entered_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS outreach_scheduled_at TIMESTAMPTZ NULL;

-- Index for the "awaiting outreach" operator queue.
CREATE INDEX IF NOT EXISTS idx_dps_outreach_state
  ON directory_presence_seeds (outreach_state)
  WHERE outreach_state IN ('outreach_scheduled', 'owner_contacted', 'no_response');

-- Backfill: existing published/invited seeds that were created via
-- createFromCampaign (have a primary campaign link) get 'not_started'.
-- No backfill to 'outreach_scheduled' — those seeds already shipped without
-- outreach and are presumed past the courtesy window.
UPDATE directory_presence_seeds
  SET outreach_state = 'not_started'
  WHERE outreach_state IS NULL OR outreach_state = '';

-- ─── Phase E: allocate 5 product slots to the directory_presence tier ───
-- The tier row changes from max_skus = 0 to max_skus = 5. No claim-gate
-- override is needed — unclaimed seeds have no owner account to list
-- products, so authentication is the natural gate. See sprint plan §5.5.
UPDATE subscription_tiers_list
  SET max_skus = 5
  WHERE tier_key = 'directory_presence';
