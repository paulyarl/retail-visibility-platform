-- Migration: 158_mkt_signal_registry.sql
-- Sprint 2A pivot: signal taxonomy + generic rules engine.
-- Adds mkt_signal_registry table and priority_rank column to mkt_playbook_catalog.
-- After running: cd apps/api && npx prisma db pull && npx prisma generate.

-- Add priority_rank column to mkt_playbook_catalog (cascade evaluation order).
-- Seeded order: PB-04=1, PB-05=2, PB-01=3, PB-02=4, PB-06=5, PB-03=6
ALTER TABLE mkt_playbook_catalog ADD COLUMN IF NOT EXISTS priority_rank INT NOT NULL DEFAULT 99;

-- Backfill priority_rank for any existing playbook rows by code.
UPDATE mkt_playbook_catalog SET priority_rank = 1 WHERE code = 'PB-04';
UPDATE mkt_playbook_catalog SET priority_rank = 2 WHERE code = 'PB-05';
UPDATE mkt_playbook_catalog SET priority_rank = 3 WHERE code = 'PB-01';
UPDATE mkt_playbook_catalog SET priority_rank = 4 WHERE code = 'PB-02';
UPDATE mkt_playbook_catalog SET priority_rank = 5 WHERE code = 'PB-06';
UPDATE mkt_playbook_catalog SET priority_rank = 6 WHERE code = 'PB-03';

