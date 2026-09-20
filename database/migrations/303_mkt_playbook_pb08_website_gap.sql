-- Migration 303: PB-08 Website Acquisition & Build + A7 website-gap signals
--
-- Spec: docs/LocalBiz/WEBSITE_GAP_AUDIT_PLAYBOOK_SPEC.md §4
--
-- Additive-only, data-only (no schema change, no `prisma db pull`). Adds:
--   1. Nine new mkt_signal_registry rows (WC_THIRD_PARTY_DOMAIN,
--      WC_BUILDER_SUBDOMAIN, WC_PARKED_DOMAIN, WC_UNFINISHED_SITE,
--      WC_UNSECURED_WEBSITE, WC_LEGACY_BUILDER_SITE, WC_STALE_WEBSITE,
--      WC_POOR_SITE_QUALITY, WC_CATEGORY_MISMATCH).
--   2. Renumber PB-03 (7 -> 8) to make room for PB-08 at rank 7.
--   3. Insert the PB-08 row, seeded is_active = FALSE (deployment-ordering
--      guard — §9.2 G-1: an active PB-08 lets pre-A7 prod code stamp
--      archetype='A7' and then throw on validateArchetype).
--   4. Extend matching_rules: PB-05 dual.groupA += defect-class codes;
--      PB-02 none += defect-class codes; PB-06 none += defect-class codes.
--      Absence-class codes stay OUT of the dual and none guards (same
--      treatment as WC_MISSING_WEBSITE).
--   5. Seed PB-08 starter checklist steps (pbcs-pb08-*).
--   6. Seed the website_build mkt_intake_definitions row (§8.5 / §9.7 G-6 —
--      mkt_dispute_intake.intake_kind is a FK to this table).
--
-- Post-migration cascade priority:
--   PB-04(1) > PB-05(2) > PB-01(3) > PB-02(4) > PB-07(5) > PB-06(6) > PB-08(7) > PB-03(8)
--
-- Apply in tandem against local + prd (SOP). After the A7 code is live in
-- prod, flip PB-08 active:
--   UPDATE mkt_playbook_catalog SET is_active = true WHERE code = 'PB-08';

BEGIN;

-- ─── 1. Signal registry rows ─────────────────────────────────────────────
-- detection_source: 'derived' for the three host/https codes (with a
-- derived_rule documenting the rule); 'model_emitted' for the rest.
INSERT INTO mkt_signal_registry (id, code, family, label, description, detection_source, derived_rule, is_active) VALUES
  ('sig-wc-third-party-domain', 'WC_THIRD_PARTY_DOMAIN', 'WC', 'Website Is a Third-Party/Social Page',
   'The website URL host is a social/messaging/profile platform (facebook.com, instagram.com, wa.me, x.com, tiktok.com, linktr.ee, yelp.com, nextdoor.com, t.me, m.me, threads.net, snapchat.com) or the site status is social_media_only',
   'derived', '{"field":"website.url_host","op":"in","threshold":"social_platform_hosts"}'::jsonb, true),
  ('sig-wc-builder-subdomain', 'WC_BUILDER_SUBDOMAIN', 'WC', 'Website on a Free Builder Subdomain',
   'The website URL host is a free builder subdomain (wixsite.com, wordpress.com, godaddysites.com, weebly.com, square.site, business.site, blogspot.com, myshopify.com, bigcartel.com, ...) - a live page, but no owned domain',
   'derived', '{"field":"website.url_host","op":"in","threshold":"builder_subdomain_hosts"}'::jsonb, true),
  ('sig-wc-parked-domain', 'WC_PARKED_DOMAIN', 'WC', 'Parked / For-Sale Domain',
   'The domain resolves to a parked / for-sale / registrar placeholder page',
   'model_emitted', NULL, true),
  ('sig-wc-unfinished-site', 'WC_UNFINISHED_SITE', 'WC', 'Unfinished "Coming Soon" Site',
   'A coming-soon / under-construction / template-default page that was never finished',
   'model_emitted', NULL, true),
  ('sig-wc-unsecured-website', 'WC_UNSECURED_WEBSITE', 'WC', 'Unsecured Website (HTTP / bad certificate)',
   'The owned website serves plain HTTP or has an untrusted certificate',
   'derived', '{"field":"website.https","op":"==","threshold":false}'::jsonb, true),
  ('sig-wc-legacy-builder-site', 'WC_LEGACY_BUILDER_SITE', 'WC', 'Legacy / Low-Cost Builder Site',
   'Owned domain fingerprinted as a legacy/low-cost builder (Wix assets, wp-content, GoDaddy generator meta, visible builder branding, table-layout-era markup)',
   'model_emitted', NULL, true),
  ('sig-wc-stale-website', 'WC_STALE_WEBSITE', 'WC', 'Stale Website Content',
   'Stale content signals: old copyright year, expired promos, dated news posts, seasonal content out of season',
   'model_emitted', NULL, true),
  ('sig-wc-poor-site-quality', 'WC_POOR_SITE_QUALITY', 'WC', 'Poor Website Quality',
   'Poorly designed / broken layout / unreadable / low-quality score per the audit rubric',
   'model_emitted', NULL, true),
  ('sig-wc-category-mismatch', 'WC_CATEGORY_MISMATCH', 'WC', 'Website Content Category Mismatch',
   'Site content does not match the business''s actual category - template leftovers, wrong-industry copy, or content for a different business',
   'model_emitted', NULL, true)
