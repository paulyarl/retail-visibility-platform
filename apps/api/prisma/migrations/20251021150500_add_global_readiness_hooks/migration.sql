-- Migration: 20251021150500_add_global_readiness_hooks
-- Purpose: Add global-readiness scaffolds (region/language/currency/data_policy) and audit_log table
-- REQ: REQ-2025-901 (Tenant metadata), REQ-2025-902 (Audit log)
-- Feature Flags: FF_GLOBAL_TENANT_META, FF_AUDIT_LOG (default OFF)
--
-- Forward Compatibility:
--   - All new columns have safe defaults; existing tenants backfilled automatically.
--   - audit_log table is independent; no FK constraints from existing tables.
--   - Idempotent: safe to re-run (IF NOT EXISTS guards).
--
-- Backward Compatibility:
--   - With feature flags OFF, new columns are unused; no behavior change.
--   - Rollback: DROP columns and table (see down migration below).
--
-- Test Plan:
--   1. Apply migration to staging.
--   2. Verify all existing Tenant rows have non-NULL region/language/currency/data_policy_accepted.
--   3. Smoke test: tenant CRUD, inventory CRUD, photo upload → no regressions.
--   4. Enable FF_AUDIT_LOG → create tenant/item → verify audit_log rows emitted.
--   5. Dry-run rollback in staging; confirm schema reverts cleanly.

-- Add global-readiness metadata to Tenant (idempotent)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "region" TEXT NOT NULL DEFAULT 'us-east-1';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en-US';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "data_policy_accepted" BOOLEAN NOT NULL DEFAULT FALSE;

-- Create audit_log table (idempotent)
-- Schema: tenant_id (FK), actor (nullable user ID or email), action (e.g., "tenant.create"), payload (JSONB, no PII)
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" BIGSERIAL PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "actor" TEXT,
  "action" TEXT NOT NULL,
  "payload" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Index for efficient tenant-scoped audit queries (idempotent)
CREATE INDEX IF NOT EXISTS "audit_log_tenant_id_created_at_idx" ON "audit_log" ("tenant_id", "created_at" DESC);

-- Down Migration (manual rollback):
-- ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "region";
-- ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "language";
-- ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "currency";
-- ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "data_policy_accepted";
-- DROP TABLE IF EXISTS "audit_log";