-- Signal registry: signals as DATA so admins can register future unknown
-- signals without an engine deploy. detection_source tells the extractor how
-- the signal is produced:
--   model_emitted  — audit LLM output includes the code in audit_signals[]
--   derived        — computed from raw audit/campaign fields by code (thresholds)
--   operator_input — manually supplied (e.g. BBB pre-flight inputs)
CREATE TABLE IF NOT EXISTS mkt_signal_registry (
  id VARCHAR(255) PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,              -- e.g. 'RA_REVIEW_DROUGHT'
  family VARCHAR(10) NOT NULL,                   -- RA, DS, WC, CP, VP (extensible)
  label VARCHAR(255) NOT NULL,                   -- e.g. 'Review Drought (>180 days)'
  description TEXT,
  detection_source VARCHAR(20) NOT NULL DEFAULT 'model_emitted',
  derived_rule JSONB,                            -- only for detection_source='derived': { field, op, threshold }
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_signal_registry_code ON mkt_signal_registry(code);
CREATE INDEX IF NOT EXISTS idx_mkt_signal_registry_family ON mkt_signal_registry(family, is_active);

-- Update the active index to include priority_rank for cascade queries.
DROP INDEX IF EXISTS idx_mkt_playbook_catalog_active;
CREATE INDEX idx_mkt_playbook_catalog_active ON mkt_playbook_catalog(is_active, priority_rank);

-- ─── Seed: 24 canonical signal codes (Sprint 2A §2A.1 taxonomy) ──────────
-- Uses INSERT ... ON CONFLICT so re-running is idempotent.

INSERT INTO mkt_signal_registry (id, code, family, label, description, detection_source, derived_rule, is_active) VALUES
  -- Reputation & Administrative (RA)
  ('sig-ra-bbb-grade', 'RA_BBB_GRADE_SUPPRESSION', 'RA', 'BBB Grade Suppression (C or below)', 'BBB letter grade is C, D, or F — triggers recovery playbook', 'operator_input', NULL, true),
  ('sig-ra-unanswered-complaints', 'RA_UNANSWERED_COMPLAINTS', 'RA', 'Unanswered BBB Complaints', 'One or more unanswered BBB complaints on file', 'operator_input', NULL, true),
  ('sig-ra-review-drought', 'RA_REVIEW_DROUGHT', 'RA', 'Review Drought (>180 days)', 'No new reviews in 180+ days — footprint is stale', 'derived', '{"field":"days_since_last_review","op":">=","threshold":180}'::jsonb, true),
  ('sig-ra-low-review-volume', 'RA_LOW_REVIEW_VOLUME', 'RA', 'Low Review Volume (<15 total)', 'Combined review count across platforms is below 15', 'derived', '{"field":"combined_review_count","op":"<","threshold":15}'::jsonb, true),
  ('sig-ra-unaddressed-negative-backlog', 'RA_UNADDRESSED_NEGATIVE_BACKLOG', 'RA', 'Unaddressed Negative Review Backlog (≥3)', '3+ unanswered negative reviews (≤3 stars) accumulating', 'derived', '{"field":"unanswered_negative_reviews","op":">=","threshold":3}'::jsonb, true),
  ('sig-ra-unaddressed-positive-backlog', 'RA_UNADDRESSED_POSITIVE_BACKLOG', 'RA', 'Unaddressed Positive Review Backlog (≥5)', '5+ unanswered positive reviews — response gap', 'derived', '{"field":"unanswered_positive_reviews","op":">=","threshold":5}'::jsonb, true),

  -- Digital Surface & Profile (DS)
  ('sig-ds-claimed-status', 'DS_CLAIMED_STATUS', 'DS', 'Unclaimed GBP Profile', 'Google Business Profile is not claimed by the owner', 'model_emitted', NULL, true),
  ('sig-ds-missing-profile', 'DS_MISSING_PROFILE', 'DS', 'Missing Platform Profile', 'Business is absent from a key platform (Google/Yelp/Facebook)', 'model_emitted', NULL, true),
  ('sig-ds-broken-profile-link', 'DS_BROKEN_PROFILE_LINK', 'DS', 'Broken Profile Link', 'A listed profile URL returns dead/timeout/error status', 'model_emitted', NULL, true),
  ('sig-ds-missing-service-menu', 'DS_MISSING_SERVICE_MENU', 'DS', 'Missing Service Menu', 'GBP service menu or services list is not populated', 'model_emitted', NULL, true),
  ('sig-ds-outdated-hours', 'DS_OUTDATED_HOURS', 'DS', 'Outdated Hours of Operation', 'Hours are missing, inconsistent, or marked outdated', 'model_emitted', NULL, true),
  ('sig-ds-photo-deficit', 'DS_PHOTO_DEFICIT', 'DS', 'Photo Deficit (<5 photos)', 'Fewer than 5 photos on GBP — visual proof gap', 'derived', '{"field":"photo_count","op":"<","threshold":5}'::jsonb, true),

  -- Website & Conversion (WC)
  ('sig-wc-missing-website', 'WC_MISSING_WEBSITE', 'WC', 'No Website Detected', 'Business has no detectable website', 'model_emitted', NULL, true),
  ('sig-wc-broken-website', 'WC_BROKEN_WEBSITE', 'WC', 'Broken Website (dead URL)', 'Website URL returns dead/timeout/DNS error status', 'model_emitted', NULL, true),
  ('sig-wc-url-mismatch', 'WC_URL_MISMATCH', 'WC', 'URL Mismatch (audit vs campaign)', 'Audit website URL differs from campaign-listed URL', 'derived', '{"field":"url_mismatch","op":"==","threshold":true}'::jsonb, true),
  ('sig-wc-missing-cta', 'WC_MISSING_CTA', 'WC', 'Missing Call-to-Action', 'Website lacks call-to-action, click-to-call, or booking', 'model_emitted', NULL, true),
  ('sig-wc-missing-service-pages', 'WC_MISSING_SERVICE_PAGES', 'WC', 'Missing Service Pages', 'Website lacks dedicated service description pages', 'model_emitted', NULL, true),
  ('sig-wc-mobile-friction', 'WC_MOBILE_FRICTION', 'WC', 'Mobile Friction', 'Website is not mobile-friendly or has mobile UX issues', 'model_emitted', NULL, true),

  -- Cross-Platform Consistency (CP)
  ('sig-cp-nap-name-drift', 'CP_NAP_NAME_DRIFT', 'CP', 'NAP Name Drift', 'Business name varies across platforms', 'model_emitted', NULL, true),
  ('sig-cp-nap-address-drift', 'CP_NAP_ADDRESS_DRIFT', 'CP', 'NAP Address Drift', 'Street address varies across platforms', 'model_emitted', NULL, true),
  ('sig-cp-nap-phone-drift', 'CP_NAP_PHONE_DRIFT', 'CP', 'NAP Phone Drift', 'Phone number varies across platforms', 'model_emitted', NULL, true),
  ('sig-cp-missing-contact-info', 'CP_MISSING_CONTACT_INFO', 'CP', 'Missing Contact Info', 'Phone or email is missing from one or more listings', 'model_emitted', NULL, true),

  -- Content & Visual Proof (VP)
  ('sig-vp-missing-project-photos', 'VP_MISSING_PROJECT_PHOTOS', 'VP', 'Missing Project Photos', 'No before/after or project portfolio photos on GBP', 'model_emitted', NULL, true),
  ('sig-vp-stale-social-activity', 'VP_STALE_SOCIAL_ACTIVITY', 'VP', 'Stale Social Activity', 'No social media posts in 60+ days', 'model_emitted', NULL, true)
ON CONFLICT (code) DO NOTHING;

-- ─── Seed: 6 standard playbooks with priority_rank + matching_rules DSL ───
-- matching_rules uses the §6.4 DSL: any/all/none/dual set-membership over SignalCode[].

INSERT INTO mkt_playbook_catalog (id, code, name, category, archetype, archetype_label, description, matching_rules, priority_rank, fitd_offer_title, fitd_default_fee_cents, retainer_pitch_title, retainer_fee_cents, preview_deliverable_type, is_active) VALUES
  ('pbk-pb01', 'PB-01', 'Profile Repair & Listing Drift', 'review_management', 'A3', 'A3_LISTING_DRIFT',
   'Pure profile/listing repair: NAP drift or URL mismatch with no review gap.',
   '{"any":["WC_URL_MISMATCH","CP_NAP_NAME_DRIFT","CP_NAP_ADDRESS_DRIFT","CP_NAP_PHONE_DRIFT"],"all":[],"none":["RA_BBB_GRADE_SUPPRESSION","RA_UNANSWERED_COMPLAINTS","RA_REVIEW_DROUGHT","RA_LOW_REVIEW_VOLUME","RA_UNADDRESSED_NEGATIVE_BACKLOG","RA_UNADDRESSED_POSITIVE_BACKLOG"],"dual":null,"confidence":0.85}'::jsonb,
   3, 'One-Time Citation & Profile Alignment Package', 14900, 'Listing Synchronization & Search Defense', 19900, 'nap_report', true),

  ('pbk-pb02', 'PB-02', 'Review Gap & Stagnation', 'review_management', 'A1', 'A1_REVIEW_GAP',
   'Pure review gap: drought, low volume, or unaddressed positive backlog with no repair signal.',
   '{"any":["RA_REVIEW_DROUGHT","RA_LOW_REVIEW_VOLUME","RA_UNADDRESSED_POSITIVE_BACKLOG"],"all":[],"none":["RA_BBB_GRADE_SUPPRESSION","RA_UNANSWERED_COMPLAINTS","RA_UNADDRESSED_NEGATIVE_BACKLOG","WC_URL_MISMATCH","CP_NAP_NAME_DRIFT","CP_NAP_ADDRESS_DRIFT","CP_NAP_PHONE_DRIFT","WC_BROKEN_WEBSITE","DS_BROKEN_PROFILE_LINK"],"dual":null,"confidence":0.85}'::jsonb,
   4, 'One-Time Review Acceleration & Response Pack', 9900, 'Automated Review Acquisition Engine', 19900, 'review_responses', true),

  ('pbk-pb03', 'PB-03', 'Conversion & Surface Friction', 'review_management', 'A4', 'A4_CTA_GAP',
   'Fallback conversion gap: CTA friction, missing service pages, or no actionable signals.',
   '{"any":["WC_MISSING_CTA","WC_MISSING_SERVICE_PAGES","DS_MISSING_SERVICE_MENU","WC_MOBILE_FRICTION","WC_MISSING_WEBSITE"],"all":[],"none":[],"dual":null,"confidence":0.70}'::jsonb,
   6, 'One-Time Website & Surface Conversion Fix', 19900, 'Conversion & Local SEO Retainer', 29900, 'cta_audit', true),

  ('pbk-pb04', 'PB-04', 'Admin Neglect (BBB Recovery)', 'recovery_management', 'A2', 'A2_NEGATIVE_RECOVERY',
   'BBB emergency: low BBB grade or unanswered complaints. Highest priority — requires operator-supplied BBB input.',
   '{"any":["RA_BBB_GRADE_SUPPRESSION","RA_UNANSWERED_COMPLAINTS","RA_UNADDRESSED_NEGATIVE_BACKLOG"],"all":[],"none":[],"dual":null,"confidence":0.95}'::jsonb,
   1, 'One-Time BBB Settlement & Dispute Package', 34900, 'Reputation Defense & Risk Shield', 39900, 'recovery_resolution', true),

  ('pbk-pb05', 'PB-05', 'Multi-Signal Footprint Triage', 'triage_management', 'A5', 'A5_DUAL_TRIAGE',
   'Dual-signal triage: both a repair signal AND a review signal present, with no active BBB crisis.',
   '{"any":[],"all":[],"none":["RA_BBB_GRADE_SUPPRESSION","RA_UNANSWERED_COMPLAINTS"],"dual":{"groupA":["CP_NAP_NAME_DRIFT","CP_NAP_ADDRESS_DRIFT","CP_NAP_PHONE_DRIFT","WC_URL_MISMATCH","WC_BROKEN_WEBSITE","DS_BROKEN_PROFILE_LINK"],"groupB":["RA_REVIEW_DROUGHT","RA_LOW_REVIEW_VOLUME","RA_UNADDRESSED_NEGATIVE_BACKLOG","RA_UNADDRESSED_POSITIVE_BACKLOG"]},"confidence":0.90}'::jsonb,
   2, 'One-Time Complete Digital Footprint Audit & Repair', 24900, 'Full Local Reputation & Listing Retainer', 29900, 'footprint_audit', true),

  ('pbk-pb06', 'PB-06', 'Visual & Asset Refresh', 'review_management', 'A3', 'A3_LISTING_DRIFT',
   'Visual & asset refresh: missing project photos, stale social, or photo deficit with no repair or review signal.',
   '{"any":["VP_MISSING_PROJECT_PHOTOS","VP_STALE_SOCIAL_ACTIVITY","DS_PHOTO_DEFICIT"],"all":[],"none":["RA_BBB_GRADE_SUPPRESSION","RA_UNANSWERED_COMPLAINTS","RA_REVIEW_DROUGHT","RA_LOW_REVIEW_VOLUME","RA_UNADDRESSED_NEGATIVE_BACKLOG","RA_UNADDRESSED_POSITIVE_BACKLOG","WC_URL_MISMATCH","CP_NAP_NAME_DRIFT","CP_NAP_ADDRESS_DRIFT","CP_NAP_PHONE_DRIFT","WC_BROKEN_WEBSITE","DS_BROKEN_PROFILE_LINK"],"dual":null,"confidence":0.80}'::jsonb,
   5, 'One-Time GBP Media & Project Asset Optimization', 14900, 'Ongoing Local Content & Photo Refresh', 19900, 'media_audit', true)
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
  updated_at = NOW();
