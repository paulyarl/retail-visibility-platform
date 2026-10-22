-- Migration 354: Google Maps ground-truth packet cache (HasData)
--
-- Campaign-keyed cache for the opt-in `google_maps_ground_truth` audit
-- directive (OUTREACH_TOUCH_LADDER_SPEC §14). Each row is one fetched
-- HasData Maps packet — the resolved place identity is persisted so
-- refreshes skip the (paid) search call, and `fetched_at` drives the
-- TTL gate (30d — the layer effect re-reads the cache, not the API).
--
-- One row per (campaign_id, level): 'latest' is the default packet
-- (details + latest-N reviews); 'deep' adds posts/photos for forensics.
--
-- No RLS, no triggers — matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

CREATE TABLE IF NOT EXISTS mkt_ground_truth_packets (
  id             VARCHAR(255) PRIMARY KEY,
  campaign_id    VARCHAR(255) NOT NULL
    REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,

  -- Resolved place identity — persisted so refreshes skip the paid
  -- search call (§14.2 spend controls)
  place_id       VARCHAR(255),
  data_id        VARCHAR(255),

  -- Fetch level + the normalized packet (rating, review_count, reviews[],
  -- topics, owner-response stats, posts, website)
  level          VARCHAR(10) NOT NULL,
  packet         JSONB NOT NULL,

  -- Spend tracking — credits this fetch consumed (for budget surface)
  credits_spent  INTEGER NOT NULL DEFAULT 0,

  fetched_at     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  fetched_by     VARCHAR(255),
  created_at     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT chk_gtp_level CHECK (level IN ('latest', 'deep'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ground_truth_packets_campaign_level
  ON mkt_ground_truth_packets(campaign_id, level);

-- Verification queries (run manually after applying):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mkt_ground_truth_packets' ORDER BY ordinal_position;

COMMIT;
