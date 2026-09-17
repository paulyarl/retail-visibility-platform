-- Migration 167: mkt_campaigns_list — structured business address columns
-- Adds the "A" in NAP (Name, Address, Phone) so operators can capture and
-- repair the business's actual street address during GBP / profile audits.
-- These are distinct from the prospecting-scope `city` column (which tracks
-- the market being prospected, not necessarily the business's physical
-- location).

BEGIN;

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS address_line1   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_line2   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_city    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_state   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address_zip     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS address_country VARCHAR(2) DEFAULT 'US';

COMMIT;
