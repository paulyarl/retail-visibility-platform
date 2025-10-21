-- Migration: 20251021160000_add_currency_rates_table
-- Purpose: Add currency_rates table for rate-job stub
-- REQ: REQ-2025-905
-- Feature Flag: FF_CURRENCY_RATE_STUB (default OFF)
--
-- Forward Compatibility:
--   - Table is independent; no FK constraints.
--   - Idempotent: safe to re-run (IF NOT EXISTS guard).
--
-- Backward Compatibility:
--   - With feature flag OFF, table is unused; no behavior change.
--   - Rollback: DROP table (see down migration below).
--
-- Test Plan:
--   1. Apply migration to staging.
--   2. Verify currency_rates table exists.
--   3. Enable FF_CURRENCY_RATE_STUB and call /jobs/rates/daily with service token.
--   4. Verify row inserted with mock rates.

-- Create currency_rates table (idempotent)
CREATE TABLE IF NOT EXISTS "currency_rates" (
  "id" BIGSERIAL PRIMARY KEY,
  "base" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "rates" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ,
  CONSTRAINT "currency_rates_base_date_key" UNIQUE ("base", "date")
);

-- Index for efficient queries by base currency and date
CREATE INDEX IF NOT EXISTS "currency_rates_base_date_idx" ON "currency_rates" ("base", "date" DESC);

-- Down Migration (manual rollback):
-- DROP TABLE IF EXISTS "currency_rates";
