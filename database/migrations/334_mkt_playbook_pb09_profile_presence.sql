-- Migration 334: PB-09 Profile Presence & Creation + A8 presence/integrity wiring
--
-- The "no profiles" archetype. Today a business absent from Google/Yelp/
-- Facebook fires DS_MISSING_PROFILE (and the integrity family: unclaimed,
-- suspended, duplicated, hijacked, disputed, unverifiable) — but no playbook
-- consumes those signals, so the most invisible prospects fall to the blind
-- PB-03 fallback. PB-09 owns them outright: the pitch is "every platform is
-- a door customers walk through — we build the missing ones."
--
-- Additive-only, data-only (no schema change, no `prisma db pull`). Adds:
--   1. Signal registry rows for the presence/integrity family (prod already
--      has all nine; INSERT … ON CONFLICT DO NOTHING keeps local DBs whole
--      without touching live rows).
--   2. Playbook prefs: primary_playbook='PB-09' on the eight core codes
--      (they also sit in PB-09's `any` — the pref is the registry-level
--      declaration + discovery-verdict archetype tilt), and
--      secondary_playbook='PB-09' on CP_MISSING_CONTACT_INFO (footprint-
--      completeness signal — a declared fallback, never a primary trigger).
--   3. Renumber the cascade to open rank 3 (post-303 order is
--      PB-04(1) > PB-05(2) > PB-01(3) > PB-02(4) > PB-07(5) > PB-06(6) >
--      PB-08(7) > PB-03(8)). PB-09 lands at 3 — presence is foundational:
--      a business with no profiles has no surface for drift/review fixes
--      to stick to. PB-05's dual still outranks it for multi-signal combos.
--   4. Insert the PB-09 row, seeded is_active = FALSE (same G-1 deployment
--      guard as PB-08: an active PB-09 lets pre-A8 prod code stamp
--      archetype='A8' and throw on validateArchetype).
--   5. Extend PB-05 dual.groupA += presence codes (presence + review
--      backlog is exactly the multi-signal footprint A5 triages).
--   6. Seed PB-09 starter checklist steps (pbcs-pb09-*).
--   7. Seed the profile_setup mkt_intake_definitions row with its playbook
--      trigger wired inline (303/304's inert-then-wire split only existed
--      because 303 was already applied).
--
-- Post-migration cascade priority:
--   PB-04(1) > PB-05(2) > PB-09(3) > PB-01(4) > PB-02(5) > PB-07(6) > PB-06(7) > PB-08(8) > PB-03(9)
--
-- Apply in tandem against local + prd (SOP). After the A8 code is live in
-- prod, flip PB-09 active:
--   UPDATE mkt_playbook_catalog SET is_active = true WHERE code = 'PB-09';

BEGIN;

-- ─── 1. Signal registry rows (idempotent — prod has all nine) ────────────
INSERT INTO mkt_signal_registry (id, code, family, label, description, detection_source, derived_rule, is_active) VALUES
  ('sig-ds-missing-profile', 'DS_MISSING_PROFILE', 'DS', 'Missing Platform Profile',
   'Business is absent from a key platform (Google/Yelp/Facebook)',
   'model_emitted', NULL, true),
  ('sig-ds-claimed-status', 'DS_CLAIMED_STATUS', 'DS', 'Unclaimed GBP Profile',
   'Google Business Profile exists but is unclaimed — anyone can suggest edits',
   'model_emitted', NULL, true),
  ('sig-ds-zero-indexed-presence', 'DS_ZERO_INDEXED_PRESENCE', 'DS', 'Zero Indexed Presence',
   'Search returns essentially no indexed footprint for the business — invisible to discovery',
   'model_emitted', NULL, true),
  ('sig-ds-profile-suspended', 'DS_PROFILE_SUSPENDED', 'DS', 'Suspended Profile',
   'A platform profile (usually GBP) is suspended/soft-suspended — the listing is down or limited',
   'model_emitted', NULL, true),
  ('sig-ds-duplicate-listing', 'DS_DUPLICATE_LISTING', 'DS', 'Duplicate Listing',
   'Duplicate listings for the same business split reviews, rankings, and customer trust',
   'model_emitted', NULL, true),
  ('sig-ds-hijacked-listing', 'DS_HIJACKED_LISTING', 'DS', 'Hijacked Listing',
   'A listing appears to be controlled or edited by a third party — wrong website/phone planted or ownership taken',
   'model_emitted', NULL, true),
  ('sig-ds-ownership-dispute', 'DS_OWNERSHIP_DISPUTE', 'DS', 'Listing Ownership Dispute',
   'Listing ownership is contested or held by a former manager/agency — the owner cannot manage their own profile',
   'model_emitted', NULL, true),
  ('sig-ds-address-verification-block', 'DS_ADDRESS_VERIFICATION_BLOCK', 'DS', 'Address Verification Block',
   'The platform will not verify the listing at the stated address (PO box, virtual office, residential flag)',
   'model_emitted', NULL, true)
