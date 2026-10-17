-- Migration 343: Google OAuth tokens — per-provider storage
--
-- The platform runs TWO Google OAuth clients: Merchant Center (GMC) and Business
-- Profile (GBP). A refresh token is bound to the client that issued it, so the
-- single shared row per account silently destroyed whichever provider's tokens
-- were written first — whichever flow connected last won, and the loser failed
-- every later refresh. (Observed in prd 2026-10-17: a Merchant Center refresh
-- token overwritten by a Business Profile connect, then a refresh failure
-- misattributed to the GBP path.)
--
-- google_oauth_tokens_list gains `provider` and becomes unique on
-- (account_id, provider) — one token row per account PER CLIENT. Each row is
-- refreshed with the credentials of the client that minted it.
--
-- Backfill derives the provider from the stored scopes: the Merchant Center flow
-- requests `.../auth/content` (plus business.manage/openid/userinfo), while the
-- Business Profile flow requests only `.../auth/business.manage`.

ALTER TABLE google_oauth_tokens_list
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'gmc';

UPDATE google_oauth_tokens_list
   SET provider = CASE
     WHEN scopes @> ARRAY['https://www.googleapis.com/auth/content'] THEN 'gmc'
     ELSE 'gbp'
   END;

-- Swap the unique key: account_id alone → (account_id, provider).
-- Prisma's @unique materialises as a plain unique index, not a table constraint.
DROP INDEX IF EXISTS google_oauth_tokens_list_account_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS google_oauth_tokens_list_account_id_provider_key
  ON google_oauth_tokens_list (account_id, provider);
