-- Migration 168: mkt_campaigns_list — directory_profiles JSON column
-- Captures per-platform business directory profile status discovered during
-- manual GBP / citation audits. Supports Google, Yelp, Yellow Pages, Apple
-- Maps, BBB, MapQuest, Yahoo Local, and arbitrary other platforms.
--
-- Each entry: { platform, url, claim_status, star_rating, review_count, category }
-- The legacy gbp_claimed / unaddressed_reviews / last_review_date columns are
-- retained and auto-synced from the Google entry in directory_profiles.

BEGIN;

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS directory_profiles JSON;

COMMIT;
