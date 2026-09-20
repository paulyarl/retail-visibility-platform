-- ──────────────────────────────────────────────────────────────────────────
-- Migration 301: Profile Repair — fulfillment state, intake short codes,
--                trigger guards, access-intake definition, PB-01 steps
--
-- Spec: docs/LocalBiz/PROFILE_REPAIR_FULFILLMENT_SPRINT.md §4
--
-- Additive only (nullable columns, partial unique index, INSERT … ON CONFLICT).
-- No CHECK constraints touched — mkt_campaigns_list.stage and
-- mkt_dispute_intake.intake_kind have none.
--
-- Changes:
--   1. mkt_campaigns_list.repair_fulfillment jsonb — Track A fulfillment state
--   2. mkt_dispute_intake.short_code + viewed_count — tracked /i/{code} links
--      for EVERY intake kind (not just profile_repair_access)
--   3. mkt_intake_definitions.trigger_guard — declarative AND-conditions on
--      campaign fields evaluated before auto-minting an intake link
--   4. Seed the profile_repair_access intake definition (W3a). Shipped with
--      trigger_stages='[]' per spec edge-case 8: prod schema lands before prod
--      code, so a 'delivered' trigger would auto-mint rows before the
--      trigger_guard evaluator exists. Migration 302 flips it to ['delivered'].
--   5. PB-01 checklist steps: DFY delivered-stage execution steps
--      (pbcs-pb01-009..012) + DIY package-production steps
--      (pbcs-pb01-013..015, stage_tag='paid' so they gate paid → delivered).
--
-- RLS: mkt_* tables do NOT enable RLS (manual-sql-migration-policy §4).
--
-- After applying (tandem staging + prod per AGENTS.md):
--   cd apps/api && doppler run --config local -- pnpm prisma db pull
--   pnpm prisma:generate && pnpm checkapi
--
-- Rollback:
--   DELETE FROM mkt_playbook_checklist_steps WHERE id IN
--     ('pbcs-pb01-009','pbcs-pb01-010','pbcs-pb01-011','pbcs-pb01-012',
--      'pbcs-pb01-013','pbcs-pb01-014','pbcs-pb01-015');
--   DELETE FROM mkt_intake_definitions WHERE intake_kind = 'profile_repair_access';
--   ALTER TABLE mkt_intake_definitions DROP COLUMN IF EXISTS trigger_guard;
--   DROP INDEX IF EXISTS idx_dispute_intake_short_code;
--   ALTER TABLE mkt_dispute_intake DROP COLUMN IF EXISTS short_code,
--     DROP COLUMN IF EXISTS viewed_count;
--   ALTER TABLE mkt_campaigns_list DROP COLUMN IF EXISTS repair_fulfillment;
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── 1. Fulfillment metadata on the campaign ────────────────────────────────

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS repair_fulfillment jsonb;

COMMENT ON COLUMN mkt_campaigns_list.repair_fulfillment IS
  'Track A profile-repair fulfillment state: {tier, mode, platforms[], sla_hours,
   canonical_nap, access_intake_id, access_collected_at, sla_due_at,
   seed_id, seed_claimed, claimed_at, platform_status{}, completion{},
   escalated_from}';

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_repair_fulfillment
  ON mkt_campaigns_list ((repair_fulfillment ->> 'mode'))
  WHERE repair_fulfillment IS NOT NULL;

-- ─── 2. Short code + open counter on ALL intake links ───────────────────────

ALTER TABLE mkt_dispute_intake
  ADD COLUMN IF NOT EXISTS short_code VARCHAR(8),
  ADD COLUMN IF NOT EXISTS viewed_count INT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dispute_intake_short_code
  ON mkt_dispute_intake (short_code)
  WHERE short_code IS NOT NULL;

COMMENT ON COLUMN mkt_dispute_intake.short_code IS
  '6-char curated-alphabet short code for tracked /i/{code} links (SMS/email/QR
   surfaces). Survives token reissue — always resolves to the current token.';
