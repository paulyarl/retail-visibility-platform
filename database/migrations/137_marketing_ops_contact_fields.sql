-- ============================================================
-- Migration 137: Marketing Ops — Campaign Contact Fields
-- ============================================================
-- Description:
--   - Adds dedicated contact columns (phone, email, website_url,
--     social_profiles) to mkt_campaigns_list so the campaign is the
--     single source of truth for prospect contactability.
--   - Backfills from legacy contact_method/contact_info where possible.
--   - Derives has_website = 'yes' where a website_url is backfilled.
-- Prerequisite: 136_marketing_ops_prompt_output_schema.sql applied
-- Date: 2026-07-30
-- ============================================================

-- ============================================================
-- STEP 1: Dedicated contact columns on mkt_campaigns_list
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS phone           VARCHAR(40),
  ADD COLUMN IF NOT EXISTS email           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS website_url    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS social_profiles JSONB;

-- ============================================================
-- STEP 2: Backfill from legacy contact_method/contact_info
-- ============================================================
-- Best-effort parse: if contact_method is 'phone'/'email'/'website',
-- copy contact_info into the matching new column. Leave others null.

UPDATE mkt_campaigns_list
  SET phone = contact_info
  WHERE contact_method = 'phone' AND contact_info IS NOT NULL AND phone IS NULL;

UPDATE mkt_campaigns_list
  SET email = contact_info
  WHERE contact_method = 'email' AND contact_info IS NOT NULL AND email IS NULL;

UPDATE mkt_campaigns_list
  SET website_url = contact_info
  WHERE contact_method = 'website' AND contact_info IS NOT NULL AND website_url IS NULL;

-- Derive has_website = 'yes' where we now have a website_url
UPDATE mkt_campaigns_list
  SET has_website = 'yes'
  WHERE website_url IS NOT NULL AND (has_website IS NULL OR has_website = 'none');

-- ============================================================
-- STEP 3: Indexes for contact-based search (optional, low cost)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_phone
  ON mkt_campaigns_list(phone) WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_email
  ON mkt_campaigns_list(email) WHERE email IS NOT NULL;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- ALTER TABLE mkt_campaigns_list
--   DROP COLUMN IF EXISTS phone,
--   DROP COLUMN IF EXISTS email,
--   DROP COLUMN IF EXISTS website_url,
--   DROP COLUMN IF EXISTS social_profiles;
-- DROP INDEX IF EXISTS idx_mkt_campaigns_phone;
-- DROP INDEX IF EXISTS idx_mkt_campaigns_email;
