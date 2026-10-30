-- Migration 369: GBP access lifecycle columns (model B)
--
-- Spec: docs/LocalBiz/GBP_DFY_MANAGEMENT_SPEC.md §3.3
-- Sprint: docs/LocalBiz/GBP_DFY_SPRINT_PLAN.md D7
--
-- claim_state tracks the access lifecycle on a managed location:
--   pending_request  — requestAdminRightsUri submitted; owner hasn't approved
--   active           — platform access confirmed (admins.list shows our row)
--   denied           — owner refused the admin-rights request
--   revoked          — drift check found our admin row removed
--   handoff_pending  — OWNER invitation sent to merchant at offboard
--   offboarded       — platform admin row removed; merchant owns the listing
-- claim_requested_at / offboarded_at carry the timing.

ALTER TABLE gbp_locations_list
  ADD COLUMN IF NOT EXISTS claim_state        VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS claim_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offboarded_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_gbp_locations_claim_state ON gbp_locations_list (claim_state);