ON CONFLICT (code) DO NOTHING;

-- ─── 2. Registry playbook prefs (migration 308 mechanism) ────────────────
-- primary_playbook: the signal joins PB-09's `any` evidence pool at eval
-- time (and feeds the discovery-verdict archetype tilt). The codes are also
-- in PB-09's matching_rules.any — the pref is the declared-intent layer.
UPDATE mkt_signal_registry
SET primary_playbook = 'PB-09'
WHERE code IN (
  'DS_MISSING_PROFILE',
  'DS_CLAIMED_STATUS',
  'DS_ZERO_INDEXED_PRESENCE',
  'DS_PROFILE_SUSPENDED',
  'DS_DUPLICATE_LISTING',
  'DS_HIJACKED_LISTING',
  'DS_OWNERSHIP_DISPUTE',
  'DS_ADDRESS_VERIFICATION_BLOCK'
);

-- CP_MISSING_CONTACT_INFO is footprint-completeness, not absence — declared
-- fallback only, so a no-match contact-info signal lands on the presence
-- playbook instead of the blind PB-03 generic.
UPDATE mkt_signal_registry
SET secondary_playbook = 'PB-09'
WHERE code = 'CP_MISSING_CONTACT_INFO'
  AND secondary_playbook IS NULL;

-- ─── 3. Renumber the cascade (all ranks >= 3 shift +1) ──────────────────
UPDATE mkt_playbook_catalog
SET priority_rank = priority_rank + 1, updated_at = NOW()
WHERE priority_rank >= 3;

