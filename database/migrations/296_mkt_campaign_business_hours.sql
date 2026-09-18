-- 296_mkt_campaign_business_hours.sql
--
-- Adds business_hours (jsonb) to mkt_campaigns_list so verified opening hours
-- captured on the verification call can ride the campaign leg of the journey
-- (queue -> campaign -> seed listing).
--
-- Shape mirrors directory_listings_list.business_hours (the seed entry hours):
--   {
--     "monday": { "open": "09:00", "close": "18:00", "closed": false },
--     ...,
--     "sunday": { "open": "09:00", "close": "18:00", "closed": true },
--     "timezone": "America/New_York"
--   }
--
-- Nullable: campaigns that never went through verification (or whose operator
-- skipped the hours paste) simply have NULL and fall back to the audit's own
-- business_hours on seed creation.
--
-- Additive + idempotent — safe on local + prd, safe to re-run.

BEGIN;

DO $$
BEGIN
  IF to_regclass('mkt_campaigns_list') IS NOT NULL THEN
    ALTER TABLE mkt_campaigns_list
      ADD COLUMN IF NOT EXISTS business_hours JSONB;
  ELSE
    RAISE NOTICE 'mkt_campaigns_list missing — skipping business_hours column';
  END IF;
END $$;

COMMIT;
