-- ============================================================
-- Migration 173: Intake Portal Generalization — registry + composite unique
-- ============================================================
-- Description:
--   Generalizes mkt_dispute_intake from a one-intake-per-campaign table
--   (recovery-only) to a multi-kind intake collection mechanism. A new
--   registry table, mkt_intake_definitions, drives every non-recovery
--   intake kind via declarative form_schema / field_mappings / owner_copy
--   JSONB — so niche/service scans (auto repair: ~10 services) become
--   definition rows, not code.
--
--   Changes:
--   1. CREATE mkt_intake_definitions — the registry. Natural-key PK on
--      intake_kind (VARCHAR(40)). Seeded with 4 rows: 2 code-defined
--      (dispute, profile_repair) + 2 registry-defined (gbp_optimization,
--      review_response_setup) with their form_schema / field_mappings /
--      owner_copy JSONB. Includes created_by / updated_by / is_draft
--      columns for future admin authoring (§7.6 of the plan).
--   2. Drop the inline UNIQUE on mkt_dispute_intake.campaign_id (auto-
--      named mkt_dispute_intake_campaign_id_key by Postgres from
--      migration 149 line 76). Replace with composite
--      UNIQUE(campaign_id, intake_kind) so a campaign can have parallel
--      recovery + GBP + review intakes.
--   3. Widen intake_kind from VARCHAR(20) to VARCHAR(40) and add FK to
--      mkt_intake_definitions(intake_kind). No CHECK constraint — the FK
--      gives integrity while new kinds become INSERTs, not migrations.
--   4. Update comments.
--
--   No RLS, no triggers — mkt_* namespace convention (see
--   manual-sql-migration-policy.md §4 "Marketing Ops namespace exception").
--
-- Prerequisite: 172_mkt_business_type_categories.sql applied
-- Date: 2026-08-06
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Create mkt_intake_definitions (the registry)
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_intake_definitions (
  intake_kind        VARCHAR(40)   PRIMARY KEY,
  label              VARCHAR(255)  NOT NULL,
  description        TEXT,
  driver             VARCHAR(10)   NOT NULL DEFAULT 'registry',  -- 'code' | 'registry'
  service_category   VARCHAR(100),                                -- purchased service that triggers this intake
  trigger_stages     JSONB         NOT NULL DEFAULT '[]'::jsonb,  -- pipeline stages that auto-generate the link
  submitted_stage    VARCHAR(50),                                 -- campaign stage on submission
  form_schema        JSONB         NOT NULL DEFAULT '[]'::jsonb,  -- field list for dynamic form + Zod builder
  field_mappings     JSONB         NOT NULL DEFAULT '[]'::jsonb,  -- [{ field, adapter, config? }] write-behind
  owner_copy         JSONB         NOT NULL DEFAULT '{}'::jsonb,  -- title, subtitle, intro, success_message
  niche_overrides    JSONB         NOT NULL DEFAULT '{}'::jsonb,  -- keyed by lowercased GBP category
  downstream_agent   VARCHAR(100),                                -- label for stub / future agent wiring
  version            INT           NOT NULL DEFAULT 1,
  is_active          BOOLEAN       NOT NULL DEFAULT true,
  is_draft           BOOLEAN       NOT NULL DEFAULT false,        -- future admin authoring (§7.6)
  created_by         VARCHAR(255),                                -- 'system' for seeds, user ID for admin-authored
  updated_by         VARCHAR(255),
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_intake_definitions_active
  ON mkt_intake_definitions(is_active, is_draft);
CREATE INDEX IF NOT EXISTS idx_mkt_intake_definitions_service_category
  ON mkt_intake_definitions(service_category)
  WHERE service_category IS NOT NULL;

COMMENT ON TABLE mkt_intake_definitions IS 'Registry of intake form definitions. Code-defined kinds (dispute, profile_repair) have hardcoded flows; registry-defined kinds drive dynamic validation + rendering via form_schema JSONB.';
COMMENT ON COLUMN mkt_intake_definitions.intake_kind IS 'Natural-key PK, referenced by mkt_dispute_intake.intake_kind FK';
COMMENT ON COLUMN mkt_intake_definitions.driver IS 'code = hardcoded dispute/profile_repair flow; registry = dynamic form_schema + write-behind adapters';
COMMENT ON COLUMN mkt_intake_definitions.service_category IS 'Purchased service that triggers this intake — matches mkt_campaigns_list.service_category';
COMMENT ON COLUMN mkt_intake_definitions.trigger_stages IS 'Pipeline stages that auto-generate the intake link, e.g. ["paid","retainer_won"]';
COMMENT ON COLUMN mkt_intake_definitions.submitted_stage IS 'Campaign stage set on submission — must be reachable in the campaign transition map';
COMMENT ON COLUMN mkt_intake_definitions.form_schema IS 'Field list: [{ key, type, label, help_text, required, validation, options, options_source, custom_validator }]';
COMMENT ON COLUMN mkt_intake_definitions.field_mappings IS 'Write-behind: [{ field, adapter, config? }] — adapters are whitelisted code functions';
COMMENT ON COLUMN mkt_intake_definitions.owner_copy IS 'Page copy: { title, subtitle, intro, statement_label, success_message }';
COMMENT ON COLUMN mkt_intake_definitions.niche_overrides IS 'Keyed by lowercased GBP category: { "auto repair": { add_fields, field_overrides, owner_copy_overrides } }';
COMMENT ON COLUMN mkt_intake_definitions.is_draft IS 'Future admin authoring — drafts are not live (resolve/submit gates on is_draft = false)';

-- ============================================================
-- STEP 2: Seed code-defined definitions (dispute, profile_repair)
-- ============================================================
-- These mark existing hardcoded flows in the registry so the FK works
-- and the admin can see all intake kinds in one place. No form_schema —
-- the code handles validation + rendering for these.

INSERT INTO mkt_intake_definitions (intake_kind, label, description, driver, trigger_stages, submitted_stage, owner_copy, is_active, is_draft, created_by)
VALUES
  (
    'dispute',
    'Dispute Intake (Recovery Management)',
    'Owner-submitted dispute statement + proposed resolution for BBB/legal de-escalation recovery campaigns.',
    'code',
    '["outreach_dispatched"]'::jsonb,
    'intake_submitted',
    '{"title":"Dispute Resolution Intake","subtitle":"Help us resolve your case","intro":"Please provide your side of the dispute so we can draft a resolution on your behalf.","statement_label":"What happened?","success_message":"Your dispute intake has been submitted. We will draft a resolution and contact you shortly."}'::jsonb,
    true,
    false,
    'system'
  ),
  (
    'profile_repair',
    'Profile Repair Intake (Escalated)',
    'Owner-submitted evidence for escalated GBP profile repair (suspensions, hijacks, duplicates, ownership disputes).',
    'code',
    '["outreach_dispatched"]'::jsonb,
    'intake_submitted',
    '{"title":"Profile Repair Intake","subtitle":"Help us restore your Google Business Profile","intro":"Please provide the evidence below so we can file an appeal on your behalf.","statement_label":"Describe the issue","success_message":"Your profile repair evidence has been submitted. We will file the appeal and contact you shortly."}'::jsonb,
    true,
    false,
    'system'
  )
ON CONFLICT (intake_kind) DO NOTHING;

-- ============================================================
-- STEP 3: Seed registry-defined definitions (gbp_optimization, review_response_setup)
-- ============================================================
-- These are the first two registry kinds. form_schema + field_mappings +
-- owner_copy drive dynamic validation + rendering + write-behind.

INSERT INTO mkt_intake_definitions (intake_kind, label, description, driver, service_category, trigger_stages, submitted_stage, form_schema, field_mappings, owner_copy, downstream_agent, is_active, is_draft, created_by)
VALUES
  (
    'gbp_optimization',
    'Google Business Profile Optimization',
    'Owner confirms hours, service area, booking URL, categories, attributes, and uploads photos for GBP optimization + recurring maintenance.',
    'registry',
    NULL,  -- matches any GBP-related service (trigger_stages drives auto-gen)
    '["paid","retainer_won"]'::jsonb,
    'gbp_intake_submitted',
    -- form_schema: 7 fields
    '[
      {"key":"confirmed_hours","type":"hours_grid","label":"Business Hours","help_text":"Confirm your hours for each day. Mark closed if you are not open.","required":true},
      {"key":"service_area","type":"chips","label":"Service Area","help_text":"List the cities or zip codes you serve (for service-area businesses).","required":false},
      {"key":"booking_url","type":"url","label":"Booking URL","help_text":"Your online booking or appointment URL, if you have one.","required":false},
      {"key":"category_preferences","type":"multiselect","label":"GBP Categories","help_text":"Select the categories that best describe your business.","required":true,"options_source":"gbp_categories","custom_validator":"gbp_category_ids_exist"},
      {"key":"attribute_confirmations","type":"object","label":"Attribute Confirmations","help_text":"Confirm or correct the attributes shown for your business.","required":false,"options_source":"gbp_attribute_definitions"},
      {"key":"photo_uploads","type":"attachments","label":"Photos","help_text":"Upload your logo, storefront interior, and work samples.","required":false},
      {"key":"owner_notes","type":"textarea","label":"Additional Notes","help_text":"Anything else we should know about your profile?","required":false}
    ]'::jsonb,
    -- field_mappings: write-behind adapters
    '[
      {"field":"confirmed_hours","adapter":"business_hours_write"},
      {"field":"category_preferences","adapter":"gbp_categories_write"},
      {"field":"attribute_confirmations","adapter":"gbp_attributes_write"},
      {"field":"photo_uploads","adapter":"gbp_media_write"},
      {"field":"service_area","adapter":"payload_only"},
      {"field":"booking_url","adapter":"payload_only"},
      {"field":"owner_notes","adapter":"payload_only"}
    ]'::jsonb,
    '{"title":"Google Business Profile Setup","subtitle":"Confirm your profile details","intro":"Please confirm or update your business information so we can optimize your Google Business Profile.","statement_label":"Additional Notes","success_message":"Your profile information has been submitted. We will optimize your Google Business Profile and contact you if we need anything else."}'::jsonb,
    'gbp_sync_agent',
    true,
    false,
    'system'
  ),
  (
    'review_response_setup',
    'Review Response + Owner Voice Setup',
    'Owner configures their voice profile, response approval policy, and review-request preferences for the review-response workflow.',
    'registry',
    NULL,
    '["paid","retainer_won"]'::jsonb,
    'review_setup_submitted',
    -- form_schema: 4 fields
    '[
      {"key":"voice_profile","type":"object","label":"Your Voice","help_text":"How should we sound when responding to reviews on your behalf?","required":true,"fields":[
        {"key":"person","type":"select","label":"Person","required":true,"options":[{"value":"first","label":"First person (I/we)"},{"value":"third","label":"Third person (the team)"}]},
        {"key":"formality","type":"select","label":"Formality","required":true,"options":[{"value":"casual","label":"Casual"},{"value":"professional","label":"Professional"}]},
        {"key":"humor","type":"select","label":"Humor","required":true,"options":[{"value":"yes","label":"Yes"},{"value":"no","label":"No"},{"value":"sometimes","label":"Sometimes"}]},
        {"key":"apology_style","type":"select","label":"Apology Style","required":true,"options":[{"value":"direct","label":"Direct"},{"value":"empathetic","label":"Empathetic"},{"value":"brief","label":"Brief"}]},
        {"key":"signoff_style","type":"select","label":"Sign-off Style","required":true,"options":[{"value":"first-name","label":"First name"},{"value":"full-name","label":"Full name"},{"value":"none","label":"No sign-off"}]},
        {"key":"signature","type":"text","label":"Signature","required":false,"validation":{"max":100}}
      ]},
      {"key":"response_policy","type":"object","label":"Response Policy","help_text":"How should we handle review responses?","required":true,"fields":[
        {"key":"approval_mode","type":"radio","label":"Approval Mode","required":true,"options":[{"value":"owner_reviews","label":"I review each response before it is posted"},{"value":"auto_publish","label":"Auto-publish responses (I trust the team)"}]},
        {"key":"negative_threshold","type":"select","label":"Negative Review Threshold","required":true,"options":[{"value":"1","label":"1 star"},{"value":"2","label":"2 stars"},{"value":"3","label":"3 stars"},{"value":"4","label":"4 stars"}],"help_text":"Star rating below which you must approve the response before posting."},
        {"key":"escalation_email","type":"email","label":"Escalation Email","required":false,"help_text":"Email for urgent negative review alerts."}
      ]},
      {"key":"review_request_config","type":"object","label":"Review Request Setup","help_text":"How and where should we request reviews from your customers?","required":true,"fields":[
        {"key":"platforms","type":"multiselect","label":"Platforms","required":true,"options":[{"value":"google","label":"Google"},{"value":"facebook","label":"Facebook"},{"value":"yelp","label":"Yelp"}]},
        {"key":"timing","type":"select","label":"Request Timing","required":true,"options":[{"value":"after_service","label":"After each service"},{"value":"weekly","label":"Weekly digest"},{"value":"manual","label":"Manual (I will trigger)"}]},
        {"key":"request_template_preferences","type":"textarea","label":"Template Preferences","required":false,"help_text":"Any preferences for how review requests should be worded?"}
      ]},
      {"key":"owner_notes","type":"textarea","label":"Additional Notes","help_text":"Anything else we should know about your review management?","required":false}
    ]'::jsonb,
    -- field_mappings
    '[
      {"field":"voice_profile","adapter":"owner_voice_profile_upsert"},
      {"field":"response_policy","adapter":"review_pipeline_per_platform"},
      {"field":"review_request_config","adapter":"review_pipeline_per_platform"},
      {"field":"owner_notes","adapter":"payload_only"}
    ]'::jsonb,
    '{"title":"Review Response Setup","subtitle":"Configure your review management","intro":"Tell us how you want reviews handled so we can respond on your behalf and request reviews from your customers.","statement_label":"Additional Notes","success_message":"Your review management preferences have been saved. We will set up your review response workflow and contact you if we need anything else."}'::jsonb,
    'review_request_agent',
    true,
    false,
    'system'
  )
