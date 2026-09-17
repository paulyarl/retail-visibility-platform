-- ──────────────────────────────────────────────────────────────────────────
-- Migration 156: Profile Repair — Track A prompt templates + service categories
--
-- Seeds:
--  1. Track A seek prompt templates (nap_drift, unclaimed_profile, platform_gap)
--  2. Track A fulfill prompt template (citation_repair_package)
--  3. Service category values: profile_repair_audit, profile_repair_package,
--     profile_repair_appeal (for coupon validation per vector)
--
-- Profile Repair Integration P3.
--
-- RLS: mkt_* tables do NOT enable RLS (see .devin/skills/manual-sql-migration-policy.md
-- §4 — Marketing Ops namespace exception). No policy needed.
--
-- Rollback:
--   DELETE FROM mkt_prompt_templates_list WHERE id IN (
--     'mpt-profile-repair-nap-drift-seek',
--     'mpt-profile-repair-unclaimed-seek',
--     'mpt-profile-repair-platform-gap-seek',
--     'mpt-profile-repair-citation-package-fulfill'
--   );
--   DELETE FROM mkt_service_categories_list WHERE value IN (
--     'profile_repair_audit', 'profile_repair_package', 'profile_repair_appeal'
--   );
-- ──────────────────────────────────────────────────────────────────────────

-- ─── Track A seek prompt: NAP drift ─────────────────────────────────

