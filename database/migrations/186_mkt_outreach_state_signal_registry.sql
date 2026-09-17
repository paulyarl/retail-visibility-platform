-- Migration 186: Outreach-State Signal Registry Seed
--
-- Seeds new signal rows in mkt_signal_registry under a new family 'OX'
-- (Outreach Execution). These are detection_source='derived' — computed
-- by the outreach-state extractor from mkt_outreach_openers_list,
-- mkt_outreach_pitches_list, and mkt_outreach_log, NOT emitted by the
-- audit LLM.
--
-- These signals are DISPLAY-ONLY in the triage card's "Triggered Signals"
-- section. They do NOT feed playbook rule evaluation (the triage engine
-- skips OX_* signals — they're outreach execution state, not prospect
-- problems). They feed the checklist bridge service and the campaign
-- overview's outreach status card.
--
-- See docs/LocalBiz/marketing_ops_outreach_checklist_bridge_sprint_plan.md §4 (Migration 186)
--
-- Data-only migration. No schema changes, no prisma db pull required.
-- Idempotent via ON CONFLICT (code) DO NOTHING.
--
-- Date: 2026-08-09

INSERT INTO mkt_signal_registry (id, code, family, label, description, detection_source, derived_rule, is_active)
VALUES
  -- Outreach Execution (OX) — derived from outreach tables
  ('sig-ox-opener-sent', 'OX_OPENER_SENT', 'OX', 'Opener sent',
   'A first-touch outreach opener has been generated/executed for the campaign (message_type IS NULL on mkt_outreach_openers_list).',
   'derived',
   '{"field":"opener_count","op":">=","threshold":1}'::jsonb,
   true),
  ('sig-ox-followup-sent', 'OX_FOLLOWUP_SENT', 'OX', 'Follow-up sent',
   'At least one follow-up message has been sent (message_type=''follow_up'' on mkt_outreach_openers_list).',
   'derived',
   '{"field":"followup_count","op":">=","threshold":1}'::jsonb,
   true),
  ('sig-ox-pitch-assembled', 'OX_PITCH_ASSEMBLED', 'OX', 'Pitch assembled',
   'A full outreach pitch has been assembled (row exists in mkt_outreach_pitches_list).',
   'derived',
   '{"field":"pitch_count","op":">=","threshold":1}'::jsonb,
   true),
  ('sig-ox-no-reply-opener', 'OX_NO_REPLY_AFTER_OPENER', 'OX', 'No reply after opener',
   'An opener was sent 3+ days ago with no reply and no follow-up yet. Indicates the prospect is going cold.',
   'derived',
   '{"field":"days_since_opener","op":">=","threshold":3}'::jsonb,
   true),
  ('sig-ox-no-reply-followup-n', 'OX_NO_REPLY_AFTER_FOLLOWUP_N', 'OX', 'No reply after N follow-ups',
   'Two or more follow-ups have been sent with no reply. Indicates the prospect may be disengaged.',
   'derived',
   '{"field":"followup_count","op":">=","threshold":2}'::jsonb,
   true),
  ('sig-ox-contact-logged', 'OX_CONTACT_LOGGED', 'OX', 'Contact logged',
   'At least one contact attempt has been logged (row in mkt_outreach_log).',
   'derived',
   '{"field":"contact_log_count","op":">=","threshold":1}'::jsonb,
   true)
ON CONFLICT (code) DO NOTHING;

-- ─── Verification ────────────────────────────────────────────────────────
--
-- SELECT code, family, label, detection_source, is_active
-- FROM mkt_signal_registry WHERE family = 'OX' ORDER BY code;
