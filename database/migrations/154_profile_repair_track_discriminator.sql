-- Migration 154: Profile Repair — campaign track discriminator + intake generalization
--
-- Adds profile_repair as a third campaign category with a nullable
-- repair_track discriminator (NULL = triage, 'standard' = review pipeline,
-- 'escalated' = recovery pipeline). Also generalizes mkt_dispute_intake
-- to support profile repair evidence collection via intake_kind.
--
-- Per PROFILE_REPAIR_INTEGRATION_SPEC.md §3.
-- Sprint P1 — Profile Repair Integration.

-- ─── Campaign columns ─────────────────────────────────────────────

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS repair_track          VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS repair_issue_type     VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS track_decided_at      TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS track_decision_reason TEXT NULL;

-- Guard: track must be a known value when set
ALTER TABLE mkt_campaigns_list
  DROP CONSTRAINT IF EXISTS chk_repair_track;

ALTER TABLE mkt_campaigns_list
  ADD CONSTRAINT chk_repair_track
  CHECK (repair_track IS NULL OR repair_track IN ('standard', 'escalated'));

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_repair_track
  ON mkt_campaigns_list (campaign_category, repair_track);

COMMENT ON COLUMN mkt_campaigns_list.repair_track IS 'NULL = triage; standard = review pipeline; escalated = recovery pipeline (profile_repair category only)';
COMMENT ON COLUMN mkt_campaigns_list.repair_issue_type IS 'Profile repair issue type: nap_drift, unclaimed_profile, missing_category, missing_hours, platform_gap (standard); suspension, duplicate_listing, hijacked_listing, ownership_dispute, address_verification_block (escalated)';
COMMENT ON COLUMN mkt_campaigns_list.track_decided_at IS 'When the repair track was confirmed by the operator';
COMMENT ON COLUMN mkt_campaigns_list.track_decision_reason IS 'Operator note or AI rationale snapshot for the track decision';

-- ─── Intake generalization ────────────────────────────────────────

ALTER TABLE mkt_dispute_intake
  ADD COLUMN IF NOT EXISTS intake_kind       VARCHAR(20) NOT NULL DEFAULT 'dispute',
  ADD COLUMN IF NOT EXISTS evidence_payload  JSONB NULL;

COMMENT ON COLUMN mkt_dispute_intake.intake_kind IS 'dispute = recovery management; profile_repair = escalated profile repair evidence intake';
COMMENT ON COLUMN mkt_dispute_intake.evidence_payload IS 'Structured evidence fields for profile repair intakes (proof_of_location, storefront_photos, google_profile_id, suspension_notice_details, duplicate_listing_url)';

-- ─── Seed: profile_repair_triage prompt template ──────────────────
-- The triage prompt analyzes audit signals and recommends a track.

INSERT INTO mkt_prompt_templates_list (
  id,
  name,
  prompt_type,
  category,
  version,
  body,
  variables,
  is_active,
  is_default,
  created_by,
  created_at,
  updated_at,
  tone,
  scope,
  output_schema
) VALUES (
  'mpt-profile-repair-triage-default',
  'Profile Repair Triage Analysis (Default)',
  'seek',
  'profile_repair',
  1,
  $BODY$You are a local business profile repair analyst.

Your task is to assess the severity of a business profile issue and recommend a repair track.

## Business

Business Name: {{business_name}}
City: {{city}}
State: {{state}}
Category: {{category}}

## Audit Signals

{{audit_signals}}

## Issue Type (initial diagnosis)

{{issue_type}}

## Instructions

Analyze the audit signals and determine:

1. **Severity score** (1-10): How damaging is this profile issue to the business's local search visibility and customer acquisition?
2. **Recommended track**: Should this be handled as a routine fix (standard) or an escalated appeal (escalated)?
3. **Rationale**: Why this track? What evidence supports it?

### Track criteria

- **Escalated** (severity 7-10): The profile is suspended, hijacked, duplicated, or has an ownership dispute. These require evidence collection and formal appeal submission to the platform.
- **Standard** (severity 1-6): The profile has NAP drift, is unclaimed, has missing categories, or is missing from secondary platforms. These are routine fixes that can be pitched as a package.

### Heuristic guardrails

- Any signal containing: suspension, hijacked_listing, duplicate_listing, ownership_dispute, address_verification_block → recommend escalated
- Only nap_drift, unclaimed_profile, missing_category, missing_hours, platform_gap signals → recommend standard

## Output

Return valid JSON only with this shape:

{
  "profile_repair_triage": {
    "severity_score": 1,
    "recommended_track": "standard",
    "issue_type_confirmed": "nap_drift",
    "rationale": "Explanation of the assessment",
    "escalation_signals": [],
    "standard_signals": ["nap_drift"]
  }
}
$BODY$,
  '["business_name","city","state","category","audit_signals","issue_type"]'::jsonb,
  true,
  true,
  'system',
  NOW(),
  NOW(),
  NULL,
  'business',
  NULL
)
ON CONFLICT (id) DO NOTHING;
