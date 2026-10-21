-- Migration 353: WC_DOMAIN_HIJACKED signal + outreach vocabulary widening
--
-- Context: Dreamcast African Market archetype — a healthy GBP (604 reviews)
-- whose Website button resolves to a hijacked domain serving foreign
-- (gambling) content. The audit stack detected existence but not ownership;
-- this closes that gap end-to-end:
--
--   1. directory_seed_outreach_touches CHECKs — 'messenger' channel,
--      'appointment_set' outcome (walk-in / DM tracking per spec).
--   2. mkt_signal_registry — WC_DOMAIN_HIJACKED registered as an
--      absence-class WC signal routing to PB-08 (secondary PB-01).
--   3. Live prompt template bodies — 'hijacked' added to the website.status
--      vocabulary and WC_DOMAIN_HIJACKED to the signal-definition lists
--      (in-place replace; idempotent via NOT LIKE guards).
--
-- Code-side wiring (same change set): business-analysis.schema.ts enum,
-- signal-extractor (derives the code from status='hijacked' + suppresses
-- friction codes), taxonomy/magnitude/predicates, field-extractors
-- presence class, deliverable governing sets, hook-library angle,
-- ProspectReportService verdict + costing copy.
--
-- Idempotent. Apply via:
--   cd apps/api && doppler run --config <env> -- node scripts/apply-sql-file.cjs ../../database/migrations/353_wc_domain_hijacked_and_outreach_vocab.sql

-- ============================================================================
-- 1. Outreach vocabulary
-- ============================================================================

ALTER TABLE directory_seed_outreach_touches
  DROP CONSTRAINT directory_seed_outreach_touches_channel_check;
ALTER TABLE directory_seed_outreach_touches
  ADD CONSTRAINT directory_seed_outreach_touches_channel_check
  CHECK (channel = ANY (ARRAY[
    'call','email','sms','mail','form','referral','visit','messenger','other'
  ]));

ALTER TABLE directory_seed_outreach_touches
  DROP CONSTRAINT directory_seed_outreach_touches_outcome_check;
ALTER TABLE directory_seed_outreach_touches
  ADD CONSTRAINT directory_seed_outreach_touches_outcome_check
  CHECK (outcome = ANY (ARRAY[
    'connected','no_response','no_answer','no_reply','voicemail','bad_number',
    'bounce','unread','read_no_reply','form_submitted','referral_asked',
    'appointment_set',
    'claimed','not_interested','report_delivered','report_viewed',
    'report_claimed','report_declined','claim_qr_generated',
    'announce_scheduled','announce_delivered'
  ]));

-- ============================================================================
-- 2. Signal registry — WC_DOMAIN_HIJACKED
-- ============================================================================

INSERT INTO mkt_signal_registry
  (id, code, family, label, description, detection_source, primary_playbook, secondary_playbook, is_active)
VALUES (
  'sig-wc-domain-hijacked',
  'WC_DOMAIN_HIJACKED',
  'WC',
  'Hijacked / Foreign-Content Domain',
  'The business website URL resolves to live content unrelated to the business — foreign-language spam, gambling/casino/pharma/SEO-doorway pages, or content for a different entity. Expired-domain takeover or site compromise; the domain is unusable even though it loads. Absence-class ownership loss — the fix is a new site on a new URL (PB-08), not content repair. Also derived deterministically when website.status=''hijacked''.',
  'model_emitted',
  'PB-08',
  'PB-01',
  true
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  primary_playbook = EXCLUDED.primary_playbook,
  secondary_playbook = EXCLUDED.secondary_playbook,
  is_active = true,
  updated_at = now();

-- ============================================================================
-- 3. Live prompt template bodies (in-place; mirrored in repo seed sources)
-- ============================================================================

-- 3a. website.status vocabulary — add 'hijacked' wherever the enum block is
--     documented (applies to every template carrying it, e.g. mpt-seed-seek-001,
--     mpt-6oeuiizo, mpt-je6m7ru6).
UPDATE mkt_prompt_templates_list
SET body = replace(
    body,
    E'* social_media_only\n* unable_to_verify',
    E'* social_media_only\n* hijacked\n* unable_to_verify'),
    updated_at = now()
WHERE body LIKE '%* social_media_only%unable_to_verify%'
  AND body NOT LIKE '%* hijacked%';

-- 3b. Signal definitions — bullet-backtick variant (mpt-seed-seek-001,
--     mpt-6oeuiizo).
UPDATE mkt_prompt_templates_list
SET body = replace(
    body,
    E'* `WC_PARKED_DOMAIN`: the domain resolves to a parked / for-sale / registrar placeholder page. Emit on sight.\n',
    E'* `WC_PARKED_DOMAIN`: the domain resolves to a parked / for-sale / registrar placeholder page. Emit on sight.\n* `WC_DOMAIN_HIJACKED`: the domain resolves to live content unrelated to the business — foreign-language spam, gambling/casino/pharma/SEO-doorway pages, or content for a different entity. Expired-domain takeover or compromise; the domain is unusable even though it loads. Set website.status to `hijacked`. Emit on sight.\n'),
    updated_at = now()
WHERE body LIKE '%`WC_PARKED_DOMAIN`: the domain resolves%'
  AND body NOT LIKE '%WC_DOMAIN_HIJACKED%';

-- 3c. Signal definitions — bare variant (mpt-j9bbem3l).
UPDATE mkt_prompt_templates_list
SET body = replace(
    body,
    E'WC_PARKED_DOMAIN: the domain resolves to a parked / for-sale / registrar placeholder page. Emit on sight.\n',
    E'WC_PARKED_DOMAIN: the domain resolves to a parked / for-sale / registrar placeholder page. Emit on sight.\nWC_DOMAIN_HIJACKED: the domain resolves to live content unrelated to the business — foreign-language spam, gambling/casino/pharma/SEO-doorway pages, or content for a different entity. Expired-domain takeover or compromise; the domain is unusable even though it loads. Set website.status to hijacked. Emit on sight.\n'),
    updated_at = now()
WHERE body LIKE '%WC_PARKED_DOMAIN: the domain resolves%'
  AND body NOT LIKE '%WC_DOMAIN_HIJACKED%';

-- 3d. Signal definitions — website-positioning template dash variant
--     (mpt-seed-website-positioning-001).
UPDATE mkt_prompt_templates_list
SET body = replace(
    body,
    E'  - WC_PARKED_DOMAIN: the domain resolves to a parked / for-sale / registrar\n    placeholder page.\n',
    E'  - WC_PARKED_DOMAIN: the domain resolves to a parked / for-sale / registrar\n    placeholder page.\n  - WC_DOMAIN_HIJACKED: the domain resolves to live content unrelated to the\n    business — foreign-language spam, gambling/casino/pharma/SEO-doorway\n    pages, or content for a different entity. Expired-domain takeover or\n    compromise; the domain is unusable even though it loads.\n'),
    updated_at = now()
WHERE id = 'mpt-seed-website-positioning-001'
  AND body NOT LIKE '%WC_DOMAIN_HIJACKED%';

-- 3e. Deliverable source-material template — governing signal lists
--     (mpt-deliverable-source-material; two list occurrences updated by
--     replace() at once).
UPDATE mkt_prompt_templates_list
SET body = replace(
    body,
    'WC_PARKED_DOMAIN, WC_UNFINISHED_SITE',
    'WC_PARKED_DOMAIN, WC_DOMAIN_HIJACKED, WC_UNFINISHED_SITE'),
    updated_at = now()
WHERE id = 'mpt-deliverable-source-material'
  AND body NOT LIKE '%WC_DOMAIN_HIJACKED%';