INSERT INTO mkt_prompt_templates_list (
  id, name, prompt_type, category, version, body, variables,
  is_active, is_default, created_by, created_at, updated_at, tone, scope, output_schema
) VALUES (
  'mpt-profile-repair-nap-drift-seek',
  'Profile Repair — NAP Drift Audit (Seek)',
  'seek',
  'profile_repair',
  1,
  $BODY$You are a local business profile auditor analyzing NAP (Name, Address, Phone) consistency.

BUSINESS:
- Name: {{business_name}}
- City: {{city}}
- Category: {{category}}

AUDIT SIGNALS:
{{audit_signals}}

TASK:
Analyze the NAP consistency across platforms (Google, Apple, Bing, Yelp, etc.) and produce:
1. severityScore (1-10) — how impactful is the NAP drift on local search visibility?
2. inconsistentPlatforms — list of platforms where NAP differs from the canonical record
3. recommendedFixes — specific corrections needed per platform
4. openerAngle — the pain point to lead with in the opener pitch (e.g. "customers are calling the wrong number")

Return JSON:
{
  "profile_repair_audit": {
    "severityScore": 1,
    "issueType": "nap_drift",
    "inconsistentPlatforms": [],
    "recommendedFixes": [],
    "openerAngle": ""
  }
}$BODY$,
  '["business_name","city","category","audit_signals"]'::jsonb,
  true, false, 'system', NOW(), NOW(), NULL, 'business',
  '{"name": "profile_repair_audit", "fields": {"severityScore": "number", "issueType": "string", "inconsistentPlatforms": "string[]", "recommendedFixes": "string[]", "openerAngle": "string"}}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, variables = EXCLUDED.variables, output_schema = EXCLUDED.output_schema, updated_at = NOW();

-- ─── Track A seek prompt: Unclaimed profile ────────────────────────

INSERT INTO mkt_prompt_templates_list (
  id, name, prompt_type, category, version, body, variables,
  is_active, is_default, created_by, created_at, updated_at, tone, scope, output_schema
) VALUES (
  'mpt-profile-repair-unclaimed-seek',
  'Profile Repair — Unclaimed Profile Audit (Seek)',
  'seek',
  'profile_repair',
  1,
  $BODY$You are a local business profile auditor analyzing an unclaimed Google Business Profile.

BUSINESS:
- Name: {{business_name}}
- City: {{city}}
- Category: {{category}}

AUDIT SIGNALS:
{{audit_signals}}

TASK:
Analyze the impact of the unclaimed profile and produce:
1. severityScore (1-10) — how much visibility/control is the business losing?
2. missedFeatures — GBP features unavailable to unclaimed profiles (posts, insights, Q&A, messaging)
3. competitorGap — how far behind competitors who have claimed their profiles?
4. openerAngle — the pain point to lead with (e.g. "competitors are stealing your map clicks")

Return JSON:
{
  "profile_repair_audit": {
    "severityScore": 1,
    "issueType": "unclaimed_profile",
    "missedFeatures": [],
    "competitorGap": "",
    "openerAngle": ""
  }
}$BODY$,
  '["business_name","city","category","audit_signals"]'::jsonb,
  true, false, 'system', NOW(), NOW(), NULL, 'business',
  '{"name": "profile_repair_audit", "fields": {"severityScore": "number", "issueType": "string", "missedFeatures": "string[]", "competitorGap": "string", "openerAngle": "string"}}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, variables = EXCLUDED.variables, output_schema = EXCLUDED.output_schema, updated_at = NOW();

-- ─── Track A seek prompt: Platform gap ──────────────────────────────

INSERT INTO mkt_prompt_templates_list (
  id, name, prompt_type, category, version, body, variables,
  is_active, is_default, created_by, created_at, updated_at, tone, scope, output_schema
) VALUES (
  'mpt-profile-repair-platform-gap-seek',
  'Profile Repair — Platform Gap Audit (Seek)',
  'seek',
  'profile_repair',
  1,
  $BODY$You are a local business profile auditor analyzing platform coverage gaps.

BUSINESS:
- Name: {{business_name}}
- City: {{city}}
- Category: {{category}}

AUDIT SIGNALS:
{{audit_signals}}

TASK:
Analyze which platforms the business is missing from and produce:
1. severityScore (1-10) — how many local search calls are being lost?
2. missingPlatforms — platforms where the business has no listing (Apple Maps, Bing Places, Yelp, etc.)
3. estimatedReachLoss — estimated percentage of local searchers who won't find the business
4. openerAngle — the pain point to lead with (e.g. "iPhone users can't find you on Apple Maps")

Return JSON:
{
  "profile_repair_audit": {
    "severityScore": 1,
    "issueType": "platform_gap",
    "missingPlatforms": [],
    "estimatedReachLoss": "",
    "openerAngle": ""
  }
}$BODY$,
  '["business_name","city","category","audit_signals"]'::jsonb,
  true, false, 'system', NOW(), NOW(), NULL, 'business',
  '{"name": "profile_repair_audit", "fields": {"severityScore": "number", "issueType": "string", "missingPlatforms": "string[]", "estimatedReachLoss": "string", "openerAngle": "string"}}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, variables = EXCLUDED.variables, output_schema = EXCLUDED.output_schema, updated_at = NOW();

-- ─── Track A fulfill prompt: Citation repair package ────────────────

INSERT INTO mkt_prompt_templates_list (
  id, name, prompt_type, category, version, body, variables,
  is_active, is_default, created_by, created_at, updated_at, tone, scope, output_schema
) VALUES (
  'mpt-profile-repair-citation-package-fulfill',
  'Profile Repair — Citation & Profile Repair Package (Fulfill)',
  'fulfill',
  'profile_repair',
  1,
  $BODY$You are a local business profile repair specialist constructing a citation and profile repair package.

BUSINESS:
- Name: {{business_name}}
- City: {{city}}
- Category: {{category}}

AUDIT RESULTS:
{{audit_results}}

TASK:
Produce a complete Citation & Profile Repair Package that the owner can follow to fix their NAP consistency, claim their profiles, and close platform gaps. The package must include:
1. deliverableText — a structured guide with:
   - Canonical NAP record (the authoritative name/address/phone to use everywhere)
   - Per-platform fix instructions (Google, Apple, Bing, Yelp, etc.)
   - Claim links for unclaimed profiles
   - Step-by-step correction instructions for each inconsistent platform
   - Verification steps to confirm fixes are live
2. submissionGuide — how the owner can verify the repairs are working (search for their business on each platform, check NAP matches, monitor call tracking)

CONSTRAINTS:
- Be specific with URLs and click-paths — the owner is not technical.
- If a platform requires postcard verification, note the timeline.
- Group fixes by priority (critical NAP errors first, then claim operations, then platform gaps).

Return JSON:
{
  "deliverableText": "full structured guide",
  "submissionGuide": "verification steps"
}$BODY$,
  '["business_name","city","category","audit_results"]'::jsonb,
  true, true, 'system', NOW(), NOW(), NULL, 'business',
  '{"name": "citation_repair_package", "fields": {"deliverableText": "string", "submissionGuide": "string"}}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, variables = EXCLUDED.variables, output_schema = EXCLUDED.output_schema, updated_at = NOW();

-- ─── Service categories for profile repair ─────────────────────────

INSERT INTO mkt_service_categories_list (value, label) VALUES
  ('profile_repair_audit',    'Profile Repair — Audit & Report'),
  ('profile_repair_package',  'Profile Repair — Citation & Repair Package'),
  ('profile_repair_appeal',   'Profile Repair — Reinstatement Appeal')
ON CONFLICT (value) DO UPDATE SET
  label = EXCLUDED.label,
  is_active = true,
  updated_at = NOW();
