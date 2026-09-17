-- Migration: Add notification_logs table for billing notification tracking
-- Created: 2026-04-07

CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY DEFAULT ('nlog-' || gen_random_uuid()::text),
  tenant_id TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant_id ON notification_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);

-- Add to Prisma schema (manual step required):
-- model notification_logs {
--   id           String    @id @default(dbgenerated("('nlog-'::text || (gen_random_uuid())::text)"))
--   tenant_id    String
--   type         String    @db.VarChar(50)
--   sent         Boolean   @default(false)
--   error_message String?
--   created_at   DateTime? @default(now()) @db.Timestamptz(6)
--   metadata     Json?     @default("{}")
--
--   @@index([tenant_id], map: "idx_notification_logs_tenant_id")
--   @@index([type], map: "idx_notification_logs_type")
--   @@index([created_at(sort: Desc)], map: "idx_notification_logs_created_at")
-- }