ON CONFLICT (code) DO NOTHING;

-- ─── 2. Renumber PB-03 (7 -> 8) to free rank 7 ───────────────────────────
UPDATE mkt_playbook_catalog SET priority_rank = 8, updated_at = NOW() WHERE code = 'PB-03';

-- ─── 3. Insert PB-08 (seeded INACTIVE — see G-1) ─────────────────────────
INSERT INTO mkt_playbook_catalog (
  id, code, name, category, archetype, archetype_label, description,
  matching_rules, priority_rank,
  fitd_offer_title, fitd_default_fee_cents,
  retainer_pitch_title, retainer_fee_cents,
  opener_prompt_template_id, preview_deliverable_type,
  is_active
) VALUES (
  'pbk-pb08',
  'PB-08',
  'Website Acquisition & Build',
  'profile_repair',
  'A7',
  'A7_WEBSITE_GAP',
  'For businesses with no owned, usable website: no site at all, a social/messaging page used as the website, a free builder subdomain, a parked or unfinished domain, a dead URL, or a deficient owned site. Delivers a website positioning report, a homepage mockup, and a domain migration plan; FITD offer is a one-time website build.',
  '{"any":["WC_MISSING_WEBSITE","WC_THIRD_PARTY_DOMAIN","WC_BUILDER_SUBDOMAIN","WC_BROKEN_WEBSITE","WC_PARKED_DOMAIN","WC_UNFINISHED_SITE","WC_UNSECURED_WEBSITE","WC_LEGACY_BUILDER_SITE","WC_STALE_WEBSITE","WC_POOR_SITE_QUALITY","WC_CATEGORY_MISMATCH"],"all":[],"none":["RA_BBB_GRADE_SUPPRESSION","RA_UNANSWERED_COMPLAINTS"],"dual":null,"confidence":0.88}'::jsonb,
  7,
  'One-Time Website Build & Launch Package',
  49900,
  'Website Hosting & Care Plan',
  9900,
  NULL,
  'seo_content',
  false
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  archetype = EXCLUDED.archetype,
  archetype_label = EXCLUDED.archetype_label,
  description = EXCLUDED.description,
  matching_rules = EXCLUDED.matching_rules,
  priority_rank = EXCLUDED.priority_rank,
  fitd_offer_title = EXCLUDED.fitd_offer_title,
  fitd_default_fee_cents = EXCLUDED.fitd_default_fee_cents,
  retainer_pitch_title = EXCLUDED.retainer_pitch_title,
  retainer_fee_cents = EXCLUDED.retainer_fee_cents,
  preview_deliverable_type = EXCLUDED.preview_deliverable_type,
  -- Deliberately NOT overwriting is_active on re-run — the activation flip is
  -- an operator step, not a migration concern.
  updated_at = NOW();

-- ─── 4a. PB-05 dual.groupA += defect-class website codes ─────────────────
-- Defect-class (a real owned site exists but is deficient) is repair-class,
-- exactly like WC_BROKEN_WEBSITE. Absence-class codes stay out.
UPDATE mkt_playbook_catalog
SET matching_rules = jsonb_set(
      matching_rules, '{dual,groupA}',
      (matching_rules->'dual'->'groupA')::jsonb
        || '["WC_UNSECURED_WEBSITE","WC_LEGACY_BUILDER_SITE","WC_STALE_WEBSITE","WC_POOR_SITE_QUALITY","WC_CATEGORY_MISMATCH"]'::jsonb
    ),
    updated_at = NOW()
WHERE code = 'PB-05'
  AND NOT (matching_rules->'dual'->'groupA' ? 'WC_UNSECURED_WEBSITE');

-- ─── 4b. PB-02 none += defect-class website codes ────────────────────────
UPDATE mkt_playbook_catalog
SET matching_rules = jsonb_set(
      matching_rules, '{none}',
      (matching_rules->'none')::jsonb
        || '["WC_UNSECURED_WEBSITE","WC_LEGACY_BUILDER_SITE","WC_STALE_WEBSITE","WC_POOR_SITE_QUALITY","WC_CATEGORY_MISMATCH"]'::jsonb
    ),
    updated_at = NOW()
WHERE code = 'PB-02'
  AND NOT (matching_rules->'none' ? 'WC_UNSECURED_WEBSITE');

-- ─── 4c. PB-06 none += defect-class website codes ────────────────────────
UPDATE mkt_playbook_catalog
SET matching_rules = jsonb_set(
      matching_rules, '{none}',
      (matching_rules->'none')::jsonb
        || '["WC_UNSECURED_WEBSITE","WC_LEGACY_BUILDER_SITE","WC_STALE_WEBSITE","WC_POOR_SITE_QUALITY","WC_CATEGORY_MISMATCH"]'::jsonb
    ),
    updated_at = NOW()
WHERE code = 'PB-06'
  AND NOT (matching_rules->'none' ? 'WC_UNSECURED_WEBSITE');

-- ─── 5. PB-08 starter checklist steps ────────────────────────────────────
-- Guarded per playbook (skip if PB-08 already has steps) + ON CONFLICT DO NOTHING.
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb08-001', 1, 'Confirm the current web-presence state', 'Establish exactly what the business has today: no site at all, a social page used as the website, a free builder subdomain, a parked/unfinished domain, or a dead link. Screenshot each state for the before report.', 'manual', '{}', true),
  ('pbcs-pb08-002', 2, 'Capture evidence for each fired signal', 'For every WC_* signal that fired, capture the observable evidence (the URL, the host, the dead-page response, the stale copyright year, the wrong-industry copy). This grounds the positioning report.', 'manual', '{}', true),
  ('pbcs-pb08-003', 3, 'Owner interview - domain, assets, category content', 'Ask the owner: do they own a domain, do they have existing assets (logo, photos, copy), and what do their customers need to see before buying (menu, products, service areas, quote form)? This drives the build scope.', 'manual', '{}', true),
  ('pbcs-pb08-004', 4, 'Run the Website Positioning Audit and build the deliverable', 'Run the website_positioning audit, then generate the positioning report + homepage mockup sections as the FITD deliverable. Attach it on the campaign Deliverables tab.', 'deliverable', '{}', true),
  ('pbcs-pb08-005', 5, 'Build or hand off the site', 'Build the site on the owned domain (or hand the approved mockup + scope to the owner/web developer with acceptance criteria). Confirm owner approval before launch.', 'manual', '{}', true),
  ('pbcs-pb08-006', 6, 'Point every profile at the canonical domain', 'Replace the social page / free subdomain URL with the canonical domain on Google Business Profile, Yelp, Facebook/Instagram, Apple Maps, and Bing Places. Verify each link resolves.', 'url_check', '{"url":"https://business.google.com/","new_tab":true}', true),
  ('pbcs-pb08-007', 7, 'Pitch the Website Hosting & Care Plan', 'Present the live site with before/after screenshots and pitch the Website Hosting & Care Plan retainer for ongoing care.', 'outreach', '{"channel":"email"}', false)
) AS v(id, step_order, title, instructions, step_type, action_config, is_required)
WHERE p.code = 'PB-08'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.playbook_id = p.id)
ON CONFLICT (id) DO NOTHING;