COMMENT ON COLUMN mkt_dispute_intake.viewed_count IS
  'Number of times the intake link was opened (resolveIntake). viewed_at stamps
   first open; viewed_count increments every open.';

-- ─── 3. Declarative guard for intake auto-generation ────────────────────────

ALTER TABLE mkt_intake_definitions
  ADD COLUMN IF NOT EXISTS trigger_guard jsonb;

COMMENT ON COLUMN mkt_intake_definitions.trigger_guard IS
  'Array of {path, op, value} conditions ANDed against the campaign row before
   auto-minting an intake link. path is a dotted campaign field path
   (e.g. "repair_fulfillment.mode"); op ∈ equals|not_equals|in|exists.
   Missing path fails equals/in, passes not_equals.';

-- ─── 4. profile_repair_access intake definition (W3a) ───────────────────────
-- trigger_stages='[]' deliberately: the definition is operator-minted (PATCH
-- repair-fulfillment mode='dfy' opportunistic mint, or the reissue endpoint)
-- until the trigger_guard evaluator is verified live. Migration 302 flips
-- trigger_stages to ['delivered'].

INSERT INTO mkt_intake_definitions (
  intake_kind, label, description, driver, service_category,
  trigger_stages, trigger_guard, submitted_stage,
  form_schema, field_mappings, owner_copy,
  downstream_agent, is_active, is_draft, created_by, created_at, updated_at
) VALUES (
  'profile_repair_access',
  'Profile Repair — Access & Business Info',
  'DFY profile-repair delegated-access intake: owner confirms canonical NAP, grants limited platform roles (never passwords), and uploads evidence. Gates on repair_fulfillment.mode = dfy.',
  'registry',
  NULL,
  '[]'::jsonb,
  '[{"path":"repair_fulfillment.mode","op":"equals","value":"dfy"}]'::jsonb,
  'repair_access_submitted',
  '[
    {"key":"canonical_nap","type":"object","required":true,"label":"Confirm your official business info","help_text":"This is the exact name, address, and phone we will make consistent everywhere.","fields":[
      {"key":"business_name","type":"text","label":"Business name","required":true},
      {"key":"address","type":"text","label":"Street address","required":true},
      {"key":"city","type":"text","label":"City","required":true},
      {"key":"state","type":"text","label":"State","required":true},
      {"key":"zip","type":"text","label":"ZIP","required":true},
      {"key":"phone","type":"phone","label":"Phone","required":true},
      {"key":"website","type":"url","label":"Website (optional)","required":false}
    ]},
    {"key":"platform_access","type":"object","required":true,"label":"Platform access","help_text":"For each platform in your package, grant our team a limited role. We never ask for passwords.","fields":[
      {"key":"google_gbp","type":"select","required":true,"label":"Google Business Profile",
        "options":[{"value":"granted","label":"Granted"},{"value":"pending","label":"I''ll do it shortly"},{"value":"cannot_grant","label":"I can''t grant access"},{"value":"not_applicable","label":"Not applicable"}],
        "help_text":"Add our team as a Manager: Business Profile → Settings → Managers → Add. Never send us your Google password."},
      {"key":"facebook_page","type":"select","required":true,"label":"Facebook Page",
        "options":[{"value":"granted","label":"Granted"},{"value":"pending","label":"I''ll do it shortly"},{"value":"cannot_grant","label":"I can''t grant access"},{"value":"not_applicable","label":"Not applicable"}],
        "help_text":"Page → Settings → Page access → Add our team email with partial access."},
      {"key":"yelp","type":"select","required":true,"label":"Yelp",
        "options":[{"value":"granted","label":"Granted"},{"value":"pending","label":"I''ll do it shortly"},{"value":"cannot_grant","label":"I can''t grant access"},{"value":"not_applicable","label":"Not applicable"}],
        "help_text":"Claim your free Yelp business page, then tell us it''s claimed."},
      {"key":"bbb","type":"select","required":true,"label":"BBB",
        "options":[{"value":"granted","label":"Granted"},{"value":"pending","label":"I''ll do it shortly"},{"value":"cannot_grant","label":"I can''t grant access"},{"value":"not_applicable","label":"Not applicable"}],
        "help_text":"Only if you''re BBB accredited — otherwise mark Not applicable."},
      {"key":"apple_maps","type":"select","required":true,"label":"Apple Maps",
        "options":[{"value":"granted","label":"Granted"},{"value":"pending","label":"I''ll do it shortly"},{"value":"cannot_grant","label":"I can''t grant access"},{"value":"not_applicable","label":"Not applicable"}],
        "help_text":"Premium tier only — mark Not applicable if not in your package."},
      {"key":"bing_places","type":"select","required":true,"label":"Bing Places",
        "options":[{"value":"granted","label":"Granted"},{"value":"pending","label":"I''ll do it shortly"},{"value":"cannot_grant","label":"I can''t grant access"},{"value":"not_applicable","label":"Not applicable"}],
        "help_text":"Premium tier only."}
    ]},
    {"key":"no_password_ack","type":"checkbox","required":true,
      "label":"I understand I should never send account passwords — only delegated access."},
    {"key":"access_notes","type":"textarea","required":false,
      "label":"Anything we should know (logins already shared, platform issues, preferred contact times)"},
    {"key":"evidence_files","type":"attachments","required":false,
      "label":"Evidence (optional): screenshots of wrong listings, a utility bill or photo for address verification, storefront photos"}
  ]'::jsonb,
  '[
    {"field":"canonical_nap","adapter":"repair_canonical_nap_write","config":{"source":"owner_intake"}},
    {"field":"platform_access","adapter":"repair_fulfillment_write"}
  ]'::jsonb,
  '{"title":"Grant access & confirm your business info","subtitle":"So our team can repair your listings","intro":"We never ask for passwords — you grant us a limited role on each platform and can revoke it any time. Your repair clock starts when you submit this form.","success_message":"Received — our team starts within your package''s SLA. You''ll get a completion report when each platform is verified."}'::jsonb,
  NULL,
  true,
  false,
  'system',
  NOW(),
  NOW()
)
ON CONFLICT (intake_kind) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  driver = EXCLUDED.driver,
  service_category = EXCLUDED.service_category,
  trigger_guard = EXCLUDED.trigger_guard,
  submitted_stage = EXCLUDED.submitted_stage,
  form_schema = EXCLUDED.form_schema,
  field_mappings = EXCLUDED.field_mappings,
  owner_copy = EXCLUDED.owner_copy,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ─── 5. PB-01 checklist steps ───────────────────────────────────────────────