ON CONFLICT (intake_kind) DO NOTHING;

-- ============================================================
-- STEP 4: Drop inline UNIQUE on campaign_id, add composite unique
-- ============================================================
-- The inline UNIQUE on campaign_id (migration 149 line 76) was auto-named
-- mkt_dispute_intake_campaign_id_key by Postgres. Drop it and replace
-- with a composite unique so a campaign can have parallel intakes of
-- different kinds.

ALTER TABLE mkt_dispute_intake
  DROP CONSTRAINT IF EXISTS mkt_dispute_intake_campaign_id_key;

-- Guard: if the auto-name differs, drop by finding the unique constraint
-- on campaign_id dynamically. This DO block handles both cases.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'mkt_dispute_intake'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 1
      AND conkey[1] = (
        SELECT attnum FROM pg_attribute
        WHERE attrelid = 'mkt_dispute_intake'::regclass
          AND attname = 'campaign_id'
      )
  ) THEN
    -- Already dropped or named differently — nothing to do
    NULL;
  ELSE
    ALTER TABLE mkt_dispute_intake
      DROP CONSTRAINT mkt_dispute_intake_campaign_id_key;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- If the constraint name doesn't match, the DROP CONSTRAINT above
  -- already failed silently via IF EXISTS. This block is a safety net.
  NULL;
