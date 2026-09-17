-- Migration 182: Backfill pre-accepted triage results for sibling campaigns
--
-- Fixes the gap where sibling campaigns created via "Create Sibling" on a
-- triage alternative had no mkt_campaign_triage_results row, so the checklist
-- tab showed "No playbook assigned yet" even though the operator explicitly
-- chose a playbook. BusinessProspectService.createSiblingCampaign now creates
-- a pre-accepted triage result at creation time; this migration backfills the
-- ones already created before that code fix.
--
-- Also repairs siblings whose pre-accepted triage was overwritten by the
-- GET /triage/alternatives endpoint (which called evaluateAllForCampaign →
-- evaluateTriageForCampaign, resetting is_operator_accepted to null and
-- replacing the recommended playbook with a fresh evaluation).
--
-- Strategy:
--   For each non-primary sibling campaign (is_primary_sibling = false) that
--   either has NO triage result OR has a triage result with
--   is_operator_accepted IS NULL, create/repair a pre-accepted triage result
--   keyed to the playbook that matches the sibling's (campaign_category,
--   repair_track) combination. The detected_signals + source_audit_id are
--   inherited from the primary sibling's triage result (the signals that
--   triggered the alternative match in the first place).
--
-- Data-only migration. No schema changes, no prisma db pull required.
--
-- Date: 2026-08-09

-- ─── Step 1: Backfill siblings with NO triage result ────────────────────
-- These are siblings created before the createSiblingCampaign code fix.

INSERT INTO mkt_campaign_triage_results (
  id, campaign_id, recommended_playbook_id, confidence_score,
  triage_reasoning, detected_signals, is_operator_accepted,
  overridden_playbook_id, source_audit_id, evaluated_at, created_at, updated_at
)
SELECT
  'trg-sib-' || s.id,
  s.id,
  pb.id,
  COALESCE((pb.matching_rules->>'confidence')::numeric, 0.85),
  'Sibling campaign backfill: operator explicitly chose '
    || pb.code || ' (' || pb.name
    || ') when creating this sibling from a triage alternative.',
  COALESCE(pt.detected_signals, '[]'::jsonb),
  true,
  NULL,
  pt.source_audit_id,
  NOW(),
  NOW(),
  NOW()
FROM mkt_campaigns_list s
-- Resolve the playbook matching the sibling's (category, repair_track).
-- For profile_repair + standard track, prefer the playbook whose archetype
-- matches the sibling's archetype (resolved via the primary sibling's triage
-- or the campaign's archetype signal). We join on category; if multiple
-- playbooks share a category, pick the one with the lowest priority_rank
-- (highest priority) as a reasonable default.
JOIN LATERAL (
  SELECT p.* FROM mkt_playbook_catalog p
  WHERE p.category = s.campaign_category
    AND p.is_active = true
  ORDER BY p.priority_rank ASC
  LIMIT 1
) pb ON true
-- Inherit detected_signals + source_audit from the primary sibling's triage
LEFT JOIN LATERAL (
  SELECT t.detected_signals, t.source_audit_id
  FROM mkt_campaign_triage_results t
  JOIN mkt_campaigns_list ps ON ps.id = t.campaign_id
  WHERE ps.business_prospect_id = s.business_prospect_id
    AND ps.is_primary_sibling = true
  LIMIT 1
) pt ON true
WHERE s.is_primary_sibling = false
  AND s.business_prospect_id IS NOT NULL
  AND s.scope = 'business'
  AND NOT EXISTS (
    SELECT 1 FROM mkt_campaign_triage_results t WHERE t.campaign_id = s.id
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Step 2: Repair siblings whose triage was overwritten (is_operator_accepted IS NULL) ──
-- These are siblings where createSiblingCampaign created a pre-accepted triage
-- result, but the GET /triage/alternatives endpoint overwrote it with a fresh
-- evaluation that reset is_operator_accepted to null and swapped the playbook.

UPDATE mkt_campaign_triage_results t
SET
  recommended_playbook_id = COALESCE(
    -- Prefer the playbook matching the sibling's campaign_category
    (SELECT p.id FROM mkt_playbook_catalog p
     WHERE p.category = s.campaign_category AND p.is_active = true
     ORDER BY p.priority_rank ASC LIMIT 1),
    t.recommended_playbook_id
  ),
  is_operator_accepted = true,
  triage_reasoning = COALESCE(
    t.triage_reasoning || ' [REPAIRED: sibling triage decision restored]',
    'Sibling campaign triage decision restored (was overwritten by alternatives endpoint).'
  ),
  updated_at = NOW()
FROM mkt_campaigns_list s
WHERE t.campaign_id = s.id
  AND s.is_primary_sibling = false
  AND s.business_prospect_id IS NOT NULL
  AND s.scope = 'business'
  AND t.is_operator_accepted IS NULL
  AND t.overridden_playbook_id IS NULL;

-- ─── Verification ───────────────────────────────────────────────────────
-- Run manually after applying:
--   SELECT s.id, s.business_name, s.campaign_category, s.is_primary_sibling,
--          t.recommended_playbook_id, t.is_operator_accepted
--   FROM mkt_campaigns_list s
--   LEFT JOIN mkt_campaign_triage_results t ON t.campaign_id = s.id
--   WHERE s.business_prospect_id IS NOT NULL AND s.scope = 'business'
--   ORDER BY s.business_prospect_id, s.is_primary_sibling DESC;
-- Expected: every sibling has a triage result with is_operator_accepted = true.
