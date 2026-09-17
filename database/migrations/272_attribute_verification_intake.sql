-- Migration 272: Attribute Verification intake definition
--
-- Operator-triggered intake kind that turns a business audit's
-- recommended_attributes into owner-confirmation questions. The owner picks
-- which recommended attribute chips actually apply to their business;
-- confirmed keys write through to the seed listing's attributes JSONB via
-- the directory_attributes_write adapter (source_name: owner_intake).
--
-- Wiring:
--   - trigger_stages is EMPTY — this kind never auto-generates on a stage
--     transition. The operator mints the link explicitly (admin
--     reissue-link endpoint accepts any intakeKind), which is the control
--     point for "should we ask the owner about attributes".
--   - The chips field's options resolve dynamically per campaign through
--     the 'campaign_recommended_attributes' options_source — the public
--     options endpoint reads the campaign's latest business_analysis audit.
--   - SNAP/EBT is refused by the write adapter — it keeps its dedicated
--     columns and stricter contract (migration 207).
--
-- All statements are idempotent (ON CONFLICT DO UPDATE).

BEGIN;

INSERT INTO mkt_intake_definitions (
  intake_kind, label, description, driver,
  service_category, trigger_stages, submitted_stage,
  form_schema, field_mappings, owner_copy, niche_overrides,
  downstream_agent, version, is_active, is_draft
) VALUES (
  'attribute_verification',
  'Attribute Verification',
  'Owner confirms which recommended profile attributes apply to their business. ' ||
    'Options are populated per-campaign from the latest business audit''s recommended_attributes.',
  'registry',
  NULL,
  '[]'::jsonb,
  'intake_submitted',
  '[
    {
      "key": "confirmed_attributes",
      "type": "chips",
      "label": "Which of these apply to your business?",
      "help_text": "Select every attribute that is true for your business — they become chips on your public listing.",
      "required": false,
      "options_source": "campaign_recommended_attributes"
    },
    {
      "key": "attribute_notes",
      "type": "textarea",
      "label": "Anything else about your business we should feature? (optional)",
      "required": false
    }
  ]'::jsonb,
  '[
    { "field": "confirmed_attributes", "adapter": "directory_attributes_write", "config": { "source": "owner_intake" } }
  ]'::jsonb,
  '{
    "title": "Confirm your business attributes",
    "subtitle": "Help us get your public listing right",
    "intro": "We found a few things that may apply to your business. Select the ones that are true and we will feature them on your listing.",
    "success_message": "Thank you — your selections will be reflected on your public listing."
  }'::jsonb,
  '{}'::jsonb,
  NULL,
  1,
  true,
  false
)
ON CONFLICT (intake_kind) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  form_schema = EXCLUDED.form_schema,
  field_mappings = EXCLUDED.field_mappings,
  owner_copy = EXCLUDED.owner_copy,
  version = mkt_intake_definitions.version + 1,
  updated_at = now();

COMMIT;
