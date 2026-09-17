-- Migration 199: INT Signal Registry Family Seeds
--
-- Registers the INT_* signal family in mkt_signal_registry. These signals
-- are emitted by Intelligence-scope discovery audits and are kept strictly
-- separate from Business-Audit triage signal families (RA, DS, WC, CP, VP).
--
-- The INT family is excluded from triage/playbook rule evaluation (§S1) —
-- they are discovery signals, not audit signals. The signal-extractor and
-- TriageEngineService have guardrails that filter them out.
--
-- Data-only migration. No schema changes, no prisma db pull required.
-- Idempotent via ON CONFLICT (code) DO NOTHING.
--
-- See docs/LocalBiz/marketing_ops_seek_intelligence_scope_sprint_plan.md §4 (Migration 199)

INSERT INTO mkt_signal_registry (id, code, family, label, description, detection_source, derived_rule, is_active)
VALUES
  ('sig-int-low-visibility', 'INT_LOW_VISIBILITY', 'INT', 'Low visibility',
   'Thin online footprint — hard to find via mainstream search. Emitted by Intelligence-scope emerging-discovery audits.',
   'model_emitted', NULL, true),
  ('sig-int-weak-mainstream', 'INT_WEAK_MAINSTREAM_INDEXING', 'INT', 'Weak mainstream indexing',
   'Present but poorly indexed by Google/mainstream search. Emitted by Intelligence-scope emerging-discovery audits.',
   'model_emitted', NULL, true),
  ('sig-int-single-source', 'INT_SINGLE_SOURCE', 'INT', 'Single source discovery',
   'Found on only one platform/source. Emitted by Intelligence-scope discovery audits.',
   'model_emitted', NULL, true),
  ('sig-int-hidden-trust', 'INT_HIDDEN_TRUST', 'INT', 'Hidden trust',
   'Strong trust signals (reviews, reputation) but low visibility. Emitted by Intelligence-scope emerging-discovery audits.',
   'model_emitted', NULL, true),
  ('sig-int-recent-business', 'INT_RECENT_BUSINESS_EVIDENCE', 'INT', 'Recent business evidence',
   'Recently established (new listing, new reviews). Emitted by Intelligence-scope emerging-discovery audits.',
   'model_emitted', NULL, true),
  ('sig-int-cat-misalign', 'INT_POSSIBLE_CATEGORY_MISALIGNMENT', 'INT', 'Possible category misalignment',
   'May be miscategorized or mislabeled on platforms. Emitted by Intelligence-scope discovery audits.',
   'model_emitted', NULL, true),
  ('sig-int-vertical-source', 'INT_VERTICAL_SOURCE_DISCOVERY', 'INT', 'Vertical source discovery',
   'Found via category-specific vertical source. Emitted by Intelligence-scope discovery audits.',
   'model_emitted', NULL, true),
  ('sig-int-multisource-id', 'INT_MULTISOURCE_IDENTITY', 'INT', 'Multisource identity',
   'Identity confirmed across 2+ independent sources. Emitted by Intelligence-scope discovery audits.',
   'model_emitted', NULL, true),
  ('sig-int-active-ops', 'INT_ACTIVE_OPERATIONAL_EVIDENCE', 'INT', 'Active operational evidence',
   'Signs of active operation (recent reviews, hours). Emitted by Intelligence-scope discovery audits.',
   'model_emitted', NULL, true),
  ('sig-int-cat-spec', 'INT_CATEGORY_SPECIALIZATION', 'INT', 'Category specialization',
   'Strong evidence of category specialization. Emitted by Intelligence-scope discovery audits.',
   'model_emitted', NULL, true),
  ('sig-int-underexposed-cred', 'INT_UNDEREXPOSED_CREDENTIAL', 'INT', 'Underexposed credential',
   'Has credentials/certifications not surfaced online. Emitted by Intelligence-scope discovery audits.',
   'model_emitted', NULL, true)
ON CONFLICT (code) DO NOTHING;

-- ─── Verification ────────────────────────────────────────────────────────
--
-- SELECT code, family, label, is_active
-- FROM mkt_signal_registry WHERE family = 'INT' ORDER BY code;
