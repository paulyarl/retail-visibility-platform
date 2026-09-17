-- Migration 161: Marketing Ops Customer Portal — Foundation
--
-- Adds the data layer for Phase 1 of the Marketing Ops Customer Portal
-- (Linkage + Receipts): customer links on campaigns/revenue for retroactive
-- claiming, and the single-use claim-token table that powers the email-
-- awareness claim path (Path B).
--
-- Per docs/LocalBiz/MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md §5.1, §5.2, §5.4,
-- and the §10 Phase 1 rollout plan.
--
-- Notes:
--   * No RLS: mkt_* tables are platform-admin scoped global tables (same as
--     mkt_prospect_queue / mkt_playbook_catalog / mkt_signal_registry).
--     See manual-sql-migration-policy.md §4 "Marketing Ops (mkt_*) namespace
--     exception".
--   * No DB triggers: updated_at is managed by Prisma @updatedAt in app code.
--   * IDs are generated at the app layer via id-generator.ts (mclm- prefix,
--     no tenant key — matches the mkt_* global-ID family).
--   * All changes are additive/nullable — no existing rows require backfill.
--     The claim sweep runs at runtime (CustomerAuthService register/verify).
--   * After running: cd apps/api && npx prisma db pull && npx prisma generate.

-- ─── mkt_campaigns_list: add customer_id ─────────────────────────────────
-- Set when a paying customer claims the campaign (Path A/B/C). Nullable
-- forever — anonymous payers remain valid until they claim.

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255);

ALTER TABLE mkt_campaigns_list
  DROP CONSTRAINT IF EXISTS fk_mkt_campaigns_customer;
ALTER TABLE mkt_campaigns_list
  ADD CONSTRAINT fk_mkt_campaigns_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_customer
  ON mkt_campaigns_list (customer_id);

COMMENT ON COLUMN mkt_campaigns_list.customer_id IS 'Customer who claimed this campaign (set at claim time via Path A/B/C). Nullable forever — anonymous payers remain valid. ON DELETE SET NULL keeps the campaign if the customer is deleted';

-- ─── marketing_revenue: add customer_id + receipt_emailed_at ─────────────
-- customer_id mirrors the campaign link (set at claim time for historical
-- revenue, set at payment time for new revenue once the payer has an account).
-- receipt_emailed_at tracks G5 receipt-email delivery (idempotency guard).

ALTER TABLE marketing_revenue
  ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS receipt_emailed_at TIMESTAMPTZ;

ALTER TABLE marketing_revenue
  DROP CONSTRAINT IF EXISTS fk_mkt_revenue_customer;
ALTER TABLE marketing_revenue
  ADD CONSTRAINT fk_mkt_revenue_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_revenue_customer
  ON marketing_revenue (customer_id);

COMMENT ON COLUMN marketing_revenue.customer_id IS 'Customer who made this payment (set at claim time for historical revenue, at payment time for new revenue once payer has an account). ON DELETE SET NULL keeps the revenue record';
COMMENT ON COLUMN marketing_revenue.receipt_emailed_at IS 'Timestamp of the last successful receipt email (G5). Null = not yet sent. Idempotency guard for MarketingReceiptEmailService — the pay/confirm endpoint sets this on email success, not on email send attempt';

-- ─── mkt_customer_claim_tokens ───────────────────────────────────────────
-- Single-use, short-TTL claim tokens for the email-awareness path (Path B,
-- §4.3). One token per EMAIL (not per campaign): claiming with it links every
-- paid, unclaimed campaign matching that email — preserving multi-campaign
-- awareness for historical payers in one click.
--
-- Lifecycle:
--   * claim/request issues a token (voiding prior unclaimed tokens for that
--     email) → token is single-use, 24h TTL.
--   * claim/:token/complete marks claimed_at on success → token is consumed.
--   * claim/:token (GET) validates token (exists, unclaimed, unexpired) and
--     returns a masked summary — never full purchase details pre-auth.
--   * campaign_ids is a snapshot for audit; the claim service re-derives
--     eligibility at claim time (a campaign paid after the email was sent is
--     still claimed).

CREATE TABLE IF NOT EXISTS mkt_customer_claim_tokens (
  id           VARCHAR(255)   PRIMARY KEY,
  token        VARCHAR(255)   NOT NULL UNIQUE,
  email        VARCHAR(255)   NOT NULL,
  campaign_ids JSONB          NOT NULL DEFAULT '[]',
  claimed_at   TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ    NOT NULL,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_claim_email
  ON mkt_customer_claim_tokens (email);

COMMENT ON TABLE  mkt_customer_claim_tokens IS 'Single-use, 24h-TTL claim tokens for the email-awareness claim path (Path B). One token per email — claiming links all paid, unclaimed campaigns matching that email in one action';
COMMENT ON COLUMN mkt_customer_claim_tokens.token IS 'Unguessable single-use token (nanoid). Unique. Delivered only to the campaign email address via MarketingReceiptEmailService / claim/request endpoint';
COMMENT ON COLUMN mkt_customer_claim_tokens.email IS 'The email address the token was issued for (lowercased at issue time). Indexed for the re-request-voids-prior-tokens query';
COMMENT ON COLUMN mkt_customer_claim_tokens.campaign_ids IS 'Snapshot of eligible campaign ids at issue time (audit trail). The claim service re-derives eligibility at claim time — a campaign paid after the email was sent is still claimed';
COMMENT ON COLUMN mkt_customer_claim_tokens.claimed_at IS 'Set on successful claim/:token/complete. Null = unclaimed. Single-use: a token with claimed_at IS NOT NULL is rejected';
COMMENT ON COLUMN mkt_customer_claim_tokens.expires_at IS '24h from issue. A token with expires_at < NOW() is rejected. Expiry sweep is lazy (checked at claim time), not a background job';

-- ─── actor_type enum: add 'customer' ─────────────────────────────────────
-- The audit_log.actor_type enum currently has user/system/integration. The
-- customer portal claim flow (§6.1) writes audit rows where the actor is a
-- customer, not a platform user — 'customer' is semantically distinct from
-- 'user' (which means an admin/operator). Add the value idempotently.

DO $$
BEGIN
  -- Postgres enums: ALTER TYPE ... ADD VALUE is not allowed inside a
  -- transaction block, so we check first and only add if missing.
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'customer'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'actor_type')
  ) THEN
    ALTER TYPE actor_type ADD VALUE 'customer' BEFORE 'user';
  END IF;
END $$;

-- ─── Verification queries (run manually after applying) ──────────────────
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'mkt_campaigns_list' AND column_name = 'customer_id';
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'marketing_revenue' AND column_name IN ('customer_id', 'receipt_emailed_at');
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'mkt_customer_claim_tokens';
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'mkt_campaigns_list'::regclass AND conname = 'fk_mkt_campaigns_customer';
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'marketing_revenue'::regclass AND conname = 'fk_mkt_revenue_customer';