-- Migration 175 parked PB-01's tail steps (retainer_pitched / retainer_won /
-- lost / dead — pbcs-pb01-104..107) at step_order 11..14. Shift them +7 so the
-- new paid- and delivered-tagged steps slot into funnel order (paid 11..13,
-- delivered 14..17, tail 18..21). The step_order <= 14 guard keeps re-runs
-- idempotent.
UPDATE mkt_playbook_checklist_steps
SET step_order = step_order + 7, updated_at = NOW()
WHERE id IN ('pbcs-pb01-104','pbcs-pb01-105','pbcs-pb01-106','pbcs-pb01-107')
  AND step_order <= 14;

-- DFY execution steps (stage_tag='delivered' — gate delivered → closed /
-- retainer_pitched). is_required per spec W7a.

INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, v.stage_tag, NOW(), NOW()
FROM mkt_playbook_catalog p
JOIN (VALUES
  ('pbcs-pb01-009', 14, 'Send the DFY access-intake short link',
   'For DFY packages the profile_repair_access intake auto-mints when the campaign enters delivered (or when mode is set to dfy). Copy the /i/{code} short link from the Execution card and send it by SMS or email — pick the channel so the ?surface= attribution is correct.',
   'internal_link', '{"target":"campaign_tab","params":{"tab":"overview"}}', true, 'delivered'),
  ('pbcs-pb01-010', 15, 'Confirm delegated access granted (or follow up)',
   'Watch the Execution card: submitted intake stamps access_collected_at and starts the SLA clock. Platforms the owner marked pending or cannot_grant need a follow-up call — never collect passwords, only delegated roles.',
   'credentials', '{}', true, 'delivered'),
  ('pbcs-pb01-011', 16, 'Execute corrections on each platform and verify live',
   'Work the per-platform rows on the Execution card: apply the canonical NAP and fix-sheet changes, mark each platform in_progress → verified once the live listing shows the correction. Escalate any platform that turns out to be Track B scope (suspension, hijack, ownership dispute).',
   'manual', '{}', true, 'delivered'),
  ('pbcs-pb01-012', 17, 'Generate and deliver the completion report',
   'Once every platform row is verified/done/not_applicable, generate the completion report deliverable and mark it sent — it doubles as the retainer pitch (verified fixes + remaining actions).',
   'deliverable', '{"deliverable_type":"repair_completion_report"}', true, 'delivered')
) AS v(id, step_order, title, instructions, step_type, action_config, is_required, stage_tag)
  ON p.code = 'PB-01'
