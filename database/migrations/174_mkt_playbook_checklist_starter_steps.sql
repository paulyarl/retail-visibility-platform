-- Migration 174: Playbook Checklist Starter Steps
--
-- Seeds a starter checklist step template set for every active playbook in
-- mkt_playbook_catalog (PB-01..PB-07). Fixes the first-run gap where an
-- operator accepts an Intelligent Triage recommendation and the campaign
-- Checklist tab lands on the empty "no checklist defined / suggest a step"
-- state because no steps were ever seeded (migration 159 created the tables
-- but no templates).
--
-- Data-only migration. No schema changes, no prisma db pull required.
--
-- Conventions:
--   * Per docs/LocalBiz/marketing_ops_operator_checklist_sprint_plan.md section 5.
--   * IDs use the app-layer pbcs- prefix convention (id-generator.ts) made
--     deterministic: pbcs-pbNN-OOO so re-runs are safe.
--   * Guarded per playbook: seeding is SKIPPED entirely for any playbook that
--     already has checklist steps, so admin-built checklists (builder tab or
--     accepted suggestions) are never overwritten or duplicated, and starter
--     steps an admin intentionally deleted are not resurrected on re-run.
--   * ON CONFLICT (id) DO NOTHING as a second layer of idempotency.
--   * action_config shapes follow sprint plan section 5.3. url_check URLs
--     must be http(s) (app-layer validation in PlaybookChecklistService).
--   * Credentials steps store a reference label only, never a secret (5.4).
--
-- Date: 2026-08-06

-- --- PB-01 Profile Repair & Listing Drift ---
-- Signals: CP_NAP_NAME_DRIFT, CP_NAP_ADDRESS_DRIFT, CP_NAP_PHONE_DRIFT,
--          WC_URL_MISMATCH (+ DS_OUTDATED_HOURS, DS_CLAIMED_STATUS context)

INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb01-001', 1, 'Confirm GBP ownership and access', 'Verify the Google Business Profile is claimed and that we (or the owner) have manager access. If unclaimed or inaccessible, start the claim/verification flow with the owner before any edit work.', 'manual', '{}', true),
  ('pbcs-pb01-002', 2, 'Establish canonical NAP with the owner', 'Confirm the source-of-truth business name, address, and phone directly with the owner. Every downstream fix keys off this canonical NAP - do not guess from existing listings.', 'manual', '{}', true),
  ('pbcs-pb01-003', 3, 'Fix GBP name, address, phone, and hours', 'Update the GBP listing to the canonical NAP and correct current hours (including special/holiday hours if missing). Resolves CP_NAP_*_DRIFT at the highest-authority citation source.', 'url_check', '{"url":"https://business.google.com/","new_tab":true}', true),
  ('pbcs-pb01-004', 4, 'Correct NAP on top citation listings', 'Work through the priority directories (Yelp, Facebook, Bing Places, Apple Maps, niche directories found in the audit) and align each to the canonical NAP. Note any listings that require owner verification.', 'manual', '{}', true),
  ('pbcs-pb01-005', 5, 'Reconcile website URL across all profiles', 'Ensure every profile and citation points at the same live website URL (watch www vs non-www and http vs https - pick the canonical redirect target). Resolves WC_URL_MISMATCH.', 'manual', '{}', true),
  ('pbcs-pb01-006', 6, 'Re-run audit and verify drift cleared', 'Request a fresh business_analysis audit and confirm the CP_NAP_*_DRIFT / WC_URL_MISMATCH signals no longer fire. Attach the audit id as a completion note.', 'manual', '{}', true),
  ('pbcs-pb01-007', 7, 'Send client a profile alignment summary', 'Email the owner a short summary of what was fixed, before/after NAP, and pitch the Listing Synchronization & Search Defense retainer to keep drift from recurring.', 'outreach', '{"channel":"email"}', false)
) AS v(id, step_order, title, instructions, step_type, action_config, is_required)
WHERE p.code = 'PB-01'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.playbook_id = p.id)
ON CONFLICT (id) DO NOTHING;

-- --- PB-02 Review Gap & Stagnation ---
-- Signals: RA_REVIEW_DROUGHT, RA_LOW_REVIEW_VOLUME, RA_UNADDRESSED_POSITIVE_BACKLOG

INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb02-001', 1, 'Baseline current review metrics', 'Record review count, average rating, and last review date per platform from the audit. This baseline anchors the drought/low-volume story told to the client.', 'manual', '{}', true),
  ('pbcs-pb02-002', 2, 'Clear the unanswered review backlog', 'Write and post owner responses to all unaddressed reviews (positive and negative), newest first. Match the niche tone preset. Positive backlog first if volume is large - quick wins.', 'url_check', '{"url":"https://business.google.com/","new_tab":true}', true),
  ('pbcs-pb02-003', 3, 'Set up a review request flow', 'Establish the ask channel with the owner: SMS/email request template, QR card, or verbal ask script. Confirm what is compliant per platform guidelines (no gating, no incentives on Google).', 'manual', '{}', true),
  ('pbcs-pb02-004', 4, 'Send first batch of review requests', 'Send the first wave of review requests to recent happy customers (owner provides the list). Log the outreach so follow-up cadence is trackable.', 'outreach', '{"channel":"email"}', true),
  ('pbcs-pb02-005', 5, 'Deliver the Review Acceleration & Response Pack', 'Package the response templates, request flow assets, and baseline report as the FITD deliverable. Attach it on the campaign Deliverables tab.', 'deliverable', '{}', true),
  ('pbcs-pb02-006', 6, 'Schedule 30-day review velocity check-in', 'Book a follow-up to measure new-review velocity against baseline and pitch the Automated Review Acquisition Engine retainer.', 'outreach', '{"channel":"email"}', false)
) AS v(id, step_order, title, instructions, step_type, action_config, is_required)
WHERE p.code = 'PB-02'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.playbook_id = p.id)
ON CONFLICT (id) DO NOTHING;

-- --- PB-03 Conversion & Surface Friction ---
-- Signals: WC_MISSING_CTA, WC_MISSING_SERVICE_PAGES, DS_MISSING_SERVICE_MENU
--          (also the triage fallback playbook)

INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb03-001', 1, 'Walk the website as a customer', 'Open the site on mobile and desktop. Attempt the primary customer journeys (call, book, request quote, find services/pricing). Note every point of friction - this is the conversion audit raw material.', 'manual', '{}', true),
  ('pbcs-pb03-002', 2, 'Document missing CTAs and service pages', 'List each gap found: missing/unclear call-to-action, absent click-to-call, no booking path, missing service pages or service menu. Screenshot each gap for the client report.', 'manual', '{}', true),
  ('pbcs-pb03-003', 3, 'Produce the conversion fix plan', 'Turn the gap list into a prioritized fix plan (what, where, effort). This becomes the Website & Surface Conversion Fix deliverable shown to the client before work begins.', 'deliverable', '{}', true),
  ('pbcs-pb03-004', 4, 'Implement or hand off the website fixes', 'Apply the approved fixes if we control the site, or hand the plan to the owner/web developer with clear acceptance criteria. Confirm owner approval before changes go live.', 'manual', '{}', true),
  ('pbcs-pb03-005', 5, 'Verify fixes live on mobile and desktop', 'Re-walk the customer journeys after deployment. Confirm CTAs work, click-to-call dials, service pages resolve. Re-run the audit to confirm WC_* signals clear.', 'manual', '{}', true),
  ('pbcs-pb03-006', 6, 'Pitch the Conversion & Local SEO retainer', 'Present results with before/after screenshots and propose ongoing conversion monitoring and local SEO work.', 'outreach', '{"channel":"email"}', false)
) AS v(id, step_order, title, instructions, step_type, action_config, is_required)
WHERE p.code = 'PB-03'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.playbook_id = p.id)
ON CONFLICT (id) DO NOTHING;

-- --- PB-04 Admin Neglect (BBB Recovery) ---
-- Signals: RA_BBB_GRADE_SUPPRESSION, RA_UNANSWERED_COMPLAINTS,
--          RA_UNADDRESSED_NEGATIVE_BACKLOG

INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb04-001', 1, 'Pull the current BBB profile and grade', 'Locate the business on BBB, record the current grade/rating, accreditation status, and complaint count. Screenshot everything - this is the before state for the recovery story.', 'url_check', '{"url":"https://www.bbb.org/","new_tab":true}', true),
  ('pbcs-pb04-002', 2, 'Document every unanswered complaint', 'For each unanswered BBB complaint, capture the date, customer claim, and any owner context. Interview the owner for their side - responses must be factual, not emotional.', 'manual', '{}', true),
  ('pbcs-pb04-003', 3, 'Retrieve BBB account credentials', 'Get the BBB business-account login from the credential store (or have the owner recover access). Reference only - never copy secrets into the campaign.', 'credentials', '{"credential_ref":"Vault > LocalBiz > Client BBB accounts"}', true),
  ('pbcs-pb04-004', 4, 'Draft and approve complaint responses', 'Write a professional response per complaint (acknowledge, resolve or dispute with evidence, offer offline path). Owner approves each response before submission.', 'manual', '{}', true),
  ('pbcs-pb04-005', 5, 'Submit responses and request grade review', 'Post the responses through the BBB portal, then request a grade re-evaluation once complaints show as answered/resolved. Record the submission dates.', 'manual', '{}', true),
  ('pbcs-pb04-006', 6, 'Report status and pitch Reputation Defense', 'Send the owner a status report (complaints answered, grade trajectory) and pitch the Reputation Defense & Risk Shield retainer for ongoing monitoring.', 'outreach', '{"channel":"email"}', false)
) AS v(id, step_order, title, instructions, step_type, action_config, is_required)
WHERE p.code = 'PB-04'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.playbook_id = p.id)
ON CONFLICT (id) DO NOTHING;

-- --- PB-05 Multi-Signal Footprint Triage ---
-- Signals: repair signals (CP_*, WC_URL_MISMATCH, WC_BROKEN_WEBSITE,
--          DS_BROKEN_PROFILE_LINK) + review signals (RA_*) simultaneously

INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb05-001', 1, 'Run the full digital footprint inventory', 'Enumerate every surface: GBP, website, top citations, review platforms, social profiles. Record status of each (claimed, broken link, NAP state, review state) in one working sheet.', 'manual', '{}', true),
  ('pbcs-pb05-002', 2, 'Prioritize repair vs review workstreams', 'Split the findings into a listing-repair track and a review/reputation track. Sequence repair first (broken surfaces waste review gains), and get owner sign-off on the plan.', 'manual', '{}', true),
  ('pbcs-pb05-003', 3, 'Execute the listing repair track', 'Fix NAP drift, broken profile links, broken/dead website URLs, and unclaimed profiles per the PB-01-style repair sequence.', 'url_check', '{"url":"https://business.google.com/","new_tab":true}', true),
  ('pbcs-pb05-004', 4, 'Execute the review backlog track', 'Clear unanswered review backlog and stand up a review request flow per the PB-02-style sequence, once surfaces are stable.', 'manual', '{}', true),
  ('pbcs-pb05-005', 5, 'Deliver the Complete Digital Footprint Audit & Repair report', 'Compile before/after state across all surfaces into the FITD deliverable and attach it on the campaign Deliverables tab.', 'deliverable', '{}', true),
  ('pbcs-pb05-006', 6, 'Present the full retainer pitch', 'Walk the owner through the report and pitch the Full Local Reputation & Listing Retainer covering ongoing sync + review acquisition.', 'outreach', '{"channel":"email"}', false)
) AS v(id, step_order, title, instructions, step_type, action_config, is_required)
WHERE p.code = 'PB-05'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.playbook_id = p.id)
ON CONFLICT (id) DO NOTHING;

-- --- PB-06 Visual & Asset Refresh ---
-- Signals: VP_MISSING_PROJECT_PHOTOS, VP_STALE_SOCIAL_ACTIVITY, DS_PHOTO_DEFICIT

INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb06-001', 1, 'Inventory current GBP and social media assets', 'Catalog existing photos on GBP (storefront, interior, product/project work) and the last activity date on social profiles. Identify the specific deficits the audit flagged.', 'url_check', '{"url":"https://business.google.com/","new_tab":true}', true),
  ('pbcs-pb06-002', 2, 'Collect fresh photos and assets from the client', 'Request storefront, team, and project/product photos from the owner (shot list helps). Confirm usage rights for business profiles.', 'outreach', '{"channel":"email"}', true),
  ('pbcs-pb06-003', 3, 'Optimize and upload media to GBP', 'Crop/size per GBP guidelines, name files descriptively, and upload in the right categories (exterior, interior, at-work, products). Remove or replace low-quality duplicates.', 'manual', '{}', true),
  ('pbcs-pb06-004', 4, 'Refresh stale social profiles', 'Update profile/cover images and post a current-activity update on the primary social profile flagged as stale.', 'manual', '{}', false),
  ('pbcs-pb06-005', 5, 'Deliver the media optimization summary', 'Package before/after screenshots and the asset library handoff as the GBP Media & Project Asset Optimization deliverable.', 'deliverable', '{}', true),
  ('pbcs-pb06-006', 6, 'Pitch the ongoing content & photo refresh retainer', 'Propose the Ongoing Local Content & Photo Refresh retainer so assets never go stale again.', 'outreach', '{"channel":"email"}', false)
) AS v(id, step_order, title, instructions, step_type, action_config, is_required)
WHERE p.code = 'PB-06'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.playbook_id = p.id)
ON CONFLICT (id) DO NOTHING;

-- --- PB-07 Product Visibility & Catalog Refresh ---
-- Signals: DS_MISSING_PRODUCT_CATALOG, WC_MISSING_PRODUCT_BROWSING,
--          WC_MISSING_AVAILABILITY_INQUIRY, WC_MISSING_PICKUP_DELIVERY
--          (+ VP_MISSING_STOREFRONT_PHOTOS, VP_MISSING_PRODUCT_PHOTOS,
--            DS_OUTDATED_HOLIDAY_HOURS context)

INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb07-001', 1, 'Assess the product visibility gap', 'Confirm which signals fired: no product browsing at all vs website-lacks-catalog, missing availability inquiry, missing pickup/delivery path. Check GBP photos for storefront/product coverage.', 'manual', '{}', true),
  ('pbcs-pb07-002', 2, 'Collect the product catalog from the client', 'Get the owner''s product/category list with prices and photos (spreadsheet or POS export). This feeds the catalog mockup.', 'outreach', '{"channel":"email"}', true),
  ('pbcs-pb07-003', 3, 'Build the mobile catalog mockup', 'Produce the mobile catalog preview deliverable so the owner can see product browsing before committing to a build.', 'deliverable', '{"deliverable_type":"product_visibility_preview"}', true),
  ('pbcs-pb07-004', 4, 'Add an availability inquiry pathway', 'Stand up at least one check-before-you-visit channel: WhatsApp, SMS, click-to-call-to-check-stock, or a simple web form.', 'manual', '{}', true),
  ('pbcs-pb07-005', 5, 'Set up a pickup or delivery pathway', 'Surface pickup/delivery options on the website and GBP (ordering link, fulfillment settings, or clear instructions on the listing).', 'manual', '{}', true),
  ('pbcs-pb07-006', 6, 'Optimize GBP photos and hours', 'Add storefront/exterior/interior and product close-up photos per the shot list. Add special/holiday hours if missing.', 'url_check', '{"url":"https://business.google.com/","new_tab":true}', true),
  ('pbcs-pb07-007', 7, 'Pitch the Product Visibility retainer', 'Present the mockup + live pathways and pitch the Monthly Product Visibility & Local Discovery Retainer.', 'outreach', '{"channel":"email"}', false)
) AS v(id, step_order, title, instructions, step_type, action_config, is_required)
WHERE p.code = 'PB-07'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.playbook_id = p.id)
ON CONFLICT (id) DO NOTHING;

-- --- Verification (run manually after applying) ---
--
-- Per-playbook step counts (expect 7, 6, 6, 6, 6, 6, 7 for PB-01..PB-07):
--   SELECT c.code, s.step_order, s.title, s.step_type, s.is_required
--   FROM mkt_playbook_checklist_steps s
--   JOIN mkt_playbook_catalog c ON c.id = s.playbook_id
--   ORDER BY c.code, s.step_order;
--
-- Confirm no playbook was double-seeded (all counts <= expected):
--   SELECT c.code, COUNT(*) FROM mkt_playbook_checklist_steps s
--   JOIN mkt_playbook_catalog c ON c.id = s.playbook_id
--   GROUP BY c.code ORDER BY c.code;
