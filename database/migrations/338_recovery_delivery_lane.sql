-- Migration 338: recovery delivery lane — DIY vs DFY on the recovery template
--
-- The recovery lane (PB-04 / A2) now records a dfy/diy delivery lane in
-- `mkt_campaigns_list.playbook_decision` (kind='recovery_delivery_mode'),
-- exactly as PB-08 namespaces kind='website_build_scope'. The division of
-- labour is the lane's own: the platform produces the written case either way,
-- and the fork is who FILES it —
--   DIY — the owner posts the response and submits the appeal.
--   DFY — the platform files on the owner's behalf, on delegated access.
--
-- `RecoveryResolutionService` (all three variable-building sites) and
-- `MarketingExecutionService`'s recovery auto-source branch both supply
-- {{delivery_mode}} — the one-line brief, '' when the lane is unsettled. This
-- migration teaches the template to read it and declares it in `variables`.
--
-- The clause lands BEFORE the INPUTS block so it reads as an instruction rather
-- than an afterthought. The anchor is the bare `INPUTS:` header, NOT
-- `E'\nINPUTS:\n'` — the stored body's line endings are whatever the seeding
-- client sent, so a newline-anchored replace silently no-ops on CRLF.
-- Idempotent: guarded on the placeholder's absence, and the variables append is
-- guarded by a jsonb containment check.
--
-- Data-only, additive, idempotent. Apply against local + prd (SOP).

BEGIN;

UPDATE mkt_prompt_templates_list
SET body = replace(
      body,
      'INPUTS:',
      E'DELIVERY LANE:\n{{delivery_mode}}\n'
      || E'When that line is blank the lane is not settled — write both parts as if the owner will act.\n'
      || E'- diy: the OWNER posts the response and submits the appeal. Write submissionGuide as instructions the owner can follow.\n'
      || E'- dfy: the PLATFORM posts and files on the owner''s behalf on delegated access. Write submissionGuide as the internal filing record (what will be filed, where, and how it will be verified) — the owner takes no action.\n\n'
      || 'INPUTS:'
    ),
    variables = CASE
      WHEN variables @> '["delivery_mode"]'::jsonb THEN variables
      ELSE variables || '["delivery_mode"]'::jsonb
    END,
    updated_at = now()
WHERE id = 'mpt-recovery-resolution-default'
  AND body LIKE '%INPUTS:%'
  AND body NOT LIKE '%{{delivery_mode}}%';

COMMIT;

-- ─── Verification (run manually after applying) ──────────────────────────
-- SELECT position('{{delivery_mode}}' in body) AS dm_pos, variables::text
--   FROM mkt_prompt_templates_list WHERE id = 'mpt-recovery-resolution-default';
--   Expect dm_pos > 0 and "delivery_mode" in variables.