-- ─── 6. website_build intake definition (§8.5) ───────────────────────────
-- intake_kind is a natural-key PK referenced by mkt_dispute_intake.intake_kind
-- (FK, migration 173). Without this row the intake cannot be created.
INSERT INTO mkt_intake_definitions (
  intake_kind, label, description, driver,
  service_category, trigger_stages, submitted_stage,
  form_schema, field_mappings, owner_copy, niche_overrides,
  downstream_agent, version, is_active, is_draft
) VALUES (
  'website_build',
  'Website Build Intake',
  'Owner supplies the inputs a website build needs: domain preference/ownership, business description, service or product list, photos/assets, hours, owner voice, and the category-content specifics the audit flagged.',
  'registry',
  NULL,
  '[]'::jsonb,
  'intake_submitted',
  '[
    { "key": "domain_preference", "type": "text", "label": "Preferred domain (if you own one, list it)", "required": false },
    { "key": "domain_owned", "type": "select", "label": "Do you already own a domain?", "required": false, "options": ["yes", "no", "not sure"] },
    { "key": "business_description", "type": "textarea", "label": "Describe your business in a sentence or two", "required": true },
    { "key": "service_product_list", "type": "textarea", "label": "List your main services or product categories", "required": true },
    { "key": "photos_assets", "type": "textarea", "label": "What photos or assets do you have? (logo, storefront, products)", "required": false },
    { "key": "hours", "type": "textarea", "label": "Your regular hours", "required": false },
    { "key": "owner_voice", "type": "textarea", "label": "How would you describe the voice you want on your site?", "required": false },
    { "key": "category_content_notes", "type": "textarea", "label": "Anything about your category customers should see first?", "required": false }
  ]'::jsonb,
  '[
    { "field": "owner_voice", "adapter": "owner_voice_profile_upsert" }
  ]'::jsonb,
  '{
    "title": "Tell us what your website should say",
    "subtitle": "A few details and we will build the first version",
    "intro": "Answer what you can — this gives us everything we need to build a site that actually represents your business.",
    "success_message": "Thank you — we will use these details to build your site."
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

-- ─── Verification (run manually after applying) ──────────────────────────
-- SELECT code, priority_rank, is_active FROM mkt_playbook_catalog ORDER BY priority_rank;
--   Expect PB-08 at 7 (is_active=false), PB-03 at 8.
-- SELECT code FROM mkt_signal_registry WHERE code LIKE 'WC_%' ORDER BY code;
--   Expect the 9 new codes present.
-- SELECT matching_rules->'dual'->'groupA' FROM mkt_playbook_catalog WHERE code = 'PB-05';
-- SELECT matching_rules->'none' FROM mkt_playbook_catalog WHERE code IN ('PB-02','PB-06');
-- SELECT intake_kind FROM mkt_intake_definitions WHERE intake_kind = 'website_build';
-- SELECT COUNT(*) FROM mkt_playbook_checklist_steps s JOIN mkt_playbook_catalog c ON c.id = s.playbook_id WHERE c.code = 'PB-08';
--   Expect 7.
