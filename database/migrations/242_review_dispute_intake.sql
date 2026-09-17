-- Migration 242: review_dispute intake definition seed
--
-- Registers the 'review_dispute' intake kind in mkt_intake_definitions so the
-- GBP customer portal can submit review disputes via DisputeIntakeService.
-- The dispute bridge POST /reviews/:id/dispute calls generateIntakeLink with
-- intake_kind='review_dispute', then submitRegistryIntake.
--
-- Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §4 Subsystem 2
-- Sprint: docs/LocalBiz/GBP_SPRINT_PHASE2.md Task 8

INSERT INTO mkt_intake_definitions (
  intake_kind,
  label,
  description,
  driver,
  service_category,
  trigger_stages,
  submitted_stage,
  form_schema,
  field_mappings,
  owner_copy,
  niche_overrides,
  downstream_agent,
  version,
  is_active,
  is_draft,
  created_by,
  updated_by
) VALUES (
  'review_dispute',
  'Review Dispute',
  'Submit a dispute for a Google Business Profile review that you believe is fraudulent, spam, or violates Google''s review policies.',
  'registry',
  NULL,
  '[]'::jsonb,
  'review_dispute_submitted',
  '[
    {
      "name": "dispute_reason",
      "label": "Reason for dispute",
      "type": "select",
      "required": true,
      "options": [
        { "value": "spam", "label": "Spam or fake review" },
        { "value": "off_topic", "label": "Off-topic" },
        { "value": "harassment", "label": "Harassment or hate speech" },
        { "value": "conflict_of_interest", "label": "Conflict of interest" },
        { "value": "impersonation", "label": "Impersonation" },
        { "value": "other", "label": "Other" }
      ]
    },
    {
      "name": "dispute_explanation",
      "label": "Detailed explanation",
      "type": "textarea",
      "required": true,
      "help": "Explain why this review should be removed. Be specific and factual."
    },
    {
      "name": "evidence_urls",
      "label": "Evidence URLs (optional)",
      "type": "multiselect",
      "required": false,
      "help": "Links to supporting evidence (screenshots, records, etc.)"
    }
  ]'::jsonb,
  '[]'::jsonb,
  '{
    "heading": "Dispute a Google Review",
    "intro": "Use this form to dispute a Google Business Profile review. Our team will review your submission and escalate to Google if appropriate.",
    "submitLabel": "Submit Dispute"
  }'::jsonb,
  '{}'::jsonb,
  'review_dispute_agent',
  1,
  true,
  false,
  'system',
  'system'
)
ON CONFLICT (intake_kind) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  form_schema = EXCLUDED.form_schema,
  owner_copy = EXCLUDED.owner_copy,
  is_active = true,
  updated_at = NOW();