END $$;

-- Add composite unique: one intake per (campaign, kind)
ALTER TABLE mkt_dispute_intake
  ADD CONSTRAINT uq_mkt_dispute_intake_campaign_kind
    UNIQUE (campaign_id, intake_kind);

-- ============================================================
-- STEP 5: Widen intake_kind + add FK to mkt_intake_definitions
-- ============================================================

ALTER TABLE mkt_dispute_intake
  ALTER COLUMN intake_kind TYPE VARCHAR(40);

ALTER TABLE mkt_dispute_intake
  ADD CONSTRAINT fk_dispute_intake_kind
    FOREIGN KEY (intake_kind) REFERENCES mkt_intake_definitions(intake_kind);

COMMENT ON COLUMN mkt_dispute_intake.intake_kind IS 'Intake kind — FK to mkt_intake_definitions. dispute = recovery management; profile_repair = escalated profile repair; gbp_optimization = GBP optimization; review_response_setup = review response workflow. New kinds are INSERTs into mkt_intake_definitions, not migrations.';

COMMENT ON COLUMN mkt_dispute_intake.evidence_payload IS 'Structured evidence/payload for the intake kind — shaped by the definition form_schema (registry kinds) or the hardcoded schema (dispute/profile_repair).';

COMMENT ON TABLE mkt_dispute_attachments IS 'Proof files attached to an intake submission. Serves all intake kinds (dispute, profile_repair, gbp_optimization, review_response_setup). The dispute_intake_id FK column name is historical — the column is generic.';