ON CONFLICT (id) DO UPDATE SET
  step_order = EXCLUDED.step_order,
  title = EXCLUDED.title,
  instructions = EXCLUDED.instructions,
  step_type = EXCLUDED.step_type,
  action_config = EXCLUDED.action_config,
  is_required = EXCLUDED.is_required,
  stage_tag = EXCLUDED.stage_tag,
  updated_at = NOW();

-- DIY/shared package-production steps (stage_tag='paid' — the package must
-- exist before the campaign can legitimately enter delivered).

INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, v.stage_tag, NOW(), NOW()
FROM mkt_playbook_catalog p
JOIN (VALUES
  ('pbcs-pb01-013', 11, 'Run the citation-package fulfill prompt and import analyst output',
   'From the Prompts tab run "Profile Repair — Citation & Profile Repair Package (Fulfill)" — the prompt renders with the audit, the seek briefing, and the purchased tier/platform scope injected. Paste the external analyst output back via the import path.',
   'ai_prompt', '{"target":"campaign_tab","params":{"tab":"prompts","template_id":"mpt-profile-repair-citation-package-fulfill"}}', true, 'paid'),
  ('pbcs-pb01-014', 12, 'Generate and review the Citation & Repair Package PDF',
   'Generate the citation_repair_package deliverable from the completed fulfill execution (Generate Deliverable → pick the execution). Review the canonical NAP block, per-platform fix sheet, and submission guide before sending.',
   'deliverable', '{"deliverable_type":"citation_repair_package"}', true, 'paid'),
  ('pbcs-pb01-015', 13, 'Mark the package deliverable sent',
   'Mark the Citation & Repair Package as sent — this sets delivery_status=delivered and unlocks the Download button in the customer portal.',
   'manual', '{}', true, 'paid')
) AS v(id, step_order, title, instructions, step_type, action_config, is_required, stage_tag)
  ON p.code = 'PB-01'
ON CONFLICT (id) DO UPDATE SET
  step_order = EXCLUDED.step_order,
  title = EXCLUDED.title,
  instructions = EXCLUDED.instructions,
  step_type = EXCLUDED.step_type,
  action_config = EXCLUDED.action_config,
  is_required = EXCLUDED.is_required,
  stage_tag = EXCLUDED.stage_tag,
  updated_at = NOW();

-- ─── Verification (manual, post-apply) ─────────────────────────────────────
-- SELECT intake_kind, trigger_stages, trigger_guard, submitted_stage
--   FROM mkt_intake_definitions WHERE intake_kind='profile_repair_access';
-- SELECT id, step_order, stage_tag, is_required FROM mkt_playbook_checklist_steps
--   WHERE id LIKE 'pbcs-pb01-0%' ORDER BY id;
-- \d mkt_dispute_intake  -- short_code, viewed_count
-- \d mkt_campaigns_list  -- repair_fulfillment

COMMIT;