-- ─── 4. Insert PB-09 (seeded INACTIVE — same G-1 guard as PB-08) ─────────
INSERT INTO mkt_playbook_catalog (
  id, code, name, category, archetype, archetype_label, description,
  matching_rules, priority_rank,
  fitd_offer_title, fitd_default_fee_cents,
  retainer_pitch_title, retainer_fee_cents,
  opener_prompt_template_id, preview_deliverable_type,
  is_active
) VALUES (
  'pbk-pb09',
  'PB-09',
  'Profile Presence & Creation',
  'profile_repair',
  'A8',
  'A8_PROFILE_PRESENCE',
  'For businesses absent from the platforms where customers look: missing Google/Yelp/Facebook listings, unclaimed profiles, zero indexed footprint, and profile integrity failures (suspended, duplicated, hijacked, disputed, unverifiable). Every platform is a door customers walk through — PB-09 builds the missing doors and secures the broken ones. The differentiator is intelligence: profiles are built to the category gold-standard field set from its category + market + public-signal intelligence, not bare name-and-phone listings. Delivery forks two ways — DFY (the platform builds every profile) or DIY (the owner builds from the same benchmarked blueprint). FITD offer is a one-time presence build; the retainer keeps profiles claimed, consistent, and alive.',
  '{"any":["DS_MISSING_PROFILE","DS_CLAIMED_STATUS","DS_ZERO_INDEXED_PRESENCE","DS_PROFILE_SUSPENDED","DS_DUPLICATE_LISTING","DS_HIJACKED_LISTING","DS_OWNERSHIP_DISPUTE","DS_ADDRESS_VERIFICATION_BLOCK"],"all":[],"none":["RA_BBB_GRADE_SUPPRESSION","RA_UNANSWERED_COMPLAINTS"],"dual":null,"confidence":0.88}'::jsonb,
  3,
  'One-Time Profile Presence Build',
  14900,
  'Profile Presence & Sync Defense',
  19900,
  NULL,
  'gbp_audit',
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

-- ─── 5. PB-05 dual.groupA += presence codes ──────────────────────────────
-- Missing/unclaimed/integrity-blocked profiles are repair-class evidence:
-- presence + review backlog = the multi-signal footprint A5 exists for.
UPDATE mkt_playbook_catalog
SET matching_rules = jsonb_set(
      matching_rules, '{dual,groupA}',
      (matching_rules->'dual'->'groupA')::jsonb
        || '["DS_MISSING_PROFILE","DS_CLAIMED_STATUS","DS_ZERO_INDEXED_PRESENCE","DS_PROFILE_SUSPENDED","DS_DUPLICATE_LISTING","DS_HIJACKED_LISTING","DS_OWNERSHIP_DISPUTE","DS_ADDRESS_VERIFICATION_BLOCK"]'::jsonb
    ),
    updated_at = NOW()
WHERE code = 'PB-05'
  AND NOT (matching_rules->'dual'->'groupA' ? 'DS_MISSING_PROFILE');

-- ─── 6. PB-09 starter checklist steps ────────────────────────────────────
-- Guarded per playbook (skip if PB-09 already has steps) + ON CONFLICT DO NOTHING.
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb09-001', 1, 'Map the platform presence inventory', 'Enumerate every platform that matters for this category (Google, Yelp, Facebook, Bing Places, Apple Maps, Nextdoor, niche directories) and record its state: present+claimed, present+unclaimed, absent, suspended, duplicated, or disputed. This inventory is the presence map the whole build keys off.', 'manual', '{}', true),
  ('pbcs-pb09-002', 2, 'Supplement the audit with per-platform evidence', 'As you verify each platform state, record the evidence back into the audit — profile URLs, claim states, and what a customer actually sees. Supplemented evidence is what keeps the presence map honest: every operator-confirmed platform sharpens this audit and the next briefing for the category.', 'manual', '{}', true),
  ('pbcs-pb09-003', 3, 'Establish the canonical record with the owner', 'Confirm the source-of-truth name, address, phone, hours, categories, and description directly with the owner. Check the record against the category gold-standard field list — the attributes top-performing listings in this category carry — so nothing the benchmark expects is left off. Every new profile is created from this record; do not guess from partial listings.', 'manual', '{}', true),
  ('pbcs-pb09-004', 4, 'Claim or create the Google Business Profile', 'Claim the GBP if it exists unclaimed; create and verify it if absent. If an integrity signal fired (suspended, ownership dispute, address verification block), start the reinstatement/ownership flow before any cosmetic work. Populate to the gold-standard field set for the category — categories, hours, photos, attributes — not a bare listing.', 'url_check', '{"url":"https://business.google.com/","new_tab":true}', true),
  ('pbcs-pb09-005', 5, 'Build the missing priority profiles', 'Create and populate the absent profiles in audit-priority order (Yelp, Facebook, Bing Places, Apple Maps, Nextdoor, niche directories). Each carries the canonical NAP plus the category gold-standard fields — hours, categories, platform-tuned description, photos or service/product data — not a bare name-and-phone listing. Note any platform requiring owner verification.', 'manual', '{}', true),
  ('pbcs-pb09-006', 6, 'Resolve duplicates and integrity issues', 'Merge or suppress duplicate listings, recover hijacked or disputed profiles, and resolve suspension/verification blocks. Each resolution consolidates reviews and ranking onto one owned listing.', 'manual', '{}', true),
  ('pbcs-pb09-007', 7, 'Deliver the Presence Plan with the DFY/DIY fork', 'Generate the profile presence plan deliverable: before-and-after platform map, per-profile status, the gold-standard field spec per profile, and claim handoff instructions. The plan carries both delivery paths — we build the profiles (DFY) or the owner builds from the same benchmarked blueprint (DIY). Attach it on the campaign Deliverables tab.', 'deliverable', '{}', true),
  ('pbcs-pb09-008', 8, 'Pitch the Profile Presence & Sync retainer', 'Present the live profile map with before/after screenshots and pitch the Profile Presence & Sync Defense retainer — ongoing claim defense, drift monitoring, and new-platform expansion.', 'outreach', '{"channel":"email"}', false)
) AS v(id, step_order, title, instructions, step_type, action_config, is_required)
WHERE p.code = 'PB-09'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.playbook_id = p.id)
ON CONFLICT (id) DO NOTHING;

