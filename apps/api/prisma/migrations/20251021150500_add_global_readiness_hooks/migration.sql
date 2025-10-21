-- Idempotent global-readiness hooks
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "region" TEXT NOT NULL DEFAULT 'us-east-1';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en-US';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "data_policy_accepted" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" BIGSERIAL PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "actor" TEXT,
  "action" TEXT NOT NULL,
  "payload" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "audit_log_tenant_id_created_at_idx" ON "audit_log" ("tenant_id", "created_at" DESC);
