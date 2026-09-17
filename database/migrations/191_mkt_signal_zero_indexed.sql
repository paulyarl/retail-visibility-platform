-- Migration 191: Signal Registry Seed — DS_ZERO_INDEXED_PRESENCE
--
-- Registers the DS_ZERO_INDEXED_PRESENCE signal in the mkt_signal_registry
-- under family 'DS' (Digital Surface & Profile). This signal is emitted by
-- V3 Emerging-Discovery audits when a business has no usable online footprint
-- — no website, no meaningful Google presence.
--
-- The operator vocabulary uses the EF_ prefix (EF_ZERO_INDEXED_PRESENCE);
-- the signal registry uses the DS_ prefix to match the family name. The
-- EF_ alias is documented in the description.
--
-- This signal boosts the zero_footprint hook angle in ranking — see
-- outreach-openers/emerging-angle-map.ts and the hook catalog's signal list.
--
-- Data-only migration. No schema changes, no prisma db pull required.
-- Idempotent via ON CONFLICT (code) DO NOTHING.
--
-- See docs/LocalBiz/marketing_ops_cold_call_channel_sprint_plan.md §13.4
--
-- Date: 2026-08-12

INSERT INTO mkt_signal_registry (id, code, family, label, description, detection_source, derived_rule, is_active)
VALUES
  ('sig-ds-zero-indexed', 'DS_ZERO_INDEXED_PRESENCE', 'DS', 'Zero indexed presence',
   'No usable online footprint found — no website, no meaningful Google presence. Emitted by V3 Emerging-Discovery audits (operator vocabulary: EF_ZERO_INDEXED_PRESENCE). Boosts the zero_footprint hook angle.',
   'model_emitted', NULL, true)
ON CONFLICT (code) DO NOTHING;

-- ─── Verification ────────────────────────────────────────────────────────
--
-- SELECT code, family, label, detection_source, is_active
-- FROM mkt_signal_registry WHERE code = 'DS_ZERO_INDEXED_PRESENCE';
