-- Migration 343: GBP Autopilot (Tier B) merchant opt-in + autonomy threshold
--
-- Adds the owner-facing soft gate for the Tier B review autopilot:
--   gbp_autopilot_enabled    — owner opt-in (default false — autopilot is off
--                              unless the merchant explicitly turns it on)
--   gbp_autopilot_min_rating — lowest star rating that may be auto-replied
--                              (default 5 — only 5★ auto-publishes; lower
--                              ratings are left for a human)
--
-- The hard gate stays `gbp_ai_response` (tier / BSaaS / grant / flexible);
-- these columns are the merchant soft gate on top of it, per R33.
--
-- Plumbing only: the `gbp-review-autopilot` job is declared in the JobRegistry
-- catalog but not scheduled, and `GBPReviewReplyService.runAutopilot` no-ops
-- unless GBP_AUTOPILOT_ENABLED=true. See docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §4 Subsystem 2 / §9 Phase 2.5.

ALTER TABLE tenant_gbp_options_settings
  ADD COLUMN IF NOT EXISTS gbp_autopilot_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gbp_autopilot_min_rating INTEGER DEFAULT 5;

-- Guard the threshold to the 1–5 star range at the storage boundary.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_gbp_options_autopilot_min_rating_range'
  ) THEN
    ALTER TABLE tenant_gbp_options_settings
      ADD CONSTRAINT tenant_gbp_options_autopilot_min_rating_range
      CHECK (gbp_autopilot_min_rating IS NULL OR (gbp_autopilot_min_rating BETWEEN 1 AND 5));
  END IF;
END $$;
