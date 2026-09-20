-- Migration 304: Wire the website_build intake's playbook trigger
--
-- Spec: docs/LocalBiz/WEBSITE_GAP_AUDIT_PLAYBOOK_SPEC.md §8.5 / OQ-8
--
-- Migration 303 seeded the `website_build` mkt_intake_definitions row INERT
-- (trigger_stages = []). 303 is already applied, so its content is frozen —
-- this follow-up applies the playbook linkage on top:
--
--   * trigger_stages = ["paid"]  — auto-offer when a campaign reaches `paid`
--     (the build kickoff).
--   * trigger_guard  = [{ path: "playbook_code", op: "equals", value: "PB-08" }]
--     — the declarative guard (migration 301) scopes the trigger to PB-08
--     campaigns only, so it does NOT fire for other paid campaigns.
--
-- Paired code change (deployed separately): MarketingCampaignService's
-- registry-intake auto-gen gate (`runsReviewPipeline`) now includes PB-08 —
-- without it the hook never runs for a profile_repair campaign with no
-- repair_track.
--
-- Idempotent — a plain UPDATE. Re-running is a no-op. A 303 re-run does NOT
-- clobber these fields (303's ON CONFLICT DO UPDATE omits trigger_stages and
-- trigger_guard by design).
--
-- Prerequisite: migration 303 (which creates the website_build row).
--
-- Apply in tandem against local + prd (SOP).

BEGIN;

UPDATE mkt_intake_definitions
SET trigger_stages = '["paid"]'::jsonb,
    trigger_guard  = '[{"path":"playbook_code","op":"equals","value":"PB-08"}]'::jsonb,
    updated_at     = now()
WHERE intake_kind = 'website_build';

COMMIT;

-- ─── Verification (run manually after applying) ──────────────────────────
-- SELECT intake_kind, trigger_stages, trigger_guard
--   FROM mkt_intake_definitions WHERE intake_kind = 'website_build';
--   Expect trigger_stages = ["paid"] and
--          trigger_guard  = [{"path":"playbook_code","op":"equals","value":"PB-08"}].