-- ============================================================
-- VERIFICATION (run manually after applying)
-- ============================================================
-- SELECT intake_kind, label, driver, is_active, is_draft FROM mkt_intake_definitions ORDER BY intake_kind;
--   -- expect 4 rows: dispute, gbp_optimization, profile_repair, review_response_setup
--
-- \d mkt_dispute_intake
--   -- confirm: campaign_id no longer UNIQUE, composite UNIQUE(campaign_id, intake_kind) exists
--   -- confirm: intake_kind VARCHAR(40) with FK to mkt_intake_definitions
--
-- After verification:
--   cd apps/api
--   doppler run --config local -- pnpm prisma db pull
--   pnpm prisma:generate
--   pnpm checkapi   -- will enumerate Phase 3b relation-ripple breaks
--
-- ============================================================
-- ROLLBACK
-- ============================================================
-- ALTER TABLE mkt_dispute_intake DROP CONSTRAINT IF EXISTS fk_dispute_intake_kind;
-- ALTER TABLE mkt_dispute_intake ALTER COLUMN intake_kind TYPE VARCHAR(20);
-- ALTER TABLE mkt_dispute_intake DROP CONSTRAINT IF EXISTS uq_mkt_dispute_intake_campaign_kind;
-- ALTER TABLE mkt_dispute_intake ADD CONSTRAINT mkt_dispute_intake_campaign_id_key UNIQUE (campaign_id);
-- DROP TABLE IF EXISTS mkt_intake_definitions;

COMMIT;