-- ─── 7. profile_setup intake definition (trigger wired inline) ───────────
-- intake_kind is a natural-key PK referenced by mkt_dispute_intake.intake_kind
-- (FK, migration 173). Trigger: auto-offer at `paid` on PB-09 campaigns only
-- (trigger_guard mirrors 304's PB-08 guard). runsReviewPipeline already
-- covers PB-09 — profile_repair + standard repair_track — no code change.
INSERT INTO mkt_intake_definitions (
  intake_kind, label, description, driver,
  service_category, trigger_stages, trigger_guard, submitted_stage,
  form_schema, field_mappings, owner_copy, niche_overrides,
  downstream_agent, version, is_active, is_draft
) VALUES (
  'profile_setup',
  'Profile Setup Intake',
  'Owner supplies the canonical record every new profile is built from: business name/address/phone, hours, categories, description, photos/assets, and which platforms they already have access to.',
  'registry',
  NULL,
  '["paid"]'::jsonb,
  '[{"path":"playbook_code","op":"equals","value":"PB-09"}]'::jsonb,
  'intake_submitted',
  '[
    { "key": "canonical_name", "type": "text", "label": "Exact business name as it should appear", "required": true },
    { "key": "canonical_address", "type": "text", "label": "Street address (or service-area only)", "required": true },
    { "key": "canonical_phone", "type": "text", "label": "Primary business phone", "required": true },
    { "key": "hours", "type": "textarea", "label": "Your regular hours", "required": false },
    { "key": "categories", "type": "textarea", "label": "What do you do / sell? (categories customers would search)", "required": true },
    { "key": "business_description", "type": "textarea", "label": "Describe your business in a sentence or two", "required": true },
    { "key": "photos_assets", "type": "textarea", "label": "What photos or assets do you have? (logo, storefront, work)", "required": false },
    { "key": "existing_profiles", "type": "textarea", "label": "Which platforms do you already have a profile/login on? (Google, Yelp, Facebook, etc.)", "required": false },
    { "key": "owner_email_for_verification", "type": "text", "label": "Email for platform verification links", "required": false }
  ]'::jsonb,
  '[]'::jsonb,
  '{
    "title": "Tell us what your profiles should say",
    "subtitle": "One canonical record — we build every profile from it",
    "intro": "Answer what you can — this becomes the source of truth for every listing we create or claim.",
    "success_message": "Thank you — we will use these details to build your profiles."
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
  trigger_stages = EXCLUDED.trigger_stages,
  trigger_guard = EXCLUDED.trigger_guard,
  form_schema = EXCLUDED.form_schema,
  field_mappings = EXCLUDED.field_mappings,
  owner_copy = EXCLUDED.owner_copy,
  version = mkt_intake_definitions.version + 1,
  updated_at = now();

COMMIT;

-- ─── Verification (run manually after applying) ──────────────────────────
-- SELECT code, priority_rank, is_active FROM mkt_playbook_catalog ORDER BY priority_rank;
--   Expect: PB-04(1) PB-05(2) PB-09(3,inactive) PB-01(4) PB-02(5) PB-07(6) PB-06(7) PB-08(8) PB-03(9)
-- SELECT code, primary_playbook, secondary_playbook FROM mkt_signal_registry
--   WHERE primary_playbook IS NOT NULL OR secondary_playbook IS NOT NULL;
--   Expect the 8 presence/integrity codes -> primary PB-09, CP_MISSING_CONTACT_INFO -> secondary PB-09.
-- SELECT matching_rules->'dual'->'groupA' FROM mkt_playbook_catalog WHERE code = 'PB-05';
--   Expect the DS_* presence codes appended.
-- SELECT COUNT(*) FROM mkt_playbook_checklist_steps s JOIN mkt_playbook_catalog c ON c.id = s.playbook_id WHERE c.code = 'PB-09';
--   Expect 8.
-- SELECT intake_kind, trigger_stages, trigger_guard FROM mkt_intake_definitions WHERE intake_kind = 'profile_setup';
--   Expect trigger_stages = ["paid"], trigger_guard playbook_code=PB-09.
