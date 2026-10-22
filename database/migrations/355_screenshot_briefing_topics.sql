-- Migration 355: Diagnostic screenshot → briefing topic linkage
--
-- The Outreach Kit tab's Diagnostic Screenshots were free-form: an uploaded
-- screen carried no link back to the finding it evidences. Every sibling
-- campaign's briefing (business_analysis / website_positioning audit_data)
-- already holds "Issues & Conversion Impact", "Positioning Gaps", "Outreach
-- Ammunition", and "Benefits" — each with its own hook / fix / benefit copy.
-- This column anchors a screenshot to ONE of those topics so the tag can
-- ride the row onto the admin panel and the prospect gallery.
--
-- Shape (resolved server-side from {auditId, kind, index} at write time —
-- a snapshot, so an audit re-run can't silently re-mean a stored tag):
--
--   {
--     "auditId": "maud-…",
--     "auditPlatform": "business_analysis",
--     "kind": "issue" | "gap" | "ammunition" | "benefit",
--     "index": 0,
--     "label": "<topic headline>",
--     "detail": { … whitelisted item copy … }
--   }
--
-- No RLS, no triggers — matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

ALTER TABLE mkt_files_list
  ADD COLUMN IF NOT EXISTS briefing_topic JSONB;

COMMENT ON COLUMN mkt_files_list.briefing_topic IS
  'Briefing-topic snapshot for diagnostic_screenshot rows — {auditId, auditPlatform, kind, index, label, detail}. NULL = untagged (General).';

COMMIT;
