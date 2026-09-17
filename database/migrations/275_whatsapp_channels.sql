-- 275_whatsapp_channels.sql
-- WhatsApp Channel Integration (WHATSAPP_CHANNEL_INTEGRATION_SPEC.md §7)
-- Date: 2026-09-15
--
-- Creates the whatsapp_channels operator table (one platform-owned WABA number
-- → one tenant_id for the sprint; per-tenant numbers later = more rows, no
-- schema change) and adds the bot_messages.wa_message_id dedupe column.
--
-- Posture: operator table, same convention as mkt_* — no RLS enablement, no
-- updated_at trigger (DEFAULT NOW() + app-layer writes). The app accesses
-- bot_* tables directly under the service role; do not add a policy that
-- breaks the service.
--
-- Apply: psql $DATABASE_URL -f database/migrations/275_whatsapp_channels.sql
-- (run against both local and prd), then: pnpm prisma db pull && pnpm prisma generate

CREATE TABLE IF NOT EXISTS whatsapp_channels (
  id                    varchar(255) PRIMARY KEY,        -- 'wac-...' via id-generator
  tenant_id             varchar(255) NOT NULL,           -- matches tenants.id / bot_conversations.tenant_id
  phone_number_id       varchar(64)  NOT NULL,           -- Meta WABA phone number id (routing key)
  display_phone_number  varchar(32),
  access_token_encrypted text        NOT NULL,           -- permanent system-user token, encrypted
  status                varchar(20)  NOT NULL DEFAULT 'active',
  created_by            varchar(255),
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_channels_phone_number_id
  ON whatsapp_channels (phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_tenant_id
  ON whatsapp_channels (tenant_id);

ALTER TABLE whatsapp_channels DROP CONSTRAINT IF EXISTS chk_whatsapp_channels_status;
ALTER TABLE whatsapp_channels
  ADD CONSTRAINT chk_whatsapp_channels_status
  CHECK (status IN ('active', 'disabled', 'revoked'));;

-- Dedupe: a first-class column instead of a JSON-metadata scan.
-- Nullable so all existing/widget rows are unaffected; the partial unique
-- index allows many NULLs while preventing duplicate WhatsApp message ids.
ALTER TABLE bot_messages ADD COLUMN IF NOT EXISTS wa_message_id varchar(255);
CREATE UNIQUE INDEX IF NOT EXISTS ux_bot_messages_wa_message_id
  ON bot_messages (wa_message_id) WHERE wa_message_id IS NOT NULL;

-- ── Verification ─────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'whatsapp_channels' ORDER BY ordinal_position;
-- SELECT indexname FROM pg_indexes WHERE tablename = 'whatsapp_channels';
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'chk_whatsapp_channels_status';
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'bot_messages' AND column_name = 'wa_message_id';
-- SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'bot_messages' AND indexname = 'ux_bot_messages_wa_message_id';
