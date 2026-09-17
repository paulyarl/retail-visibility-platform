-- 259_seed_outreach_touches.sql
-- Outreach touch log for the seed funnel (spec §7 gap 4, sprint plan W1).
--
-- The 257 outreach_state machine tracks *state* (pending → contacted → ...),
-- not individual touches. CAC (G5) needs a numerator: how many calls, emails,
-- mail pieces were made per cohort, and what was the outcome of each.
--
-- One row per manual outreach touch (call / email / sms / mail / other).
--   channel  — how the touch was made
--   outcome  — what happened (NULL until the operator records it)
--   notes    — free-text per-touch notes
--   operator_id — the platform staff user who made the touch
--   occurred_at — when the touch happened (defaults to now)
--
-- See: docs/LocalBiz/seed_funnel_benchmark_gates_sprint_plan.md §4 W1

CREATE TABLE IF NOT EXISTS directory_seed_outreach_touches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id      TEXT NOT NULL REFERENCES directory_presence_seeds(id) ON DELETE CASCADE,
  tenant_id    TEXT NOT NULL,
  channel      TEXT NOT NULL CHECK (channel IN ('call','email','sms','mail','other')),
  outcome      TEXT NULL CHECK (outcome IN ('connected','no_response','voicemail','bad_number','claimed','not_interested')),
  notes        TEXT,
  operator_id  TEXT NULL,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dsot_seed_occurred
  ON directory_seed_outreach_touches (seed_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_dsot_tenant
  ON directory_seed_outreach_touches (tenant_id);
