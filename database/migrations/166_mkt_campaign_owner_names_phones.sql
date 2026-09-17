-- Migration 166: mkt_campaigns_list — owner_names + phones JSON columns
-- Adds support for capturing multiple business owner names and multiple phone
-- numbers (with labels) discovered during manual GBP / profile audit verification.
-- Also complements the existing single `phone` VARCHAR column with a structured
-- array for additional numbers (e.g. mobile, landline, after-hours).

BEGIN;

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS owner_names JSON,
  ADD COLUMN IF NOT EXISTS phones      JSON;

COMMIT;
