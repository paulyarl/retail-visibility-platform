-- ─── 305_mkt_pb08_preview_deliverable_type.sql ────────────────────────────
-- PB-08 (Website Acquisition & Build): point preview_deliverable_type at the
-- new 'website_mockup' type instead of 'seo_content'.
--
-- 303 seeded PB-08 with 'seo_content' because website_mockup did not exist in
-- the DeliverableType union at spec time (OQ-2). The mockup is now a real
-- type (fulfill template mpt-seed-fulfill-009, landscape layout), and the
-- platform-centric website_build_package (mpt-seed-fulfill-010) covers the
-- delivery tier — so the preview artifact should be the mockup, not an SEO
-- content pack.
--
-- Data-only UPDATE — no schema change. Apply to staging/local AND production
-- in tandem per migration SOP. Does NOT touch is_active: PB-08 still
-- activates via the explicit post-deploy UPDATE in 303's comments.

BEGIN;

UPDATE mkt_playbook_catalog
SET preview_deliverable_type = 'website_mockup',
    updated_at = NOW()
WHERE code = 'PB-08';

COMMIT;

-- Verify: SELECT code, preview_deliverable_type, is_active FROM mkt_playbook_catalog WHERE code = 'PB-08';
